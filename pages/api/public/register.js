// POST /api/public/register — anyone can call this; it's the self-service
// registration form. Always tagged captured_via = 'self-registration'.
import { sql } from "../../../lib/db";
import crypto from "crypto";

function generateRegNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `YPM-${date}-${suffix}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const body = req.body || {};

  if (!body.full_name || !body.full_name.trim()) {
    return res.status(400).json({ error: "Full name is required" });
  }

  const reg_no = generateRegNo();

  try {
    const [member] = await sql`
      INSERT INTO members (
        reg_no, full_name, title, gender, photo_url, phone, email, occupation,
        origin_state, origin_lga, residence_state, residence_lga,
        reg_state, reg_lga, ward, polling_unit, polling_unit_name, captured_via
      ) VALUES (
        ${reg_no}, ${body.full_name}, ${body.title}, ${body.gender}, ${body.photo_url},
        ${body.phone}, ${body.email}, ${body.occupation},
        ${body.origin_state}, ${body.origin_lga}, ${body.residence_state}, ${body.residence_lga},
        ${body.reg_state}, ${body.reg_lga}, ${body.ward}, ${body.polling_unit}, ${body.polling_unit_name},
        'self-registration'
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO member_audit_log (member_id, admin_id, action, detail)
      VALUES (${member.id}, NULL, 'created', ${JSON.stringify({ by: "self-registration" })})
    `;

    return res.status(201).json({ member });
  } catch (err) {
    console.error("public register error", err);
    return res.status(500).json({ error: "Registration failed — please try again." });
  }
}
