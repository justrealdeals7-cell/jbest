# Batch 10 — Manual "Scan QR Code" button, fixes the vanishing camera

## What changed

`pages/verify/index.jsx` no longer auto-starts the camera on page load.
Instead:

- Page opens showing a **"📷 Scan QR Code"** button and the manual entry
  field — camera isn't touched until you tap it.
- Tapping it always tears down any previous scanner instance first
  (`stop()` + `clear()`, swallowing errors either way), *then* creates a
  brand-new one and starts it. That "always start clean" step is the
  actual fix — the old auto-start-on-mount version had no way to recover
  if a previous attempt left the camera in a half-stopped state, which is
  what caused the view to disappear and never come back.
- While scanning, a **"Stop Camera"** button appears to end the session
  manually (releases the camera, doesn't just hide the video).
- If the camera fails to start (denied permission, no camera, anything),
  you get an error message and a **"Try Again"** button — same clean
  restart logic.

The `#qr-reader` element is always present in the page (never
conditionally mounted/unmounted) — only its height changes via CSS. This
matters because `html5-qrcode` looks up that element by id when
`start()` is called, and having it disappear and reappear from the DOM
was one of the things that could leave it in a broken state.

## Setup order

```bash
npm install
```
No new packages — just merge `pages/verify/index.jsx`, push, redeploy.

## What to test

1. Open Verify ID → tap "Scan QR Code" → scan a card → confirms correctly.
2. Tap "Stop Camera" mid-scan → camera released, button flips back to
   "Scan QR Code" → tap it again → camera starts fresh, no lingering issue.
3. Deny camera permission (or test somewhere without a camera) → should
   show the error + "Try Again" rather than a silent blank screen.
