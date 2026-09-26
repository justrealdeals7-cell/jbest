// GET /api/verify/:regNo — public, read-only. Never returns phone/email/full address.
import { sql } from "../../../lib/db";

export default async function handler(req, res) {
  const { regNo } = req.query;

  if (!regNo || typeof regNo !== "string") {
    return res.status(400).json({ valid: false, error: "Missing registration number" });
  }

  try {
    const rows = await sql`
      SELECT reg_no, full_name, status, reg_state, reg_lga, ward, issued_at, revoked_at
      FROM members
      WHERE reg_no = ${regNo}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ valid: false, status: "not_found" });
    }

    const m = rows[0];
    return res.status(200).json({
      valid: m.status === "active",
      status: m.status,
      member: {
        reg_no: m.reg_no,
        name: m.full_name,
        state: m.reg_state,
        lga: m.reg_lga,
        ward: m.ward,
        issued_at: m.issued_at,
        revoked_at: m.revoked_at,
      },
    });
  } catch (err) {
    console.error("verify error", err);
    return res.status(500).json({ valid: false, error: "Internal error" });
  }
}
