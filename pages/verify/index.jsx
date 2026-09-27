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
  const scannerRef = useRef(null); // html5-qrcode instance (browser path)
  const listenerRef = useRef(null); // ML Kit listener handle (native path)
  const [manualCode, setManualCode] = useState("");
  const [needsTap, setNeedsTap] = useState(false);
  // idle | preparing | scanning | denied | unsupported
  const [nativeState, setNativeState] = useState("idle");
  // Starts false on both server and first client render (Capacitor.isNativePlatform()
  // only knows the real answer once the native runtime's `window.Capacitor` exists),
  // then flips right after mount if we're actually inside the wrapped app — avoids a
  // server/client render mismatch instead of reading it directly during render.
  const [isNative, setIsNative] = useState(false);

  // --- Camera lifecycle bookkeeping (browser path) ---------------------
  // html5-qrcode throws "Cannot stop, scanner is not running or paused."
  // whenever stop() is called while its internal state isn't actually
  // SCANNING — e.g. stop() fires while start() is still resolving, or
  // twice in a row. That throw was happening inside the effect cleanup
  // (a synchronous function), which crashed the whole React tree — the
  // "Application error: a client-side exception has occurred" the
  // console showed. It also left the camera hardware attached to a video
  // element that never got torn down, which is why the camera would work
  // once and then just show a blank box on the next attempt: the stream
  // was still open but orphaned.
  //
  // Fix: never trust the library's own state — track it ourselves, only
  // ever call stop()/clear() through one guarded helper, and always fall
  // back to manually stopping the underlying MediaStream tracks so the
  // camera is genuinely released even if html5-qrcode's teardown fails.
  const runStateRef = useRef("idle"); // idle | starting | running
  const startingRef = useRef(false); // prevents overlapping start() calls
  const mountedRef = useRef(true);

  function goToResult(decodedText) {
    const regNo = extractRegNo(decodedText);
    router.push(`/verify/${encodeURIComponent(regNo)}`);
  }

  // ---------------------------------------------------------------------
  // Native path (Android APK): the wrapped app is a WebView loading this
  // page remotely, and browser-style getUserMedia() inside that WebView
  // has no permission UI wired up by default — the video stream never
  // actually starts, which is why scans never decoded no matter how the
  // html5-qrcode config was tuned. The fix isn't more JS tuning, it's
  // using the platform's own camera instead of the page trying to grab
  // it: @capacitor-mlkit/barcode-scanning opens a real native camera
  // (Google ML Kit) behind the WebView and hands back decoded text
  // directly, which is the standard approach for QR scanning in a
  // Capacitor-wrapped app.
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
  // Browser path (visiting the Vercel URL directly, outside the APK):
  // full-frame html5-qrcode scanning, with a teardown path that can't
  // throw and can't leave the camera stream dangling.
  // ---------------------------------------------------------------------

  // The one and only place that stops/tears down the browser camera.
  // Safe to call any number of times, from any state (idle, mid-start,
  // running) — it never throws.
  async function safeStopBrowserCamera() {
    const instance = scannerRef.current;
    scannerRef.current = null;
    const wasRunning = runStateRef.current === "running";
    runStateRef.current = "idle";

    if (instance && wasRunning) {
      try {
        await instance.stop();
      } catch (_) {
        // Library thought it wasn't running, or the tab/camera changed
        // state underneath us — we're tearing down regardless, so this
        // is never fatal, just ignore it.
      }
    }
    if (instance) {
      try {
        instance.clear();
      } catch (_) {}
    }

    // Belt-and-braces: make sure the actual camera hardware is released
    // even if the library's own stop() silently no-op'd. This is what
    // prevents the "works once, blank box after that" symptom — without
    // it, a failed stop() leaves the MediaStream open and the next
    // start() call has to fight over the same camera.
    try {
      const video = document.querySelector("#qr-reader video");
      const stream = video && video.srcObject;
      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (_) {}
  }

  async function startBrowserCamera() {
    if (startingRef.current) return; // ignore taps while a start is already in flight
    startingRef.current = true;
    setNeedsTap(false);
    try {
      await safeStopBrowserCamera(); // guarantee a clean slate before starting

      const { Html5Qrcode } = await import("html5-qrcode");
      if (!mountedRef.current) return; // unmounted while the module was loading

      const instance = new Html5Qrcode("qr-reader");
      scannerRef.current = instance;
      runStateRef.current = "starting";

      await instance.start(
        { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { fps: 10 }, // no qrbox — scans the entire frame, like an ordinary camera scanner
        (decodedText) => {
          runStateRef.current = "running";
          safeStopBrowserCamera();
          if (mountedRef.current) goToResult(decodedText);
        },
        () => {} // per-frame scan misses — ignore
      );

      if (!mountedRef.current) {
        // Component unmounted while start() was still resolving — don't
        // leave the camera running behind a page nobody can see.
        await safeStopBrowserCamera();
        return;
      }
      runStateRef.current = "running";
    } catch (err) {
      runStateRef.current = "idle";
      // Some mobile browsers block getUserMedia unless it's triggered by
      // a direct tap the first time. This surfaces a plain "Open Camera"
      // button for exactly that case, instead of failing silently.
      if (mountedRef.current) setNeedsTap(true);
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
        safeStopBrowserCamera();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) router.push(`/verify/${encodeURIComponent(manualCode.trim())}`);
  }

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
        <>
          <div id="qr-reader" style={styles.reader} />
          {needsTap && (
            <button style={styles.scanBtn} onClick={startBrowserCamera} type="button">
              📷 Open Camera
            </button>
          )}
        </>
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
  reader: { width: "100%", minHeight: 280, borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 12 },
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
  scanFrame: { width: 240, height: 240, border: "3px solid #fff", borderRadius: 16, boxShadow: "0 0 0 999px rgba(0,0,0,0.35)" },
  cancelBtn: { background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  hintLight: { color: "#7A7259" },
  hintBox: { background: "#FBF6E9", borderRadius: 12, padding: 16 },
  hintText: { color: "#4A4433", marginBottom: 12 },
};
