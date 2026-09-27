# Batch 13 — Auto-start camera, full-frame scanning, no extra UI

Sorry for the back-and-forth on this one. This version is a full reset
to what you actually described wanting.

## What changed

- **Camera opens automatically** when the page loads — no button tap
  required to trigger it.
- **No qrbox crop region.** This is the real fix for "code not read":
  every earlier version restricted decoding to a small box (250x250px)
  and expected you to line the QR code up inside it exactly. If that box
  was slightly mis-sized or mis-positioned (which it was, across a couple
  of earlier attempts), or you simply weren't holding the code dead
  center in a small region, decoding would never succeed even with a
  perfectly clear live feed — which matches exactly what you saw. Now it
  scans the **entire camera frame**, same as a normal camera-based QR
  reader (WhatsApp, Google Lens, etc.) — point it anywhere in frame and
  it decodes.
- **No "Stop Scanning" button, no camera picker dropdown** — that was
  `Html5QrcodeScanner`'s own injected UI from the last version, which
  wasn't what you wanted. Back to a plain camera view with nothing extra.
- **The "Open Camera" button only appears if auto-start fails** — some
  mobile browsers block the camera from starting automatically without a
  direct tap the first time. If that happens, a plain button shows up as
  the fallback; otherwise it's never visible.
- **Reg No. field is always there**, exactly as before, whether or not
  the camera is working.
- Also requests a higher camera resolution (1280x720 instead of
  whatever low default the browser might pick) — small QR codes decode
  more reliably at higher resolution.

## Setup order

```bash
npm install
```
No new packages. Merge `pages/verify/index.jsx`, push, redeploy.

## What to test

Point it at a real card's QR code anywhere in the visible frame (not a
specific box) — should route straight to the confirm/verify page.
