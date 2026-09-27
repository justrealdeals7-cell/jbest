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

// ---------------------------------------------------------------------
// Browser camera acquisition — one explicit fallback chain instead of a
// single constraint that either works or silently doesn't.
//
// `facingMode: { ideal: "environment" }` (the old config) is a *hint*,
// not a requirement — Chrome is allowed to ignore it, and on phones with
// more than one rear camera (wide + ultra-wide, common on modern
// Android) it's a known source of getUserMedia picking an unexpected
// camera or failing outright with OverconstrainedError. That failure is
// what was surfacing as "camera worked once, then just blank" — the
// constraint that happened to resolve to a working camera on one load
// wasn't guaranteed to on the next.
//
// This tries, in order: an exact environment-facing camera, a soft hint
// at one, an explicitly device-picked rear camera by label, then any
// camera at all — and reports *why* it failed if every attempt fails,
// instead of one opaque error.
// ---------------------------------------------------------------------
async function acquireCameraStream() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    const err = new Error("getUserMedia unsupported");
    err.reason = "unsupported";
    throw err;
  }

  const attempts = [
    { video: { facingMode: { exact: "environment" } } },
    { video: { facingMode: "environment" } },
  ];
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (_) {
      // try the next strategy
    }
  }

  // Explicit device pick: ask what cameras exist and choose one whose
  // label says it's the rear camera, rather than trusting facingMode.
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const rear = devices.find(
      (d) => d.kind === "videoinput" && /back|rear|environment/i.test(d.label)
    );
    if (rear) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: rear.deviceId } },
        });
      } catch (_) {
        // fall through to "any camera"
      }
    }
  } catch (_) {
    // enumerateDevices needs a prior permission grant on some browsers —
    // if it fails, just fall through to the last-resort attempt below.
  }

  // Last resort: whatever camera the device has.
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    err.reason =
      err.name === "NotAllowedError" || err.name === "SecurityError"
        ? "denied"
        : err.name === "NotFoundError" || err.name === "OverconstrainedError"
        ? "no-camera"
        : "error";
    throw err;
  }
}

async function supportsNativeBarcodeDetector() {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) return false;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes("qr_code");
  } catch (_) {
    // Some implementations expose the constructor without this static
    // method — assume support rather than penalize them.
    return true;
  }
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

  const videoRef = useRef(null); // <video> used by the native BarcodeDetector path
  const streamRef = useRef(null); // the raw MediaStream backing that video
  const rafRef = useRef(null); // requestAnimationFrame handle for the detect loop
  const scanModeRef = useRef(null); // "native" | "html5-qrcode" — read by the detect loop
  const html5QrRef = useRef(null); // html5-qrcode instance, fallback path only
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
  // Two independent scan modes:
  //  - "native": the browser's own BarcodeDetector reading frames off a
  //    <video> we control end-to-end (camera acquisition, playback and
  //    teardown are all our own code, not a 3rd-party library's). This is
  //    what modern Chrome/Edge on Android use, which is what the report
  //    of a still-blank camera was coming from.
  //  - "html5-qrcode": fallback for browsers without BarcodeDetector
  //    (e.g. Firefox, older Safari). Same acquireCameraStream() fallback
  //    chain, driven through the library's device-id start() rather than
  //    a bare facingMode hint.
  //
  // Teardown for both goes through one function that cannot throw and
  // always releases the underlying MediaStream tracks directly, so a
  // failed/partial stop can never leave the camera hardware locked for
  // the next attempt (the actual cause of "works once, blank after").
  // ---------------------------------------------------------------------

  function stopDetectionLoop() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  async function stopHtml5Qrcode() {
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

  function releaseStream() {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (_) {}
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch (_) {}
    }
  }

  // Safe to call any number of times, from any state — never throws,
  // always leaves the camera hardware genuinely released.
  async function teardownBrowserCamera() {
    scanModeRef.current = null;
    stopDetectionLoop();
    await stopHtml5Qrcode();
    releaseStream();
  }

  function runNativeDetectionLoop(detector) {
    const video = videoRef.current;
    const tick = async () => {
      if (!mountedRef.current || resolvedRef.current || scanModeRef.current !== "native") {
        return;
      }
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (codes && codes.length > 0 && codes[0].rawValue) {
            resolvedRef.current = true;
            const value = codes[0].rawValue;
            await teardownBrowserCamera();
            if (mountedRef.current) goToResult(value);
            return;
          }
        } catch (_) {
          // a transient decode error on one frame — keep scanning
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  async function startWithNativeDetector(stream) {
    const video = videoRef.current;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    scanModeRef.current = "native";
    runNativeDetectionLoop(detector);
  }

  async function startWithHtml5Qrcode() {
    // This path acquires its own camera (via getCameras()/deviceId
    // rather than a bare facingMode hint) instead of reusing a stream,
    // since the library manages its own <video> element internally.
    const { Html5Qrcode } = await import("html5-qrcode");
    if (!mountedRef.current) return;

    let cameraId;
    try {
      const cameras = await Html5Qrcode.getCameras();
      const rear = cameras.find((c) => /back|rear|environment/i.test(c.label));
      cameraId = (rear || cameras[0])?.id;
    } catch (_) {
      // fall through — Html5Qrcode.start() can still take a facingMode
      // constraint object below if device enumeration itself failed
    }

    const instance = new Html5Qrcode("qr-reader-fallback");
    html5QrRef.current = instance;
    scanModeRef.current = "html5-qrcode";

    await instance.start(
      cameraId || { facingMode: "environment" },
      { fps: 10 },
      (decodedText) => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        teardownBrowserCamera();
        if (mountedRef.current) goToResult(decodedText);
      },
      () => {} // per-frame scan misses — ignore
    );
    html5QrRunningRef.current = true;
  }

  async function startBrowserCamera() {
    if (startingRef.current) return; // ignore repeat taps while a start is already in flight
    startingRef.current = true;
    resolvedRef.current = false;
    setCamPhase("starting");
    try {
      await teardownBrowserCamera(); // guarantee a clean slate before starting

      const useNative = await supportsNativeBarcodeDetector();
      if (!mountedRef.current) return;

      if (useNative) {
        const stream = await acquireCameraStream();
        if (!mountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        await startWithNativeDetector(stream);
      } else {
        await startWithHtml5Qrcode();
      }

      if (!mountedRef.current) {
        await teardownBrowserCamera();
        return;
      }
      setCamPhase("scanning");
    } catch (err) {
      await teardownBrowserCamera();
      if (mountedRef.current) setCamPhase(err?.reason || "error");
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
          {/* Native BarcodeDetector path: our own <video>, always in the
              DOM so the ref is stable, just empty until a stream attaches. */}
          <video ref={videoRef} style={styles.video} playsInline muted />
          {/* html5-qrcode fallback path: the library owns this div and
              injects its own <video> into it when active. */}
          <div id="qr-reader-fallback" style={styles.readerInner} />

          {camPhase === "scanning" && <div style={styles.scanFrame} />}

          {camPhase !== "scanning" && (
            <div style={styles.camOverlay}>
              <p style={styles.hintTextLight}>{camMessages[camPhase] || camMessages.error}</p>
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
  video: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
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
