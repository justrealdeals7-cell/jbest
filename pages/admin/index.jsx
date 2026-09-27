import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import LocationSelects from "../../components/LocationSelects";
import { TITLE_OPTIONS, GENDER_OPTIONS } from "../../lib/nigeria";

export default function AdminDashboard() {
  const router = useRouter();
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setMe(data.admin))
      .catch(() => router.push("/admin/login"));
  }, []);

  // Single source of truth for reloading: fires whenever the page or the
  // search term changes, debounced only when it's a search keystroke
  // (page changes should feel instant). Typing resets to page 1 in the
  // input's own onChange below, in the same event — so a keystroke is
  // one state update, one effect run, one request, not two.
  useEffect(() => {
    const handle = setTimeout(() => loadMembers(page, search), search ? 300 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  async function loadMembers(pageArg, searchArg) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(pageArg), pageSize: String(pageSize) });
    if (searchArg && searchArg.trim()) params.set("search", searchArg.trim());
    const res = await fetch(`/api/admin/members?${params.toString()}`);
    if (res.status === 401) return router.push("/admin/login");
    const data = await res.json();
    setMembers(data.members || []);
    setTotal(data.total ?? (data.members || []).length);
    setPage(data.page || pageArg);
    setLoading(false);
  }

  function refresh() {
    loadMembers(page, search);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleRevoke(id) {
    if (!confirm("Revoke this member's card? This cannot be undone from here.")) return;
    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "revoked", reason: "Revoked via admin panel" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Could not revoke this member.");
      return;
    }
    refresh();
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  const canRevoke = me?.role === "admin" || me?.role === "super_admin";
  const canEdit = me?.role === "admin" || me?.role === "super_admin";
  const isSuperAdmin = me?.role === "super_admin";

  return (
    <div style={styles.wrap}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Members</h1>
          {me && <p style={styles.whoami}>Logged in as {me.email} · {me.role}</p>}
        </div>
        <div>
          {isSuperAdmin && (
            <Link href="/admin/admins" style={styles.manageLink}>Manage Admins</Link>
          )}
          <button style={styles.addBtn} onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Close" : "+ Add member"}
          </button>
          <button style={styles.logoutBtn} onClick={handleLogout}>Log out</button>
        </div>
      </div>

      {showForm && (
        <AddMemberForm onCreated={() => { setShowForm(false); loadMembers(1, search); }} />
      )}

      <input
        style={styles.searchInput}
        placeholder="Search by name, reg no, state, or LGA…"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
      />

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          {/* Table view (tablet/desktop). Confined to its own scroll
              container — if the columns don't fit, THIS scrolls
              sideways, not the whole page. That's what was pushing the
              header and everything else off-screen on a phone before. */}
          <div className="admin-table-wrap">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Photo</th>
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
                    <td style={styles.td}>
                      {m.photo_url ? (
                        <img src={m.photo_url} alt={m.full_name} style={styles.thumb} />
                      ) : (
                        <div style={styles.thumbPlaceholder} />
                      )}
                    </td>
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
                    <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                      <Link href={`/admin/card/${m.id}`} style={styles.viewLink}>View</Link>
                      {canEdit && (
                        <Link href={`/admin/members/${m.id}/edit`} style={styles.viewLink}>Edit</Link>
                      )}
                      {m.status === "active" && canRevoke && (
                        <button style={styles.revokeBtn} onClick={() => handleRevoke(m.id)}>Revoke</button>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td style={styles.td} colSpan={6}>No members found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Card view (phones) — same data, laid out to actually fit a
              narrow screen instead of shrinking a 6-column table into it. */}
          <div className="admin-cards">
            {members.map((m) => (
              <div key={m.id} style={styles.card}>
                <div style={styles.cardTop}>
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.full_name} style={styles.thumb} />
                  ) : (
                    <div style={styles.thumbPlaceholder} />
                  )}
                  <div style={styles.cardInfo}>
                    <p style={styles.cardName}>{m.full_name}</p>
                    <p style={styles.cardReg}>{m.reg_no}</p>
                    <p style={styles.cardLoc}>{m.reg_state} / {m.reg_lga}</p>
                  </div>
                  <span
                    style={{
                      ...styles.badge,
                      background: m.status === "active" ? "#EAF3E4" : "#FBEAEA",
                      color: m.status === "active" ? "#1A5D1A" : "#8A1F1F",
                    }}
                  >
                    {m.status}
                  </span>
                </div>
                <div style={styles.cardActions}>
                  <Link href={`/admin/card/${m.id}`} style={styles.viewLink}>View</Link>
                  {canEdit && (
                    <Link href={`/admin/members/${m.id}/edit`} style={styles.viewLink}>Edit</Link>
                  )}
                  {m.status === "active" && canRevoke && (
                    <button style={styles.revokeBtn} onClick={() => handleRevoke(m.id)}>Revoke</button>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && <p style={styles.hintText}>No members found.</p>}
          </div>

          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                style={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                ← Prev
              </button>
              <span style={styles.pageLabel}>
                Page {page} of {totalPages} · {total} member{total === 1 ? "" : "s"}
              </span>
              <button
                style={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .admin-table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .admin-cards {
          display: none;
        }
        @media (max-width: 640px) {
          .admin-table-wrap {
            display: none;
          }
          .admin-cards {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </div>
  );
}

function AddMemberForm({ onCreated }) {
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    let photo_url = null;

    if (photoFile) {
      setUploading(true);
      const uploadRes = await fetch("/api/admin/upload-photo", {
        method: "POST",
        headers: {
          "Content-Type": photoFile.type || "application/octet-stream",
          "x-filename": photoFile.name,
        },
        body: photoFile,
      });
      setUploading(false);

      if (!uploadRes.ok) {
        let msg = "Photo upload failed — member was not created.";
        try {
          const errData = await uploadRes.json();
          if (errData?.error) {
            msg = `Photo upload failed: ${errData.error}${errData.detail ? ` (${errData.detail})` : ""}`;
          }
        } catch {
          // response wasn't JSON — keep the generic message
        }
        setError(msg);
        setSaving(false);
        return;
      }
      const uploadData = await uploadRes.json();
      photo_url = uploadData.url;
    }

    await fetch("/api/admin/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, photo_url }),
    });

    setSaving(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} style={styles.formGrid}>
      <div style={styles.photoField}>
        {photoPreview ? (
          <img src={photoPreview} alt="Preview" style={styles.previewImg} />
        ) : (
          <div style={styles.previewPlaceholder}>No photo</div>
        )}
        <input type="file" accept="image/*" onChange={handlePhotoChange} />
      </div>

      <input style={styles.input} placeholder="Full name" value={form.full_name || ""} onChange={(e) => setField("full_name", e.target.value)} />

      <select style={styles.input} value={form.title || ""} onChange={(e) => setField("title", e.target.value)}>
        <option value="">Title</option>
        {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      <select style={styles.input} value={form.gender || ""} onChange={(e) => setField("gender", e.target.value)}>
        <option value="">Gender</option>
        {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>

      <input style={styles.input} placeholder="Phone" value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} />
      <input style={styles.input} placeholder="Email" value={form.email || ""} onChange={(e) => setField("email", e.target.value)} />
      <input style={styles.input} placeholder="Occupation" value={form.occupation || ""} onChange={(e) => setField("occupation", e.target.value)} />

      <LocationSelects label="Origin" form={form} setField={setField} stateKey="origin_state" lgaKey="origin_lga" inputStyle={styles.input} />
      <LocationSelects label="Residence" form={form} setField={setField} stateKey="residence_state" lgaKey="residence_lga" inputStyle={styles.input} />
      <LocationSelects label="Registration" form={form} setField={setField} stateKey="reg_state" lgaKey="reg_lga" inputStyle={styles.input} />

      <input style={styles.input} placeholder="Ward" value={form.ward || ""} onChange={(e) => setField("ward", e.target.value)} />
      <input style={styles.input} placeholder="Polling unit" value={form.polling_unit || ""} onChange={(e) => setField("polling_unit", e.target.value)} />
      <input style={styles.input} placeholder="Polling unit name" value={form.polling_unit_name || ""} onChange={(e) => setField("polling_unit_name", e.target.value)} />

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={saving} style={styles.addBtn}>
        {uploading ? "Uploading photo…" : saving ? "Saving…" : "Create member"}
      </button>
    </form>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900, margin: "0 auto" },
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 },
  title: { color: "#1A2E1A", margin: 0 },
  whoami: { color: "#7A7259", fontSize: 13, margin: "4px 0 0" },
  manageLink: { marginRight: 8, color: "#1A2E1A", background: "#F3ECD8", border: "1px solid #E4D9B8", padding: "8px 14px", borderRadius: 6, fontWeight: 600, textDecoration: "none", fontSize: 13 },
  addBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "8px 14px", borderRadius: 6, fontWeight: 700, cursor: "pointer", marginRight: 8 },
  logoutBtn: { background: "#F3ECD8", color: "#1A2E1A", border: "1px solid #E4D9B8", padding: "8px 14px", borderRadius: 6, cursor: "pointer" },
  searchInput: { width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E4D9B8", marginBottom: 12, boxSizing: "border-box" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 8, borderBottom: "1px solid #E4D9B8", color: "#7A7259", fontSize: 13 },
  td: { padding: 8, borderBottom: "1px solid #F0EAD6" },
  thumb: { width: 40, height: 40, objectFit: "cover", borderRadius: 6 },
  thumbPlaceholder: { width: 40, height: 40, borderRadius: 6, background: "#F0EAD6" },
  badge: { padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 },
  viewLink: { marginRight: 10, color: "#3E8E41", fontWeight: 600, textDecoration: "none", fontSize: 13 },
  revokeBtn: { background: "#FBEAEA", color: "#8A1F1F", border: "1px solid #E4B8B8", borderRadius: 6, padding: "4px 10px", cursor: "pointer" },
  card: { background: "#FFFDF8", border: "1px solid #F0EAD6", borderRadius: 10, padding: 12 },
  cardTop: { display: "flex", alignItems: "flex-start", gap: 10 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { fontWeight: 700, margin: 0, color: "#1A2E1A" },
  cardReg: { margin: "2px 0", fontSize: 13, color: "#4A4433" },
  cardLoc: { margin: 0, fontSize: 12, color: "#7A7259" },
  cardActions: { display: "flex", alignItems: "center", gap: 12, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0EAD6" },
  pagination: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16, flexWrap: "wrap" },
  pageBtn: { background: "#F3ECD8", color: "#1A2E1A", border: "1px solid #E4D9B8", padding: "8px 14px", borderRadius: 6, fontWeight: 600, cursor: "pointer" },
  pageLabel: { color: "#7A7259", fontSize: 13 },
  // auto-fit/minmax instead of a fixed 3-column grid — wraps to fewer
  // columns on a narrow screen instead of squeezing 3 into one that
  // doesn't fit, without needing a separate mobile stylesheet.
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, background: "#FBF6E9", padding: 16, borderRadius: 10, marginBottom: 16, alignItems: "start" },
  input: { padding: 8, borderRadius: 6, border: "1px solid #E4D9B8" },
  photoField: { gridColumn: "span 3", display: "flex", alignItems: "center", gap: 12, marginBottom: 4 },
  previewImg: { width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #E4D9B8" },
  previewPlaceholder: { width: 64, height: 64, borderRadius: 8, background: "#F0EAD6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#7A7259" },
  error: { gridColumn: "span 3", color: "#8A1F1F", fontSize: 13, margin: 0 },
};
