# Batch 4 — Fixes the photo upload bug + adds card view/download

## The bug, explained
`@vercel/blob`'s `put()` accepts a Buffer, Blob, or Web `ReadableStream` —
not a raw Node.js `IncomingMessage`. Batch 3 passed `req` straight in,
which isn't one of those, so every upload failed silently (well, not
silently now — that's also fixed). `upload-photo.js` now reads the request
into a `Buffer` first, then hands *that* to `put()`.

## Files in this zip

**Replace existing files with these:**
- `pages/api/admin/upload-photo.js` — the actual fix above, plus it now
  returns a `detail` field with the real error message so failures are
  debuggable instead of generic. Strip `detail` out once this is stable
  and you don't want internals in an API response.
- `pages/admin/index.jsx` — now shows that `detail` in the form's error
  message; also adds a "View card" link per member row.
- `pages/api/admin/members.js` — `GET /api/admin/members?id=<uuid>` now
  returns a single member (used by the new card page below).
- `package.json` — adds `html2canvas`.

**New:**
- `pages/admin/card/[id].jsx` — renders the actual `CardTemplate` for one
  member and a "Download as image" button (PNG, via `html2canvas`,
  loaded only on this page).

## Setup order
```bash
npm install
```
Merge the files, push, redeploy. No new env vars this time.

## Try it
1. Re-attempt the photo upload that failed in your screenshot — it should
   work now. If it still fails, the error message will now tell you why
   instead of just "Photo upload failed."
2. From `/admin`, click "View card" on any member → see the rendered card
   → "Download as image" saves a PNG named after their reg number.

## Still open
- PDF export (image export is done; PDF would go through the same page
  with a server-side renderer if you want it too — say so).
- Role-based permission enforcement.
