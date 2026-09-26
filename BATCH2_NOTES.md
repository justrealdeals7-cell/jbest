# Batch 2 — Admin auth + admin panel UI

## Files in this zip and what to do with each

**New files — add as-is:**
- `lib/auth.js`
- `pages/api/admin/login.js`
- `pages/api/admin/logout.js`
- `pages/api/admin/me.js`
- `pages/admin/login.jsx`
- `pages/admin/index.jsx`
- `scripts/create-admin.cjs`

**Replace the existing file with this version:**
- `pages/api/admin/members.js` — now reads the real session cookie instead of
  the placeholder bearer-token stub from batch 1.
- `package.json` — adds `bcryptjs`, `jsonwebtoken`, `cookie`, `dotenv`, and a
  `create-admin` script.
- `.env.example` — adds `JWT_SECRET`.

## Setup order

1. **Merge these files into the repo**, then:
   ```bash
   npm install
   ```

2. **Vercel** — add one new env var (Production + Preview):
   | Key | Value |
   |---|---|
   | `JWT_SECRET` | output of `openssl rand -base64 48` |

3. **Create the first admin.** Locally, with `DATABASE_URL` in `.env.local`:
   ```bash
   npm run create-admin -- you@example.com "some-strong-password" "Your Name"
   ```
   This hashes the password with bcrypt before it ever touches the DB —
   never insert a plaintext password into the `admins` table directly.

4. **Push and redeploy** on Vercel (env var changes need a redeploy to take
   effect if you added `JWT_SECRET` after the last deploy).

5. **Log in** at `/admin/login` with the email/password from step 3. You'll
   land on `/admin` — a table of members with "Add member" and "Revoke".

## What changed in behavior

- `/api/admin/members` now returns 401 unless a valid `admin_token` cookie
  is present (set only by a successful `/api/admin/login`).
- Sessions last 12 hours, then re-login is required.
- Every create/revoke is still written to `member_audit_log`, now tagged
  with the real admin's email instead of a placeholder ID.

## Still stubbed / next up
- **Photo upload** — `photo_url` is still a plain text field in the add-member
  form; wiring an actual upload (Vercel Blob/S3) is the next logical batch.
- **Export to image/PDF** — `CardTemplate.jsx` renders the card but isn't
  wired to a download button yet.
- **Role restrictions** — `admins.role` exists (`super_admin`/`admin`/`agent`)
  but every role currently has identical permissions; no UI enforces it yet.
