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
  const [isNative, setIsNative] = useState(false);

  // starting | scanning | denied | no-camera | unsupported | error
  const [camPhase, setCamPhase] = useState("starting");
  const [camErrorDetail, setCamErrorDetail] = useState("");

  // ── DIAGNOSTIC STATE — this batch's actual purpose. Not a fix; a way
  // to see what's really happening on a phone where scanning never
  // triggers, instead of guessing again. ──────────────────────────────
  const [diag, setDiag] = useState({ constraint: "", resolution: "", fps: "", facing: "" });
  const [frameCount, setFrameCount] = useState(0);
  const frameFailRef = useRef(0);

  const html5QrRef = useRef(null);
  const html5QrRunningRef = useRef(false);
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const resolvedRef = useRef(false);

  function goToResult(decodedText) {
    const regNo = extractRegNo(decodedText);
    router.push(`/verify/${encodeURIComponent(regNo)}`);
  }

  // ---------------------------------------------------------------------
  // Native path (Android APK) — unchanged from batch 14.
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
    } catch (_) {}
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
  // Browser path — same three-tier constraint fallback as batch 14, now
  // instrumented so a failing phone shows real numbers instead of a
  // guess about what might be wrong.
  // ---------------------------------------------------------------------
  async function teardownBrowserCamera() {
    const instance = html5QrRef.current;
    html5QrRef.current = null;
    const wasRunning = html5QrRunningRef.current;
    html5QrRunningRef.current = false;
    if (instance && wasRunning) {
      try {
        await instance.stop();
      } catch (_) {}
    }
    if (instance) {
      try {
        instance.clear();
      } catch (_) {}
    }
  }

  async function startBrowserCamera() {
    if (startingRef.current) return;
    startingRef.current = true;
    resolvedRef.current = false;
    frameFailRef.current = 0;
    setFrameCount(0);
    setDiag({ constraint: "", resolution: "", fps: "", facing: "" });
    setCamPhase("starting");
    setCamErrorDetail("");
    try {
      await teardownBrowserCamera();

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

      // Counts every processed frame that didn't decode — this is the
      // key diagnostic. If this number climbs steadily while pointed at
      // a real QR code, frames ARE reaching the decoder and the problem
      // is decode quality (focus/lighting/resolution). If it stays at 0,
      // frames never reach the decoder at all — a completely different,
      // more fundamental problem than anything tuned in batches 10–14.
      const onFrameFail = () => {
        frameFailRef.current += 1;
      };

      const config = { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 };
      const HIGH_RES = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      const constraintAttempts = [
        { label: "exact-environment + 1080p", constraints: { facingMode: { exact: "environment" }, ...HIGH_RES } },
        { label: "environment + 1080p", constraints: { facingMode: "environment", ...HIGH_RES } },
        { label: "browser default", constraints: {} },
      ];

      let started = false;
      let lastErr = null;
      let usedLabel = "";
      for (const attempt of constraintAttempts) {
        if (!mountedRef.current) return;
        try {
          await instance.start(true, { ...config, videoConstraints: attempt.constraints }, onDecoded, onFrameFail);
          started = true;
          usedLabel = attempt.label;
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

      // Pull the ACTUAL resolved camera settings — not what we asked
      // for, what the device actually gave us.
      let settings = null;
      try {
        if (typeof instance.getRunningTrackSettings === "function") {
          settings = instance.getRunningTrackSettings();
        }
      } catch (_) {}
      if (!settings) {
        try {
          const videoEl = document.querySelector("#qr-reader video");
          settings = videoEl?.srcObject?.getVideoTracks?.()[0]?.getSettings?.() || null;
        } catch (_) {}
      }
      setDiag({
        constraint: usedLabel,
        resolution: settings ? `${settings.width}×${settings.height}` : "unknown",
        fps: settings?.frameRate ? Math.round(settings.frameRate) : "unknown",
        facing: settings?.facingMode || "unknown",
      });

      setCamPhase("scanning");
    } catch (err) {
      await teardownBrowserCamera();
      if (mountedRef.current) {
        setCamPhase(err?.reason || "error");
        setCamErrorDetail(`${err?.name || "Error"}: ${err?.message || String(err)}`);
      }
    } finally {
      startingRef.current = false;
    }
  }

  // Flush the frame-failure counter into visible state every 500ms
  // while scanning — not on every frame, to avoid the state updates
  // themselves becoming a performance problem on a slow phone.
  useEffect(() => {
    if (camPhase !== "scanning") return;
    const id = setInterval(() => setFrameCount(frameFailRef.current), 500);
    return () => clearInterval(id);
  }, [camPhase]);

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
        <>
          <div style={styles.reader}>
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

          {/* DIAGNOSTIC PANEL — temporary, for tracking down the
              mobile-vs-desktop discrepancy. Not a fix by itself. */}
          <div style={styles.diagBox}>
            <p style={styles.diagTitle}>Diagnostics</p>
            <p style={styles.diagLine}>Camera mode: {diag.constraint || "—"}</p>
            <p style={styles.diagLine}>Actual resolution: {diag.resolution || "—"}</p>
            <p style={styles.diagLine}>Frame rate: {diag.fps || "—"} fps</p>
            <p style={styles.diagLine}>Facing mode: {diag.facing || "—"}</p>
            <p style={styles.diagLine}>Frames processed: {frameCount}</p>
            <p style={styles.diagNote}>
              If "Frames processed" is climbing while you point at a code, frames ARE
              reaching the scanner — the problem is decode quality (focus/lighting/distance).
              If it stays at 0, frames never reach the scanner at all — a different,
              more fundamental problem. Screenshot this panel while it's stuck and send it.
            </p>
          </div>
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
  input: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 16 },
  button: { background: "#3E8E41", color: "#fff", border: "none", padding: "0 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
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
  diagBox: { background: "#1A2E1A", color: "#D7E4D0", borderRadius: 10, padding: "12px 14px", textAlign: "left", fontFamily: "monospace", fontSize: 12, marginBottom: 12 },
  diagTitle: { fontWeight: 700, margin: "0 0 6px", color: "#fff" },
  diagLine: { margin: "2px 0" },
  diagNote: { margin: "8px 0 0", fontFamily: "system-ui, sans-serif", fontSize: 11, color: "#A8B8A0", lineHeight: 1.4 },
};
