# Youth Party — Membership Card App (first batch)

This is the ground batch: DB schema, verification API + page, admin API
(auth stubbed), and the card component matching the reference design.
Everything below is the exact order of actions to get this running.

## 1. Neon — run the schema
Open your Neon project → SQL Editor → paste and run `schema.sql` (in this
repo's root). This creates `members`, `admins`, and `member_audit_log`.

> The connection string that was shared earlier is now compromised (it was
> pasted in plaintext outside Neon's own UI) — rotate it in Neon →
> Settings → Reset password/connection string before using it anywhere,
> including this deploy.

## 2. GitHub — first push
```bash
git init
git add .
git commit -m "Initial batch: schema, verify API, admin API, card template"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
`.env.local` / `.env` are already git-ignored — never commit the real
`DATABASE_URL`.

## 3. Vercel — import + env vars
1. Vercel → Add New Project → import this GitHub repo.
2. Framework preset: Next.js (auto-detected).
3. Settings → Environment Variables, add for **Production** and **Preview**:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the *new, rotated* Neon connection string |
   | `NEXT_PUBLIC_VERIFY_BASE_URL` | your Vercel URL, e.g. `https://youthparty-cbm.vercel.app` (update after first deploy) |
4. Deploy.

## 4. Smoke test
- Visit `/api/verify/SOME-REG-NO` — expect `{ valid: false, status: "not_found" }` until a member exists.
- Insert a test row directly in Neon's SQL editor, re-check the same URL.
- `/verify/[regNo]` page should render the same result visually.
- `/api/admin/members` will return 401 until real auth replaces the stub in
  `requireAdmin()` — that's intentional, don't skip wiring it in before this
  goes anywhere near the client.

## 5. APK build
Once the Vercel URL is live and stable, follow `CAPACITOR_SETUP.md`.

## What's stubbed / next up
- **Admin auth** — `requireAdmin()` in `pages/api/admin/members.js` accepts
  any bearer token right now. Needs real session/JWT verification next.
- **Admin panel UI** — API exists, no screen yet.
- **Photo upload** — `photo_url` is a plain column; wire it to Vercel Blob
  or S3 and store the resulting URL.
- **Export to image/PDF** — `CardTemplate.jsx` renders; hook up
  `html2canvas` (image) or a server-side renderer (PDF).
