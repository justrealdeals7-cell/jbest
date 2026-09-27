import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

// Extracts the registration number whether the QR encodes a full URL,
// a relative path, or the bare code.
function extractRegNo(text) {
  const trimmed = text.trim();
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : trimmed;
}

export default function VerifyScanPage() {
  const router = useRouter();
  const scannerRef = useRef(null);
  const [manualCode, setManualCode] = useState("");
  const [needsTap, setNeedsTap] = useState(false);

  async function startCamera() {
    setNeedsTap(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }

      const instance = new Html5Qrcode("qr-reader");
      scannerRef.current = instance;

      await instance.start(
        { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { fps: 10 }, // no qrbox — scans the entire frame, like an ordinary camera scanner
        (decodedText) => {
          const regNo = extractRegNo(decodedText);
          instance.stop().catch(() => {});
          router.push(`/verify/${encodeURIComponent(regNo)}`);
        },
        () => {} // per-frame scan misses — ignore
      );
    } catch (err) {
      // Some mobile browsers block getUserMedia unless it's triggered by
      // a direct tap the first time. This surfaces a plain "Open Camera"
      // button for exactly that case, instead of failing silently.
      setNeedsTap(true);
    }
  }

  useEffect(() => {
    startCamera();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
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

      <div id="qr-reader" style={styles.reader} />

      {needsTap && (
        <button style={styles.scanBtn} onClick={startCamera}>📷 Open Camera</button>
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
  reader: { width: "100%", minHeight: 280, borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: 12 },
  scanBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", marginBottom: 12 },
  manualForm: { display: "flex", gap: 8, marginTop: 12 },
  input: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 14 },
  button: { background: "#3E8E41", color: "#fff", border: "none", padding: "0 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
};
