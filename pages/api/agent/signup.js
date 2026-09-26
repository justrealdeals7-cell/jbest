import { sql } from "../../../lib/db";
import { hashPassword } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { email, password, full_name } = req.body || {};

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await sql`SELECT id FROM admins WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const password_hash = hashPassword(password);

  const [agent] = await sql`
    INSERT INTO admins (email, password_hash, full_name, role)
    VALUES (${email}, ${password_hash}, ${full_name}, 'agent')
    RETURNING id, email, full_name, role
  `;

  return res.status(201).json({ agent });
}
