import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export default function VerifyScanPage() {
  const router = useRouter();
  const scannerRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [scanError, setScanError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const instance = new Html5Qrcode("qr-reader");
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decodedText) => handleDecoded(decodedText),
          () => {} // per-frame scan misses — ignore
        );
        if (!cancelled) setCameraReady(true);
      } catch (err) {
        if (!cancelled) {
          setScanError("Camera unavailable — use manual entry below.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDecoded(text) {
    let regNo = text.trim();
    try {
      const url = new URL(text);
      const parts = url.pathname.split("/").filter(Boolean);
      regNo = parts[parts.length - 1] || regNo;
    } catch {
      // not a URL — treat the raw scanned text as the reg number
    }
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }
    router.push(`/verify/${encodeURIComponent(regNo)}`);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (manualCode.trim()) router.push(`/verify/${encodeURIComponent(manualCode.trim())}`);
  }

  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Verify Membership</h1>
      <p style={styles.subtitle}>Point the camera at a member's QR code, or enter their registration number.</p>

      <div id="qr-reader" style={styles.reader} />
      {!cameraReady && !scanError && <p style={styles.hint}>Starting camera…</p>}
      {scanError && <p style={styles.error}>{scanError}</p>}

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
  reader: { width: "100%", borderRadius: 12, overflow: "hidden", background: "#000" },
  hint: { color: "#7A7259", fontSize: 13, marginTop: 10 },
  error: { color: "#8A1F1F", fontSize: 13, marginTop: 10 },
  manualForm: { display: "flex", gap: 8, marginTop: 20 },
  input: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 14 },
  button: { background: "#3E8E41", color: "#fff", border: "none", padding: "0 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
};
