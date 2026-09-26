import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import LocationSelects from "../../../../components/LocationSelects";
import { TITLE_OPTIONS, GENDER_OPTIONS } from "../../../../lib/nigeria";

export default function EditMemberPage() {
  const router = useRouter();
  const { id } = router.query;
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/members?id=${id}`)
      .then((r) => {
        if (r.status === 401) return router.push("/admin/login");
        return r.json();
      })
      .then((data) => {
        if (data?.member) setForm(data.member);
      });
  }, [id]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const fields = {
      full_name: form.full_name, title: form.title, gender: form.gender,
      phone: form.phone, email: form.email, occupation: form.occupation,
      origin_state: form.origin_state, origin_lga: form.origin_lga,
      residence_state: form.residence_state, residence_lga: form.residence_lga,
      reg_state: form.reg_state, reg_lga: form.reg_lga,
      ward: form.ward, polling_unit: form.polling_unit, polling_unit_name: form.polling_unit_name,
    };

    const res = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fields }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save changes.");
      return;
    }

    router.push("/admin");
  }

  if (!form) return <p style={styles.msg}>Loading…</p>;

  return (
    <div style={styles.wrap}>
      <Link href="/admin" style={styles.backLink}>← Back to members</Link>
      <h1 style={styles.title}>Edit {form.full_name}</h1>
      <p style={styles.subtitle}>{form.reg_no}</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <input style={styles.input} placeholder="Full name" value={form.full_name || ""} onChange={(e) => setField("full_name", e.target.value)} required />

        <select style={styles.input} value={form.title || ""} onChange={(e) => setField("title", e.target.value)}>
          <option value="">Title</option>
          {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <select style={styles.input} value={form.gender || ""} onChange={(e) => setField("gender", e.target.value)}>
          <option value="">Gender</option>
          {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <input style={styles.input} placeholder="Phone" value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} />
        <input style={styles.input} type="email" placeholder="Email" value={form.email || ""} onChange={(e) => setField("email", e.target.value)} />
        <input style={styles.input} placeholder="Occupation" value={form.occupation || ""} onChange={(e) => setField("occupation", e.target.value)} />

        <LocationSelects label="Origin" form={form} setField={setField} stateKey="origin_state" lgaKey="origin_lga" inputStyle={styles.input} />
        <LocationSelects label="Residence" form={form} setField={setField} stateKey="residence_state" lgaKey="residence_lga" inputStyle={styles.input} />
        <LocationSelects label="Registration" form={form} setField={setField} stateKey="reg_state" lgaKey="reg_lga" inputStyle={styles.input} />

        <input style={styles.input} placeholder="Ward" value={form.ward || ""} onChange={(e) => setField("ward", e.target.value)} />
        <input style={styles.input} placeholder="Polling unit" value={form.polling_unit || ""} onChange={(e) => setField("polling_unit", e.target.value)} />
        <input style={styles.input} placeholder="Polling unit name" value={form.polling_unit_name || ""} onChange={(e) => setField("polling_unit_name", e.target.value)} />

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" disabled={saving} style={styles.submitBtn}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: "24px 20px", maxWidth: 480, margin: "0 auto" },
  backLink: { color: "#3E8E41", fontWeight: 600, textDecoration: "none", fontSize: 13 },
  title: { fontSize: 20, color: "#1A2E1A", margin: "8px 0 0" },
  subtitle: { color: "#7A7259", fontSize: 13, margin: "0 0 16px" },
  msg: { fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 14, background: "#FFFDF8" },
  error: { color: "#8A1F1F", fontSize: 13, margin: 0 },
  submitBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: 14, borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 },
};
