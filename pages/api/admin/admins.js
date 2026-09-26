import { sql } from "../../../lib/db";
import { verifyAdminToken, hashPassword } from "../../../lib/auth";

function requireSuperAdmin(req) {
  const payload = verifyAdminToken(req.cookies?.admin_token);
  if (!payload) {
    const err = new Error("unauthorized");
    err.status = 401;
    throw err;
  }
  if (payload.role !== "super_admin") {
    const err = new Error("Only super admins can manage admin accounts");
    err.status = 403;
    throw err;
  }
  return payload;
}

export default async function handler(req, res) {
  try {
    requireSuperAdmin(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  if (req.method === "GET") {
    const rows = await sql`SELECT id, email, full_name, role, created_at FROM admins ORDER BY created_at DESC`;
    return res.status(200).json({ admins: rows });
  }

  if (req.method === "POST") {
    const { email, password, full_name, role } = req.body || {};

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!["agent", "admin", "super_admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await sql`SELECT id FROM admins WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const password_hash = hashPassword(password);
    const [admin] = await sql`
      INSERT INTO admins (email, password_hash, full_name, role)
      VALUES (${email}, ${password_hash}, ${full_name}, ${role})
      RETURNING id, email, full_name, role, created_at
    `;
    return res.status(201).json({ admin });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
