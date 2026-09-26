import Link from "next/link";
import { UserPlus, QrCode } from "lucide-react";

export default function Home() {
  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.logo}>YP</div>
        <h1 style={styles.partyName}>Youth Party</h1>
        <p style={styles.tagline}>Shape the Future</p>
      </div>

      <div style={styles.manifestoCard}>
        <h2 style={styles.manifestoTitle}>Our Manifesto</h2>
        {/* Placeholder copy — replace with the party's real manifesto text. */}
        <p style={styles.manifestoText}>
          We are building a movement for a new generation of leadership —
          one that puts young people, opportunity, and accountability at
          the centre of governance. We believe in a Nigeria where every
          ward, every LGA, and every state has a voice, and where
          membership means more than a card: it means a seat at the table
          in shaping policies on education, jobs, security, and dignity
          for all.
        </p>
      </div>

      <div style={styles.actionsGrid}>
        <Link href="/register" style={styles.actionCard}>
          <UserPlus size={28} color="#3E8E41" />
          <span style={styles.actionLabel}>Become a Member</span>
          <span style={styles.actionSub}>Register and get your ID</span>
        </Link>
        <Link href="/verify" style={styles.actionCard}>
          <QrCode size={28} color="#3E8E41" />
          <span style={styles.actionLabel}>Verify a Member</span>
          <span style={styles.actionSub}>Scan a card's QR code</span>
        </Link>
      </div>
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: "32px 20px 20px", maxWidth: 480, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 24 },
  logo: {
    width: 64, height: 64, borderRadius: "50%", background: "#3E8E41", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: 22, margin: "0 auto 12px",
  },
  partyName: { fontSize: 26, fontWeight: 800, color: "#1A2E1A", margin: 0 },
  tagline: { color: "#3E8E41", fontWeight: 600, margin: "4px 0 0" },
  manifestoCard: { background: "#FFFDF8", border: "1px solid #E4D9B8", borderRadius: 14, padding: 20, marginBottom: 20 },
  manifestoTitle: { fontSize: 16, color: "#1A2E1A", margin: "0 0 8px" },
  manifestoText: { fontSize: 14, lineHeight: 1.6, color: "#4A5A4A", margin: 0 },
  actionsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  actionCard: {
    display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 6,
    background: "#FFFDF8", border: "1px solid #E4D9B8", borderRadius: 14, padding: "20px 12px",
    textDecoration: "none", color: "#1A2E1A",
  },
  actionLabel: { fontWeight: 700, fontSize: 14 },
  actionSub: { fontSize: 12, color: "#7A7259" },
};
