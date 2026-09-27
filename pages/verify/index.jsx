import { useEffect, useState } from "react";
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
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let scanner;
    let cancelled = false;

    (async () => {
      // Html5QrcodeScanner (as opposed to the lower-level Html5Qrcode
      // class used in earlier versions of this page) renders its own
      // complete, tested UI — permission prompt, camera picker, scan
      // box sizing, start/stop controls — instead of us reimplementing
      // that by hand. This is the library's own recommended entry point
      // for "let someone scan a QR code" and is what fixes the capture
      // reliability issues the manual version kept running into.
      const { Html5QrcodeScanner, Html5QrcodeScanType } = await import("html5-qrcode");
      if (cancelled) return;

      scanner = new Html5QrcodeScanner(
        "qr-reader",
        {
          fps: 10,
          qrbox: 250,
          rememberLastUsedCamera: true,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        },
        false // verbose logging off
      );

      scanner.render(
        (decodedText) => {
          const regNo = extractRegNo(decodedText);
          scanner.clear().catch(() => {});
          router.push(`/verify/${encodeURIComponent(regNo)}`);
        },
        () => {} // per-frame scan misses — ignore
      );
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.clear().catch(() => {});
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
      <p style={styles.subtitle}>Scan a member's QR code, or enter their registration number.</p>

      {/* Html5QrcodeScanner renders its own UI (permission button,
          camera picker, scan box, start/stop) inside this container. */}
      <div id="qr-reader" style={styles.reader} />

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
  reader: { width: "100%", marginBottom: 16 },
  manualForm: { display: "flex", gap: 8, marginTop: 8 },
  input: { flex: 1, padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 14 },
  button: { background: "#3E8E41", color: "#fff", border: "none", padding: "0 18px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
};
