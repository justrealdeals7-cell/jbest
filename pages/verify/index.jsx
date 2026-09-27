import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function VerifyScanPage() {
  const router = useRouter();
  const scannerRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [status, setStatus] = useState("idle"); // idle | starting | scanning | error
  const [scanError, setScanError] = useState("");

  // Release the camera if the person navigates away mid-scan.
  useEffect(() => {
    return () => {
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function stopScanner() {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (!instance) return;
    try {
      await instance.stop();
    } catch {
      // already stopped / never started — fine either way
    }
    try {
      instance.clear();
    } catch {
      // no scan region was ever rendered — fine
    }
  }

  // Extracts the registration number whether the QR encodes a full URL,
  // a relative path, or the bare code.
  function extractRegNo(text) {
    const trimmed = text.trim();
    const parts = trimmed.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : trimmed;
  }

  async function handleDecoded(text) {
    const regNo = extractRegNo(text);
    await stopScanner();
    setStatus("idle");
    router.push(`/verify/${encodeURIComponent(regNo)}`);
  }

  async function handleStartScan() {
    setScanError("");
    setStatus("starting");

    // Always tear down first — reusing a scanner instance that failed to
    // fully clean up last time is what caused the camera view to vanish
    // and never come back in an earlier version of this page.
    await stopScanner();

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const instance = new Html5Qrcode("qr-reader");
      scannerRef.current = instance;

      await instance.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // An explicit {width, height} keeps the scan box a proper
          // centered square. A bare number (the previous config) makes
          // html5-qrcode derive the box from the raw camera aspect
          // ratio instead, which is what produced the stretched,
          // off-center bracket.
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => handleDecoded(decodedText),
        () => {} // per-frame scan misses — ignore
      );
      setStatus("scanning");
    } catch (err) {
      setStatus("error");
      setScanError("Couldn't access the camera. Check camera permission, or use manual entry below.");
    }
  }

  async function handleStopScan() {
    await stopScanner();
    setStatus("idle");
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) router.push(`/verify/${encodeURIComponent(manualCode.trim())}`);
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Verify Membership</h1>
      <p style={styles.subtitle}>Scan a member's QR code, or enter their registration number.</p>

      {/* Always mounted (never conditionally removed) so html5-qrcode can
          always find it by id — visibility is controlled with CSS only.
          Fixed 1:1 aspect ratio keeps the viewfinder itself square, which
          combined with the square qrbox above keeps the bracket centered
          regardless of the phone's actual camera aspect ratio. */}
      <div
        id="qr-reader"
        style={{
          ...styles.reader,
          height: status === "idle" ? 0 : undefined,
          aspectRatio: status === "idle" ? undefined : "1 / 1",
        }}
      />

      {status === "idle" && (
        <button style={styles.scanBtn} onClick={handleStartScan}>📷 Scan QR Code</button>
      )}
      {status === "starting" && <p style={styles.hint}>Starting camera…</p>}
      {status === "scanning" && (
        <button style={styles.stopBtn} onClick={handleStopScan}>Stop Camera</button>
      )}
      {status === "error" && (
        <>
          <p style={styles.error}>{scanError}</p>
          <button style={styles.scanBtn} onClick={handleStartScan}>Try Again</button>
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
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: "24px 20px", maxWidth: 460, margin: "0 auto", textAlign: "center" },
  title: { fontSize: 22, color: "#1A2E1A", margin: "0 0 4px" },
  subtitle: { color: "#7A7259", fontSize: 14, margin: "0 0 20px" },
  reader: { width: "100%", borderRadius: 12, overflow: "hidden", background: "#000", transition: "height 0.2s ease", marginBottom: 12 },
  scanBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "14px 24px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" },
  stopBtn: { background: "#FBEAEA", color: "#8A1F1F", border: "1px solid #E4B8B8", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  hint: { color: "#7A7259", fontSize: 13, marginTop: 4 },
  error: { color: "#8A1F1F", fontSize: 13, marginBottom: 10 },
  manualForm: { display: "flex", gap: 8, marginTop: 24 },
  input: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 14 },
  button: { background: "#3E8E41", color: "#fff", border: "none", padding: "0 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
};
