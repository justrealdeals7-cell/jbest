// /api/admin/members — GET (list), POST (create), PATCH (edit/revoke)
// MUST sit behind real auth — requireAdmin() below is a stub. Do not deploy
// this route to a client-facing app until it verifies a real session/JWT.
import { sql } from "../../../lib/db";
import crypto from "crypto";

async function requireAdmin(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) throw new Error("unauthorized");
  // TODO: verify token against your session store / JWT secret, return admin row.
  return { id: "ADMIN_ID_FROM_TOKEN", role: "admin" };
}

function generateRegNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `YPM-${date}-${suffix}`;
}

export default async function handler(req, res) {
  let admin;
  try {
    admin = await requireAdmin(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const rows = await sql`SELECT * FROM members ORDER BY created_at DESC LIMIT 200`;
    return res.status(200).json({ members: rows });
  }

  if (req.method === "POST") {
    const body = req.body;
    const reg_no = generateRegNo();

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
        ${body.captured_via || "admin-entry"}
      )
      RETURNING *
    `;

    await sql`
      INSERT INTO member_audit_log (member_id, admin_id, action, detail)
      VALUES (${member.id}, ${admin.id}, 'created', ${JSON.stringify({ by: admin.id })})
    `;

    return res.status(201).json({ member });
  }

  if (req.method === "PATCH") {
    const { id, status, reason } = req.body;

    if (status) {
      await sql`
        UPDATE members
        SET status = ${status},
            revoked_at = ${status === "revoked" ? new Date().toISOString() : null},
            revoked_reason = ${status === "revoked" ? reason : null}
        WHERE id = ${id}
      `;
      await sql`
        INSERT INTO member_audit_log (member_id, admin_id, action, detail)
        VALUES (${id}, ${admin.id}, ${status === "revoked" ? "revoked" : "edited"}, ${JSON.stringify({ status, reason })})
      `;
    }

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ error: "Method not allowed" });
}
