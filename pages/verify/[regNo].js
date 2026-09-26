import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function VerifyPage() {
  const router = useRouter();
  const { regNo } = router.query;
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!regNo) return;
    fetch(`/api/verify/${regNo}`)
      .then((r) => r.json())
      .then(setResult)
      .finally(() => setLoading(false));
  }, [regNo]);

  if (loading) return <p style={styles.msg}>Checking membership status…</p>;
  if (!result) return <p style={styles.msg}>Something went wrong.</p>;

  return (
    <div style={styles.wrap}>
      <div
        style={{
          ...styles.badge,
          background: result.valid ? "#EAF3E4" : "#FBEAEA",
          color: result.valid ? "#1A5D1A" : "#8A1F1F",
        }}
      >
        {result.valid ? "✓ Active Member" : `✗ ${(result.status || "not valid").replace("_", " ")}`}
      </div>
      {result.member && (
        <div style={styles.card}>
          <p style={styles.name}>{result.member.name}</p>
          <p>{result.member.reg_no}</p>
          <p>
            {result.member.state} / {result.member.lga} — {result.member.ward}
          </p>
          <p style={styles.small}>
            Issued {result.member.issued_at ? new Date(result.member.issued_at).toLocaleDateString() : "—"}
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 380, margin: "0 auto" },
  msg: { fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" },
  badge: { padding: "12px 16px", borderRadius: 10, fontWeight: 700, textAlign: "center", marginBottom: 16 },
  card: { background: "#FBF6E9", borderRadius: 12, padding: 16 },
  name: { fontWeight: 700, fontSize: 18, margin: 0 },
  small: { color: "#7A7259", fontSize: 12 },
};
