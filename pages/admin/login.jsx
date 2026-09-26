import { useState } from "react";
import { useRouter } from "next/router";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setError(data.error || "Login failed");
    }
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1 style={styles.title}>Admin Login</h1>
        {error && <p style={styles.error}>{error}</p>}
        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#FBF6E9", fontFamily: "system-ui, sans-serif" },
  form: { background: "#fff", padding: 32, borderRadius: 12, width: 320, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  title: { marginTop: 0, color: "#1A2E1A" },
  input: { display: "block", width: "100%", padding: 10, marginBottom: 12, borderRadius: 6, border: "1px solid #E4D9B8", boxSizing: "border-box" },
  button: { width: "100%", padding: 10, background: "#3E8E41", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" },
  error: { color: "#8A1F1F", fontSize: 13 },
};
