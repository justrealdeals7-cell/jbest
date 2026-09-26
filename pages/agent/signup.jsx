import { useState } from "react";
import { useRouter } from "next/router";

export default function AgentSignup() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const signupRes = await fetch("/api/agent/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!signupRes.ok) {
      const data = await signupRes.json().catch(() => ({}));
      setError(data.error || "Sign up failed");
      setSubmitting(false);
      return;
    }

    // Auto-login right after signup so there's no extra step.
    const loginRes = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password }),
    });

    setSubmitting(false);
    router.push(loginRes.ok ? "/admin" : "/admin/login");
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1 style={styles.title}>Agent Sign Up</h1>
        {error && <p style={styles.error}>{error}</p>}
        <input style={styles.input} placeholder="Full name" value={form.full_name} onChange={set("full_name")} required />
        <input style={styles.input} type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input style={styles.input} type="password" placeholder="Password (min 8 characters)" value={form.password} onChange={set("password")} required minLength={8} />
        <button style={styles.button} type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", fontFamily: "system-ui, sans-serif" },
  form: { background: "#fff", padding: 32, borderRadius: 12, width: 320, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" },
  title: { marginTop: 0, color: "#1A2E1A" },
  input: { display: "block", width: "100%", padding: 10, marginBottom: 12, borderRadius: 6, border: "1px solid #E4D9B8", boxSizing: "border-box" },
  button: { width: "100%", padding: 10, background: "#3E8E41", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" },
  error: { color: "#8A1F1F", fontSize: 13 },
};
