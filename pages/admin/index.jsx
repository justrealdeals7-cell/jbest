import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function AdminDashboard() {
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const res = await fetch("/api/admin/members");
    if (res.status === 401) return router.push("/admin/login");
    const data = await res.json();
    setMembers(data.members || []);
    setLoading(false);
  }

  async function handleRevoke(id) {
    if (!confirm("Revoke this member's card? This cannot be undone from here.")) return;
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "revoked", reason: "Revoked via admin panel" }),
    });
    loadMembers();
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Members</h1>
        <div>
          <button style={styles.addBtn} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "+ Add member"}
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Log out</button>
        </div>
      </div>

      {showForm && (
        <AddMemberForm onCreated={() => { setShowForm(false); loadMembers(); }} />
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Reg No.</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>State/LGA</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td style={styles.td}>{m.reg_no}</td>
                <td style={styles.td}>{m.full_name}</td>
                <td style={styles.td}>{m.reg_state} / {m.reg_lga}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      background: m.status === "active" ? "#EAF3E4" : "#FBEAEA",
                      color: m.status === "active" ? "#1A5D1A" : "#8A1F1F",
                    }}
                  >
                    {m.status}
                  </span>
                </td>
                <td style={styles.td}>
                  {m.status === "active" && (
                    <button style={styles.revokeBtn} onClick={() => handleRevoke(m.id)}>Revoke</button>
                  )}
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td style={styles.td} colSpan={5}>No members yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddMemberForm({ onCreated }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onCreated();
  }

  const fields = [
    ["full_name", "Full name"], ["title", "Title"], ["gender", "Gender"],
    ["phone", "Phone"], ["email", "Email"], ["occupation", "Occupation"],
    ["origin_state", "Origin state"], ["origin_lga", "Origin LGA"],
    ["residence_state", "Residence state"], ["residence_lga", "Residence LGA"],
    ["reg_state", "Reg. state"], ["reg_lga", "Reg. LGA"],
    ["ward", "Ward"], ["polling_unit", "Polling unit"], ["polling_unit_name", "Polling unit name"],
    ["photo_url", "Photo URL"],
  ];

  return (
    <form onSubmit={handleSubmit} style={styles.formGrid}>
      {fields.map(([key, label]) => (
        <input
          key={key}
          placeholder={label}
          style={styles.input}
          value={form[key] || ""}
          onChange={set(key)}
        />
      ))}
      <button type="submit" disabled={saving} style={styles.addBtn}>
        {saving ? "Saving…" : "Create member"}
      </button>
    </form>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { color: "#1A2E1A" },
  addBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontWeight: 700, cursor: "pointer", marginRight: 8 },
  logoutBtn: { background: "#F3ECD8", color: "#1A2E1A", border: "1px solid #E4D9B8", padding: "8px 14px", borderRadius: 6, cursor: "pointer" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 8, borderBottom: "1px solid #E4D9B8", color: "#7A7259", fontSize: 13 },
  td: { padding: 8, borderBottom: "1px solid #F0EAD6" },
  badge: { padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 },
  revokeBtn: { background: "#FBEAEA", color: "#8A1F1F", border: "1px solid #E4B8B8", borderRadius: 6, padding: "4px 10px", cursor: "pointer" },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, background: "#FBF6E9", padding: 16, borderRadius: 10, marginBottom: 16 },
  input: { padding: 8, borderRadius: 6, border: "1px solid #E4D9B8" },
};
