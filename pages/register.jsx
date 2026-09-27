import { useRef, useState } from "react";
import CardTemplate from "../components/CardTemplate";
import LocationSelects from "../components/LocationSelects";
import { TITLE_OPTIONS, GENDER_OPTIONS } from "../lib/nigeria";

export default function RegisterPage() {
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [member, setMember] = useState(null); // set once registration succeeds
  const [exporting, setExporting] = useState("");
  const cardRef = useRef(null);

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
    setSubmitting(true);

    let photo_url = null;

    if (photoFile) {
      setUploading(true);
      const uploadRes = await fetch("/api/public/upload-photo", {
        method: "POST",
        headers: {
          "Content-Type": photoFile.type || "application/octet-stream",
          "x-filename": photoFile.name,
        },
        body: photoFile,
      });
      setUploading(false);

      if (!uploadRes.ok) {
        const data = await uploadRes.json().catch(() => ({}));
        setError(data.error || "Photo upload failed.");
        setSubmitting(false);
        return;
      }
      const data = await uploadRes.json();
      photo_url = data.url;
    }

    const registerRes = await fetch("/api/public/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, photo_url }),
    });

    setSubmitting(false);

    if (!registerRes.ok) {
      const data = await registerRes.json().catch(() => ({}));
      setError(data.error || "Registration failed.");
      return;
    }

    const data = await registerRes.json();
    setMember(data.member);
  }

  async function renderToCanvas() {
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(cardRef.current, { scale: 2, useCORS: true });
  }

  async function handleDownloadImage() {
    setExporting("image");
    const canvas = await renderToCanvas();
    const link = document.createElement("a");
    link.download = `${member.reg_no}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setExporting("");
  }

  async function handleDownloadPdf() {
    setExporting("pdf");
    const canvas = await renderToCanvas();
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: canvas.height > canvas.width ? "portrait" : "landscape",
      unit: "px",
      format: [canvas.width, canvas.height],
    });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`${member.reg_no}.pdf`);
    setExporting("");
  }

  function handlePrint() {
    if (!cardRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups for this site to print.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${member.reg_no}</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; padding: 24px; font-family: system-ui, sans-serif; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>${cardRef.current.outerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  // ── Success state: show the generated card ──────────────────────────
  if (member) {
    return (
      <div style={styles.wrap}>
        <h1 style={styles.title}>You're registered! 🎉</h1>
        <p style={styles.subtitle}>Save your card below — you'll need it to verify your membership.</p>

        <div ref={cardRef}>
          <CardTemplate
            member={{
              ...member,
              phone_masked: maskPhone(member.phone),
              issued_at: member.issued_at
                ? new Date(member.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                : "",
            }}
            verifyBaseUrl={process.env.NEXT_PUBLIC_VERIFY_BASE_URL || ""}
          />
        </div>

        <div style={styles.btnRow}>
          <button style={styles.downloadBtn} onClick={handleDownloadImage} disabled={!!exporting}>
            {exporting === "image" ? "Preparing…" : "Download as image"}
          </button>
          <button style={styles.downloadBtnAlt} onClick={handleDownloadPdf} disabled={!!exporting}>
            {exporting === "pdf" ? "Preparing…" : "Download as PDF"}
          </button>
        </div>
        <button style={styles.printBtn} onClick={handlePrint}>Print ID</button>
      </div>
    );
  }

  // ── Form state ───────────────────────────────────────────────────────
  return (
    <div style={styles.wrap}>
      <h1 style={styles.title}>Member Registration</h1>
      <p style={styles.subtitle}>Fill in your details to get your membership ID.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.photoField}>
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" style={styles.previewImg} />
          ) : (
            <div style={styles.previewPlaceholder}>No photo</div>
          )}
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>

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

        <button type="submit" disabled={submitting} style={styles.submitBtn}>
          {uploading ? "Uploading photo…" : submitting ? "Registering…" : "Register & get my ID"}
        </button>
      </form>
    </div>
  );
}

function maskPhone(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone;
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: "24px 20px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" },
  title: { fontSize: 22, color: "#1A2E1A", margin: "0 0 4px", textAlign: "center" },
  subtitle: { color: "#7A7259", fontSize: 14, margin: "0 0 20px", textAlign: "center" },
  form: { width: "100%", display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: 12, borderRadius: 8, border: "1px solid #E4D9B8", fontSize: 14, background: "#FFFDF8" },
  photoField: { display: "flex", alignItems: "center", gap: 12, marginBottom: 4 },
  previewImg: { width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #E4D9B8" },
  previewPlaceholder: { width: 64, height: 64, borderRadius: 8, background: "#F0EAD6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#7A7259" },
  error: { color: "#8A1F1F", fontSize: 13, margin: 0 },
  submitBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: 14, borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer", marginTop: 8 },
  btnRow: { display: "flex", gap: 10, marginTop: 16 },
  downloadBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  downloadBtnAlt: { background: "#FBF6E9", color: "#1A2E1A", border: "1px solid #E4D9B8", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
  printBtn: { background: "#1A2E1A", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 8, fontWeight: 700, cursor: "pointer", marginTop: 10 },
};
