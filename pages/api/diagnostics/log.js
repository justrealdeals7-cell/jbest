// POST /api/diagnostics/log — the verify page fires events here so the
// scan lifecycle shows up in Vercel's own Runtime Logs instead of
// requiring a phone screenshot. console.log output from a serverless
// function is exactly what Vercel's Logs tab captures.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  try {
    const { event, data, ua } = req.body || {};
    console.log(
      `[scan] ${event || "unknown"} :: ${JSON.stringify(data || {})} :: ua=${ua || "unknown"}`
    );
  } catch (err) {
    console.error("[scan] failed to log event", err);
  }

  return res.status(200).json({ ok: true });
}
