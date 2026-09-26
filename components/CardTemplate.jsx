// components/CardTemplate.jsx
// Renders the membership card matching the reference screenshot.
// Export to image: wrap the rendered node with html2canvas.
// Export to PDF: render server-side with @react-pdf/renderer, or pipe this
// same HTML through Puppeteer on a Vercel serverless function.

import { QRCodeSVG } from "qrcode.react"; // npm i qrcode.react

export default function CardTemplate({ member, verifyBaseUrl }) {
  const {
    reg_no,
    full_name,
    title,
    gender,
    phone_masked,
    photo_url,
    occupation,
    origin_state,
    origin_lga,
    reg_state,
    reg_lga,
    ward,
    polling_unit,
    polling_unit_name,
    issued_at,
  } = member;

  const verifyUrl = `${verifyBaseUrl}/verify/${reg_no}`;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.logoRow}>
          <span style={styles.logoText}>PARTY</span>
        </div>
        <p style={styles.tagline}>Shape the Future</p>
      </div>

      <div style={styles.regBox}>
        <p style={styles.regLabel}>REGISTRATION NO.</p>
        <p style={styles.regNo}>{reg_no}</p>
        <p style={styles.regDate}>{issued_at}</p>
      </div>

      <div style={styles.divider} />

      <div style={styles.photoWrap}>
        <img src={photo_url} alt={full_name} style={styles.photo} />
      </div>

      <div style={styles.identityBlock}>
        <p style={styles.name}>{title ? `${title} ` : ""}{full_name}</p>
        <p style={styles.subline}>{gender} | {phone_masked}</p>
      </div>

      <FieldRow label="OCCUPATION" value={occupation} />
      <FieldRow label="ORIGIN" value={`${origin_state} / ${origin_lga}`} />
      <FieldRow label="REG. STATE" value={reg_state} bold />
      <FieldRow label="REG. LGA" value={reg_lga} bold />
      <FieldRow label="WARD" value={ward} bold />
      <FieldRow label="POLLING UNIT" value={polling_unit} bold />
      <FieldRow label="POLLING UNIT NAME" value={polling_unit_name} bold />

      <div style={styles.qrWrap}>
        <QRCodeSVG value={verifyUrl} size={110} />
        <p style={styles.scanLabel}>SCAN TO VERIFY</p>
      </div>
    </div>
  );
}

function FieldRow({ label, value, bold }) {
  return (
    <div style={styles.fieldRow}>
      <span style={styles.fieldLabel}>{label}</span>
      <span style={bold ? styles.fieldValueBold : styles.fieldValue}>{value}</span>
    </div>
  );
}

const styles = {
  card: { width: 380, background: "#FBF6E9", borderRadius: 16, padding: 20, fontFamily: "system-ui, sans-serif", color: "#1A2E1A" },
  header: { marginBottom: 12 },
  logoRow: { display: "flex", alignItems: "center", gap: 6 },
  logoText: { fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "#1A2E1A" },
  tagline: { color: "#3E8E41", fontWeight: 600, margin: "2px 0 0" },
  regBox: { background: "#F3ECD8", border: "1px solid #E4D9B8", borderRadius: 10, padding: "10px 14px", marginBottom: 14 },
  regLabel: { fontSize: 11, color: "#7A7259", margin: 0 },
  regNo: { fontSize: 17, fontWeight: 700, color: "#1A2E1A", margin: "2px 0" },
  regDate: { fontSize: 12, color: "#7A7259", margin: 0 },
  divider: { height: 1, background: "#E4D9B8", margin: "10px 0 16px" },
  photoWrap: { display: "flex", justifyContent: "center", marginBottom: 12 },
  photo: { width: 220, height: 240, objectFit: "cover", borderRadius: 8, border: "1px solid #E4D9B8" },
  identityBlock: { background: "#EAF3E4", borderLeft: "4px solid #3E8E41", borderRadius: 8, padding: "8px 12px", marginBottom: 12 },
  name: { fontWeight: 700, fontSize: 16, margin: 0 },
  subline: { fontSize: 13, color: "#4A5A4A", margin: "2px 0 0" },
  fieldRow: { display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#F3ECD8", borderRadius: 6, marginBottom: 6, fontSize: 13 },
  fieldLabel: { color: "#7A7259" },
  fieldValue: { fontWeight: 500 },
  fieldValueBold: { fontWeight: 700 },
  qrWrap: { display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16 },
  scanLabel: { fontSize: 12, fontWeight: 700, color: "#3E8E41", marginTop: 6 },
};
