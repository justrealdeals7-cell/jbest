# Batch 5 — PDF export + role enforcement

## Files in this zip

**Replace existing files with these:**
- `pages/api/admin/members.js` — enforces the `admins.role` column that's
  existed since batch 2 but did nothing until now: `agent` can create
  members but a `PATCH` to revoke returns `403` for that role. `admin`
  and `super_admin` can still revoke.
- `pages/admin/index.jsx` — fetches the logged-in admin's own role via
  `/api/admin/me`, shows "Logged in as … · role" under the heading, and
  hides the Revoke button for agents (the server blocks it either way —
  this just avoids showing a button that would 403).
- `pages/admin/card/[id].jsx` — adds a second button, "Download as PDF",
  next to the existing image download. Same render pass, just also piped
  through `jsPDF`.
- `package.json` — adds `jspdf`.

## Setup order
```bash
npm install
```
Merge, push, redeploy. No new env vars.

## To make role enforcement actually testable
Right now every admin you've created is `super_admin` (that's what
`create-admin.cjs` sets). To see the `agent` restriction in action, insert
one directly in Neon's SQL editor:
```sql
INSERT INTO admins (email, password_hash, full_name, role)
VALUES ('agent-test@example.com', '<same hash format as before>', 'Test Agent', 'agent');
```
(Ask me for a hash+password pair the same way as your first admin, if you
want one quickly.) Log in as that agent — the Revoke button disappears
from their view, and hitting the API directly with a revoke request
returns 403.

## What's left unbuilt (say if you want any of these next)
- An actual "manage admins" screen — right now creating admins is SQL-only.
- Editing an existing member's fields (currently create + revoke only, no
  edit-in-place).
- Bulk export / CSV of the member list.
