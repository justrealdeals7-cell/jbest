import Link from "next/link";

export default function AgentLanding() {
  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Agent Access</h1>
      <p style={styles.subtitle}>
        Agents register new members on behalf of the party. You'll need an
        account to get started.
      </p>

      <Link href="/admin/login" style={styles.primaryBtn}>Log in</Link>
      <Link href="/agent/signup" style={styles.secondaryBtn}>Create an agent account</Link>
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: "40px 24px", maxWidth: 420, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 12 },
  title: { fontSize: 22, color: "#1A2E1A", margin: "0 0 4px" },
  subtitle: { color: "#7A7259", fontSize: 14, margin: "0 0 12px" },
  primaryBtn: { background: "#3E8E41", color: "#fff", padding: "12px 20px", borderRadius: 8, fontWeight: 700, textDecoration: "none" },
  secondaryBtn: { background: "#FFFDF8", color: "#1A2E1A", border: "1px solid #E4D9B8", padding: "12px 20px", borderRadius: 8, fontWeight: 700, textDecoration: "none" },
};
