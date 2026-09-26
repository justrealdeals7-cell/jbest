import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import CardTemplate from "../../../components/CardTemplate";

export default function CardViewPage() {
  const router = useRouter();
  const { id } = router.query;
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/members?id=${id}`)
      .then((r) => {
        if (r.status === 401) return router.push("/admin/login");
        return r.json();
      })
      .then((data) => {
        if (data?.member) setMember(data.member);
        setLoading(false);
      });
  }, [id]);

  async function handleDownload() {
    if (!cardRef.current) return;
    setExporting(true);
    // Loaded on demand — no need to ship this to every page, only this one.
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = `${member.reg_no}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setExporting(false);
  }

  if (loading) return <p style={styles.msg}>Loading…</p>;
  if (!member) return <p style={styles.msg}>Member not found.</p>;

  const verifyBaseUrl = process.env.NEXT_PUBLIC_VERIFY_BASE_URL || "";

  return (
    <div style={styles.wrap}>
      <button style={styles.backBtn} onClick={() => router.push("/admin")}>← Back to members</button>

      <div ref={cardRef}>
        <CardTemplate
          member={{
            ...member,
            phone_masked: maskPhone(member.phone),
            issued_at: new Date(member.issued_at).toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            }),
          }}
          verifyBaseUrl={verifyBaseUrl}
        />
      </div>

      <button style={styles.downloadBtn} onClick={handleDownload} disabled={exporting}>
        {exporting ? "Preparing…" : "Download as image"}
      </button>
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
  wrap: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  msg: { fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" },
  backBtn: { alignSelf: "flex-start", background: "none", border: "none", color: "#3E8E41", fontWeight: 600, cursor: "pointer", padding: 0 },
  downloadBtn: { background: "#3E8E41", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" },
};
