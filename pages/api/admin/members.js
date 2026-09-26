// /api/admin/members — GET (list w/ optional ?search=, or single via ?id=),
// POST (create), PATCH (edit status OR arbitrary fields)
// Auth: reads the admin_token httpOnly cookie set by /api/admin/login.
// Role rule: 'agent' can create members but cannot revoke or edit fields —
// field edits and revoking require 'admin' or 'super_admin'.
import { sql } from "../../../lib/db";
import { verifyAdminToken } from "../../../lib/auth";
import crypto from "crypto";

const EDITABLE_FIELDS = [
  "full_name", "title", "gender", "photo_url", "phone", "email", "occupation",
  "origin_state", "origin_lga", "residence_state", "residence_lga",
  "reg_state", "reg_lga", "ward", "polling_unit", "polling_unit_name",
];

function requireAdmin(req) {
  const payload = verifyAdminToken(req.cookies?.admin_token);
  if (!payload) throw new Error("unauthorized");
  return payload;
}

function generateRegNo() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `YPM-${date}-${suffix}`;
}

export default async function handler(req, res) {
  let admin;
  try {
    admin = requireAdmin(req);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const { id, search } = req.query;

    if (id) {
      const rows = await sql`SELECT * FROM members WHERE id = ${id} LIMIT 1`;
      if (rows.length === 0) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ member: rows[0] });
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const rows = await sql`
        SELECT * FROM members
        WHERE full_name ILIKE ${term} OR reg_no ILIKE ${term}
           OR reg_state ILIKE ${term} OR reg_lga ILIKE ${term}
        ORDER BY created_at DESC LIMIT 200
      `;
      return res.status(200).json({ members: rows });
    }

    const rows = await sql`SELECT * FROM members ORDER BY created_at DESC LIMIT 200`;
    return res.status(200).json({ members: rows });
  }

  if (req.method === "POST") {
    const body = req.body || {};
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
      VALUES (${member.id}, ${admin.id}, 'created', ${JSON.stringify({ by: admin.email })})
    `;

    return res.status(201).json({ member });
  }

  if (req.method === "PATCH") {
    const { id, status, reason, fields } = req.body || {};

    if (!id) return res.status(400).json({ error: "Member id is required" });

    // ── Status change (revoke/reinstate) ──────────────────────────────
    if (status) {
      if (status === "revoked" && admin.role === "agent") {
        return res.status(403).json({ error: "Agents cannot revoke members — ask an admin." });
      }

      await sql`
        UPDATE members
        SET status = ${status},
            revoked_at = ${status === "revoked" ? new Date().toISOString() : null},
            revoked_reason = ${status === "revoked" ? reason : null}
        WHERE id = ${id}
      `;
      await sql`
        INSERT INTO member_audit_log (member_id, admin_id, action, detail)
        VALUES (${id}, ${admin.id}, ${status === "revoked" ? "revoked" : "edited"}, ${JSON.stringify({ status, reason, by: admin.email })})
      `;
      return res.status(200).json({ ok: true });
    }

    // ── Field edit ─────────────────────────────────────────────────────
    if (fields) {
      if (admin.role === "agent") {
        return res.status(403).json({ error: "Agents cannot edit member details — ask an admin." });
      }

      const updates = {};
      for (const key of EDITABLE_FIELDS) {
        if (key in fields) updates[key] = fields[key];
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No editable fields provided" });
      }

      // Column names come only from EDITABLE_FIELDS above (never from the
      // request body directly), so sql.unsafe() here is interpolating a
      // trusted identifier, not user input — values are still parameterized.
      const fragments = Object.entries(updates).map(
        ([key, value]) => sql`${sql.unsafe(key)} = ${value}`
      );
      let setClause = fragments[0];
      for (let i = 1; i < fragments.length; i++) {
        setClause = sql`${setClause}, ${fragments[i]}`;
      }
      await sql`UPDATE members SET ${setClause} WHERE id = ${id}`;

      await sql`
        INSERT INTO member_audit_log (member_id, admin_id, action, detail)
        VALUES (${id}, ${admin.id}, 'edited', ${JSON.stringify({ fields: updates, by: admin.email })})
      `;
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Nothing to update" });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ error: "Method not allowed" });
}
