// Usage: node -r dotenv/config scripts/create-admin.cjs <email> <password> "<Full Name>"
// Requires DATABASE_URL in .env.local (or pass it inline: DATABASE_URL=... node scripts/create-admin.cjs ...)
require("dotenv").config({ path: ".env.local" });
const { neon } = require("@neondatabase/serverless");
const bcrypt = require("bcryptjs");

async function main() {
  const [, , email, password, fullName] = process.argv;

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.cjs <email> <password> "<Full Name>"');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (check .env.local)");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const password_hash = bcrypt.hashSync(password, 10);

  const rows = await sql`
    INSERT INTO admins (email, password_hash, full_name, role)
    VALUES (${email}, ${password_hash}, ${fullName || email}, 'super_admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id, email, full_name, role
  `;

  console.log("Admin ready:", rows[0]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
