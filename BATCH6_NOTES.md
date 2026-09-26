# Batch 6 — Public app shell, registration, agent signup, QR scanner, admin management, edit + search, dropdowns

This is the large batch covering both what was queued before the Blob
detour (admin management, member editing, search) and the new mobile-app
shell request (home page, register tab, agent tab, verify/QR tab, bottom
nav). Nothing from the earlier queue was dropped.

## New files — add as-is

**App shell:**
- `components/BottomNav.jsx` — the 5-tab bottom bar (Home, Register, Verify ID, Admin, Agent), native-app style.
- `pages/_app.js` — wraps every page with the bottom nav. This is why every page in the app (including login, admin, agent) now shows the tab bar.
- `lib/nigeria.js` — 36 states + FCT, their LGAs, title options, gender options.
- `components/LocationSelects.jsx` — reusable State→LGA dependent dropdown pair, used everywhere a location is captured.

**Public registration:**
- `pages/register.jsx` — public self-registration form (dropdowns for Title/Gender/State/LGA), uploads a photo, then shows the generated card in-page with download buttons — no login needed.
- `pages/api/public/register.js` — public endpoint, always tags `captured_via = 'self-registration'`.
- `pages/api/public/upload-photo.js` — public photo upload, capped at 5MB, image-only.

**Verify tab (QR scanner):**
- `pages/verify/index.jsx` — camera-based QR scanner with a manual reg-number fallback. Decodes the QR, extracts the reg number (works whether the QR encodes the full verify URL or a bare reg number), and routes to the existing `pages/verify/[regNo].js` result page (unchanged, from batch 2 — still there, still public).

**Agent self-signup:**
- `pages/agent/index.jsx` — landing: log in or sign up.
- `pages/agent/signup.jsx` — email/password signup, auto-logs in afterward.
- `pages/api/agent/signup.js` — public endpoint, creates an `admins` row with `role = 'agent'`.

**Admin management (queued before the Blob detour):**
- `pages/api/admin/admins.js` — list/create admin accounts. **super_admin only.**
- `pages/admin/admins/index.jsx` — the UI for the above.

**Member editing (also queued before the detour):**
- `pages/admin/members/[id]/edit.jsx` — prefilled edit form, same dropdowns as registration.

## Replace existing files with these

- `pages/index.js` — was the placeholder home page, now the branded home: logo, party name, manifesto block, and two quick-action tiles. **The manifesto text is placeholder copy** — swap it for the real thing in the same file (`pages/index.js`, the `manifestoText` paragraph).
- `pages/admin/index.jsx` — adds: a search box (client-side filter over name/reg no/state/LGA), an "Edit" link per row, a "Manage Admins" link (shown only to `super_admin`), and the Add-Member form's Title/Gender/State/LGA fields are now dropdowns instead of free text.
- `pages/api/admin/members.js` — the PATCH endpoint now handles two things: `{ id, status }` (unchanged, revoke/reinstate) and the new `{ id, fields }` (arbitrary field edits). Both agent-role restrictions apply: agents can't revoke *or* edit fields, same reasoning as before. GET now also accepts `?search=`.
- `package.json` — adds `html5-qrcode` (QR scanning) and `lucide-react` (nav icons).

## Setup order

```bash
npm install
```
Merge everything in, push, redeploy. **No new environment variables** — this batch is all app code.

## What to try

1. Visit the home page — logo, manifesto, two tiles.
2. Tap **Register** — fill the form (note the dependent State→LGA dropdowns), submit, see your card render in-page with download buttons, no login involved.
3. Tap **Verify ID** — allow camera access, scan a card's QR (or type a reg number manually) — lands on the existing result page.
4. Tap **Agent** → **Create an agent account** — signs up, auto-logs in, lands on `/admin` with the agent role restrictions from batch 5 still in force (no Revoke button, no Edit link).
5. Log in as a `super_admin` → **Manage Admins** link now appears next to "+ Add member" → create admin/agent accounts through the UI instead of SQL.
6. From the members table, **Edit** a member — dropdowns are prefilled with their current values.

## Known limitations, on purpose (say if you want any addressed next)

- **No CAPTCHA or rate limiting** on the public register/upload/agent-signup endpoints. Fine for a controlled rollout; if this URL gets shared widely, add rate limiting before that happens — a bot could spam-create member or agent records.
- **No email verification** on agent signup — an account is live the instant the form is submitted. Add a verification step if that matters for your trust model.
- **Ward and Polling Unit stay free text** — there's no reliable, embeddable public dataset at that granularity (thousands of wards/polling units nationally), unlike State/LGA which are a fixed, small set.
- **The manifesto is placeholder text** — flagged above, one edit to fix.
- LGA spellings follow the most common community dataset; if any look wrong for your state, they're plain array edits in `lib/nigeria.js`.
