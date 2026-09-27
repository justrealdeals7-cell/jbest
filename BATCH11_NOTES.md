# Batch 11 — Fixes the misshapen QR scan box

## The bug

`qrbox: 240` (a bare number) tells `html5-qrcode` to derive the scan
region from the raw camera stream's aspect ratio rather than drawing an
actual square — on a lot of phone cameras that aspect ratio is wide
(closer to 16:9 or 4:3), so the computed box came out short and wide,
and positioned based on that math rather than the visible center of
the video — which is exactly the stretched, off-center bracket in your
screenshot.

**Fix:** pass an explicit `{ width: 250, height: 250 }` instead of a bare
number, and add `aspectRatio: 1.0` to the scan config so the requested
camera stream itself is closer to square. The `#qr-reader` container also
now locks to a real `1 / 1` CSS aspect ratio while scanning, so the
visible viewfinder and the calculated scan box agree with each other
regardless of what aspect ratio the phone's camera natively prefers.

## Setup order

```bash
npm install
```
No new packages — just merge `pages/verify/index.jsx`, push, redeploy.

## One separate thing from your screenshot, not a bug

The feed itself looked quite dark/underexposed in that screenshot — that's
just actual low light in the room, not something the app controls. QR
scanning generally needs decent lighting on the code itself; no code
change fixes that, just worth pointing your test scans at a well-lit
card.
