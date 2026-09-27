import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Capacitor } from "@capacitor/core";

// Extracts the registration number whether the QR encodes a full URL,
// a relative path, or the bare code.
function extractRegNo(text) {
  const trimmed = text.trim();
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

export default function VerifyScanPage() {
  const router = useRouter();
  const listenerRef = useRef(null); // ML Kit listener handle (native/Capacitor path)

  const [manualCode, setManualCode] = useState("");
  // idle | preparing | scanning | denied | unsupported
  const [nativeState, setNativeState] = useState("idle");
  // Starts false on both server and first client render (Capacitor.isNativePlatform()
  // only knows the real answer once the native runtime's `window.Capacitor` exists),
  // then flips right after mount if we're actually inside the wrapped app — avoids a
  // server/client render mismatch instead of reading it directly during render.
  const [isNative, setIsNative] = useState(false);

  // Browser-path camera state, surfaced directly to the UI so "blank" is
  // never a possible state — every phase has its own visible message.
  // starting | scanning | denied | no-camera | unsupported | error
  const [camPhase, setCamPhase] = useState("starting");
  // The exact browser-reported error (name + message), shown on screen
  // in the error states below — so a failed attempt tells us precisely
  // what happened instead of a generic message that can't be acted on.
  const [camErrorDetail, setCamErrorDetail] = useState("");

  const html5QrRef = useRef(null); // the one html5-qrcode instance for the browser path
  const html5QrRunningRef = useRef(false);
  const startingRef = useRef(false); // prevents overlapping start() calls
  const mountedRef = useRef(true);
  const resolvedRef = useRef(false); // true once a code has been decoded, to ignore any late frames

  function goToResult(decodedText) {
    const regNo = extractRegNo(decodedText);
    router.push(`/verify/${encodeURIComponent(regNo)}`);
  }

  // ---------------------------------------------------------------------
  // Native path (Android APK): the wrapped app is a WebView loading this
  // page remotely, and browser-style getUserMedia() inside that WebView
  // has no permission UI wired up by default — the video stream never
  // actually starts, which is why scans never decoded no matter how the
  // scanning config was tuned. The fix isn't more JS tuning, it's using
  // the platform's own camera instead of the page trying to grab it:
  // @capacitor-mlkit/barcode-scanning opens a real native camera (Google
  // ML Kit) behind the WebView and hands back decoded text directly.
  // ---------------------------------------------------------------------
  async function startNativeScan() {
    setNativeState("preparing");
    try {
      const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");

      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        setNativeState("unsupported");
        return;
      }

      let { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== "granted" && camera !== "limited") {
        ({ camera } = await BarcodeScanner.requestPermissions());
      }
      if (camera !== "granted" && camera !== "limited") {
        setNativeState("denied");
        return;
      }

      // First run on a given device downloads ML Kit's small on-device
      // model via Play Services — usually instant if it's already
      // cached, but can take a moment the very first time.
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const listener = await BarcodeScanner.addListener("barcodeScanned", async (event) => {
        await listener.remove();
        listenerRef.current = null;
        await BarcodeScanner.stopScan();
        document.body.classList.remove("barcode-scanner-active");
        const value = event?.barcode?.rawValue || event?.barcode?.displayValue || "";
        if (value) goToResult(value);
      });
      listenerRef.current = listener;

      // The plugin renders the real camera behind the WebView, so the
      // page itself has to get out of the way visually — see the global
      // style block below for what stays visible.
      document.body.classList.add("barcode-scanner-active");
      setNativeState("scanning");
      await BarcodeScanner.startScan();
    } catch (err) {
      setNativeState("denied");
    }
  }

  async function cancelNativeScan() {
    try {
      const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
      if (listenerRef.current) {
        await listenerRef.current.remove();
        listenerRef.current = null;
      }
      await BarcodeScanner.stopScan();
    } catch (_) {
      // scanner may not have fully started yet — nothing to clean up
    }
    document.body.classList.remove("barcode-scanner-active");
    setNativeState("idle");
  }

  async function openAppSettings() {
    try {
      const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
      await BarcodeScanner.openSettings();
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // Browser path (visiting the Vercel URL directly, outside the APK).
  //
  // This used to try the browser's own `BarcodeDetector` first and hand
  // off to html5-qrcode partway through if that looked stuck. That
  // hand-off was the actual bug: stopping one getUserMedia stream and
  // immediately opening a second one on the same device is exactly the
  // kind of camera-hardware race that produces "flickers, then doesn't
  // finish, and won't scan again" — and `BarcodeDetector`'s decode
  // reliability itself varies by device in ways we can't detect
  // up front anyway.
  //
  // So: one path, one library, used the same way on every device. Every
  // attempt goes through the same start()/stop() calls, so there's no
  // handoff for the hardware to race against, and a failed attempt
  // always leaves the UI in a clear state (scanning, or an error with a
  // working "Try Again") instead of silently stalling.
  // ---------------------------------------------------------------------

  // Safe to call any number of times, from any state — never throws.
  async function teardownBrowserCamera() {
    const instance = html5QrRef.current;
    html5QrRef.current = null;
    const wasRunning = html5QrRunningRef.current;
    html5QrRunningRef.current = false;
    if (instance && wasRunning) {
      try {
        await instance.stop();
      } catch (_) {
        // Library thought it wasn't running — we're tearing down
        // regardless, so this is never fatal.
      }
    }
    if (instance) {
      try {
        instance.clear();
      } catch (_) {}
    }
  }

  async function startBrowserCamera() {
    if (startingRef.current) return; // ignore repeat taps while a start is already in flight
    startingRef.current = true;
    resolvedRef.current = false;
    setCamPhase("starting");
    setCamErrorDetail("");
    try {
      await teardownBrowserCamera(); // guarantee a clean slate before starting

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        const err = new Error("getUserMedia unsupported");
        err.reason = "unsupported";
        throw err;
      }

      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mountedRef.current) return;

      const instance = new Html5Qrcode("qr-reader");
      html5QrRef.current = instance;

      const onDecoded = (decodedText) => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        teardownBrowserCamera();
        if (mountedRef.current) goToResult(decodedText);
      };

      // qrbox bounds the decode region to roughly the visible scan
      // frame instead of the full camera frame — on mid/low-end Android
      // phones, decoding every full-resolution frame is what actually
      // caused the stutter/"flicker" feel, and cropping to the frame
      // the user is aiming with is the standard fix, not a guess.
      const config = { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 };

      // `{ facingMode: { exact: "environment" } }` first — the real
      // rear camera on phones with more than one rear lens. If the
      // device can't satisfy that exactly, fall back progressively
      // instead of failing outright. Each attempt reuses the same
      // start()/stop() cycle, so there's no separate acquisition path
      // to race against.
      const attempts = [{ facingMode: { exact: "environment" } }, { facingMode: "environment" }, true];
      let started = false;
      let lastErr = null;
      for (const constraint of attempts) {
        if (!mountedRef.current) return;
        try {
          await instance.start(constraint, config, onDecoded, () => {});
          started = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!started) {
        const err = lastErr || new Error("camera start failed");
        err.reason =
          err?.name === "NotAllowedError" || err?.name === "SecurityError"
            ? "denied"
            : err?.name === "NotFoundError" || err?.name === "OverconstrainedError"
            ? "no-camera"
            : "error";
        throw err;
      }
      html5QrRunningRef.current = true;

      if (!mountedRef.current) {
        await teardownBrowserCamera();
        return;
      }
      setCamPhase("scanning");
    } catch (err) {
      await teardownBrowserCamera();
      if (mountedRef.current) {
        setCamPhase(err?.reason || "error");
        // The raw name + message from the browser/library — this is
        // what actually tells us what's failing on a given phone
        // instead of another guess.
        setCamErrorDetail(`${err?.name || "Error"}: ${err?.message || String(err)}`);
      }
    } finally {
      startingRef.current = false;
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const native = Capacitor.isNativePlatform();
    setIsNative(native);
    if (native) {
      startNativeScan();
    } else {
      startBrowserCamera();
    }
    return () => {
      mountedRef.current = false;
      if (native) {
        cancelNativeScan();
      } else {
        teardownBrowserCamera();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) router.push(`/verify/${encodeURIComponent(manualCode.trim())}`);
  }

  const camMessages = {
    starting: "Starting camera…",
    denied: "Camera access was blocked for this site.",
    "no-camera": "No usable camera was found on this device.",
    unsupported: "Camera scanning isn't supported in this browser.",
    error: "Couldn't start the camera.",
  };

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Verify Membership</h1>
      <p style={styles.subtitle}>Point the camera at a member's QR code, or enter their registration number.</p>

      {isNative ? (
        <div className="barcode-scanner-overlay" style={styles.nativeOverlay}>
          {nativeState === "scanning" && (
            <>
              <div style={styles.scanFrame} />
              <button style={styles.cancelBtn} onClick={cancelNativeScan} type="button">
                Cancel
              </button>
            </>
          )}
          {nativeState === "preparing" && <p style={styles.hintLight}>Starting camera…</p>}
          {nativeState === "denied" && (
            <div style={styles.hintBox}>
              <p style={styles.hintText}>Camera access is off for this app.</p>
              <button style={styles.scanBtn} onClick={openAppSettings} type="button">
                Open Settings
              </button>
              <button style={styles.scanBtnGhost} onClick={startNativeScan} type="button">
                Try Again
              </button>
            </div>
          )}
          {nativeState === "unsupported" && (
            <div style={styles.hintBox}>
              <p style={styles.hintText}>Camera scanning isn't available on this device — use the field below.</p>
            </div>
          )}
          {nativeState === "idle" && (
            <button style={styles.scanBtn} onClick={startNativeScan} type="button">
              📷 Open Camera
            </button>
          )}
        </div>
      ) : (
        <div style={styles.reader}>
          {/* html5-qrcode owns this div and injects its own <video> into
              it once the camera starts. */}
          <div id="qr-reader" style={styles.readerInner} />

          {camPhase === "scanning" && <div style={styles.scanFrame} />}

          {camPhase !== "scanning" && (
            <div style={styles.camOverlay}>
              <p style={styles.hintTextLight}>{camMessages[camPhase] || camMessages.error}</p>
              {camErrorDetail && camPhase !== "starting" && (
                <p style={styles.errorDetail}>{camErrorDetail}</p>
              )}
              {camPhase !== "starting" && (
                <button style={styles.scanBtn} onClick={startBrowserCamera} type="button">
                  📷 Try Again
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleManualSubmit} style={styles.manualForm}>
        <input
          style={styles.input}
          placeholder="e.g. YPM-20260707-C848A9"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
        />
        <button style={styles.button} type="submit">Check</button>
      </form>

      {/* The ML Kit plugin draws the real camera behind the WebView and
          makes the WebView background transparent while scanning — so
          everything on the page has to hide except this overlay. */}
      <style jsx global>{`
        body.barcode-scanner-active {
          visibility: hidden;
          background: transparent;
        }
        body.barcode-scanner-active .barcode-scanner-overlay,
        body.barcode-scanner-active .barcode-scanner-overlay * {
          visibility: visible;
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: "24px 20px", maxWidth: 460, margin: "0 auto", textAlign: "center" },
  title: { fontSize: 22, color: "#1A2E1A", margin: "0 0 4px" },
  subtitle: { color: "#7A7259", fontSize: 14, margin: "0 0 20px" },
  reader: {
    position: "relative",
    width: "100%",
    minHeight: 280,
    aspectRatio: "1 / 1",
    borderRadius: 12,
    overflow: "hidden",
    background: "#000",
    marginBottom: 12,
  },
  readerInner: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  camOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
    background: "rgba(0,0,0,0.55)",
  },
  hintTextLight: { color: "#fff", fontSize: 14, margin: 0, textAlign: "center" },
  errorDetail: { color: "#F5C2C2", fontSize: 11, margin: "-4px 0 0", textAlign: "center", fontFamily: "monospace", wordBreak: "break-word", maxWidth: "100%" },
  scanBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 },
  scanBtnGhost: { background: "transparent", color: "#3E8E41", border: "2px solid #3E8E41", padding: "10px 20px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 },
  manualForm: { display: "flex", gap: 8, marginTop: 12 },
  // 16px, not 14 — iOS Safari auto-zooms the whole page in when a focused
  // input's font-size is under 16px, which reads as "the site jumps
  // around / isn't optimized for mobile" the moment someone taps in.
  input: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 16 },
  button: { background: "#3E8E41", color: "#fff", border: "none", padding: "0 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  // Native scan overlay: transparent so the real camera preview (drawn by
  // the OS behind the WebView) shows through everywhere except the frame.
  nativeOverlay: { minHeight: 320, borderRadius: 12, marginBottom: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 },
  scanFrame: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "70%",
    aspectRatio: "1 / 1",
    border: "3px solid #fff",
    borderRadius: 16,
    boxShadow: "0 0 0 999px rgba(0,0,0,0.35)",
    pointerEvents: "none",
  },
  cancelBtn: { background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  hintLight: { color: "#7A7259" },
  hintBox: { background: "#FBF6E9", borderRadius: 12, padding: 16 },
  hintText: { color: "#4A4433", marginBottom: 12 },
};
