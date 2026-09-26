import { sql } from "../../../lib/db";
import { verifyPassword, signAdminToken } from "../../../lib/auth";
import { serialize } from "cookie";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const rows = await sql`SELECT * FROM admins WHERE email = ${email} LIMIT 1`;
  const admin = rows[0];

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signAdminToken(admin);

  res.setHeader(
    "Set-Cookie",
    serialize("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12h, matches JWT expiry
    })
  );

  return res.status(200).json({
    ok: true,
    admin: { id: admin.id, email: admin.email, full_name: admin.full_name, role: admin.role },
  });
}
