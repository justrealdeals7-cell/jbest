# Batch 3 — Real photo upload (replaces the photo_url text field)

## Files in this zip

**New:**
- `pages/api/admin/upload-photo.js` — admin-only endpoint, streams the
  uploaded file straight to Vercel Blob storage, returns a public URL.

**Replace existing files with these:**
- `pages/admin/index.jsx` — the "Add member" form now has a real file
  picker with a live preview instead of a `photo_url` text box. On submit
  it uploads the photo first, then creates the member with the returned
  Blob URL.
- `package.json` — adds `@vercel/blob`.

Nothing changes in `schema.sql` or `CardTemplate.jsx` — `photo_url` was
already just a text column and an `<img src>`; only *how it gets filled in*
changed.

## Setup order

1. **Enable Blob storage on the Vercel project** (one-time):
   Vercel dashboard → your project → **Storage** tab → **Create Database**
   → **Blob**. Connect it to this project. Vercel automatically adds a
   `BLOB_READ_WRITE_TOKEN` env var — you don't type this one in yourself.

2. **Merge these files into the repo:**
   ```bash
   npm install
   ```

3. **Push and redeploy.** Once the Blob store is connected, no extra env
   var setup is needed beyond what Vercel added automatically.

4. **Local dev** (only if you run this outside Vercel): pull the Blob token
   down with `vercel env pull .env.local` so `BLOB_READ_WRITE_TOKEN` exists
   locally too — uploads will fail without it.

## What to expect

- Adding a member now shows a photo picker with a thumbnail preview.
- On submit: photo uploads to Blob first (button shows "Uploading photo…"),
  then the member record is created with that URL.
- The members table now shows a small thumbnail per row.
- If the upload fails, the member is **not** created — no member without
  a photo gets silently saved with a blank field. If you want photo to be
  optional instead of implicitly required, say so and I'll adjust the API
  to allow skipping it.

## Still open
- Export the card as image/PDF (`CardTemplate.jsx` renders, no download
  button wired yet).
- Role-based permission enforcement (`admins.role` exists, unused so far).
