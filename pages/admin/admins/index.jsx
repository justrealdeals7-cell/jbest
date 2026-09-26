import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ManageAdmins() {
  const router = useRouter();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/admins");
    if (res.status === 401) return router.push("/admin/login");
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setAdmins(data.admins || []);
    setLoading(false);
  }

  if (forbidden) {
    return (
      <div style={styles.wrap}>
        <Link href="/admin" style={styles.backLink}>← Back to members</Link>
        <p style={styles.msg}>Only super admins can manage admin accounts.</p>
      </div>
    );
  }

  if (loading) return <p style={styles.msg}>Loading…</p>;

  return (
    <div style={styles.wrap}>
      <Link href="/admin" style={styles.backLink}>← Back to members</Link>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Admins & Agents</h1>
        <button style={styles.addBtn} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Close" : "+ Add account"}
        </button>
      </div>

      {showForm && <AddAdminForm onCreated={() => { setShowForm(false); load(); }} />}

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Role</th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td style={styles.td}>{a.full_name}</td>
              <td style={styles.td}>{a.email}</td>
              <td style={styles.td}><span style={styles.badge}>{a.role}</span></td>
            </tr>
          ))}
          {admins.length === 0 && <tr><td style={styles.td} colSpan={3}>No accounts yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AddAdminForm({ onCreated }) {
  const [form, setForm] = useState({ role: "agent" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create account");
      return;
    }
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} style={styles.formGrid}>
      <input style={styles.input} placeholder="Full name" value={form.full_name || ""} onChange={set("full_name")} required />
      <input style={styles.input} type="email" placeholder="Email" value={form.email || ""} onChange={set("email")} required />
      <input style={styles.input} type="password" placeholder="Temporary password (min 8 chars)" value={form.password || ""} onChange={set("password")} required minLength={8} />
      <select style={styles.input} value={form.role} onChange={set("role")}>
        <option value="agent">Agent</option>
        <option value="admin">Admin</option>
        <option value="super_admin">Super Admin</option>
      </select>
      {error && <p style={styles.error}>{error}</p>}
      <button type="submit" disabled={saving} style={styles.addBtn}>{saving ? "Creating…" : "Create account"}</button>
    </form>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 700, margin: "0 auto" },
  backLink: { color: "#3E8E41", fontWeight: 600, textDecoration: "none", fontSize: 13 },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 0 16px" },
  title: { color: "#1A2E1A", margin: 0 },
  msg: { fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" },
  addBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontWeight: 700, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 8, borderBottom: "1px solid #E4D9B8", color: "#7A7259", fontSize: 13 },
  td: { padding: 8, borderBottom: "1px solid #F0EAD6" },
  badge: { padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: "#EAF3E4", color: "#1A5D1A" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, background: "#FBF6E9", padding: 16, borderRadius: 10, marginBottom: 16, alignItems: "start" },
  input: { padding: 8, borderRadius: 6, border: "1px solid #E4D9B8" },
  error: { gridColumn: "span 2", color: "#8A1F1F", fontSize: 13, margin: 0 },
};
