# Batch 12 — Switched to Html5QrcodeScanner (the fix that should actually stick)

## Why the last two attempts kept having problems

`Html5Qrcode` — what every earlier version of this page used — is
`html5-qrcode`'s **low-level** API. It expects the calling code to get
the container sizing, aspect ratio, and start/stop lifecycle exactly
right, and hands back a live video feed regardless of whether the
decode loop underneath is actually configured correctly. That's why we
saw three different symptoms (vanishing camera, warped scan box, feed
visible but nothing ever decoding) from what was ultimately the same
root cause: we were reimplementing plumbing the library already provides
in a more tested form.

`Html5QrcodeScanner` is that more tested form — it's the library's own
purpose-built component for "let someone scan a QR code." It renders its
own permission prompt, camera picker, scan box, and start/stop controls,
and manages sizing and the decode loop internally. This is what most
production apps using this library actually use; the low-level class is
meant for advanced custom-UI cases, which wasn't really what we needed
here.

## File in this zip

**Replace `pages/verify/index.jsx` entirely** with this version — the
custom Start/Stop buttons and manual scanner lifecycle code are gone;
`Html5QrcodeScanner` handles all of that itself now inside the
`#qr-reader` container. The manual reg-number entry field below it is
unchanged.

## Setup order

```bash
npm install
```
No new packages — `html5-qrcode` is already a dependency, this just uses
a different part of it. Merge the file, push, redeploy.

## What you'll see now

- The scanner area shows the library's own "Request Camera Permissions" /
  camera picker UI on load, in its default (unstyled to match the app's
  cream/green theme) appearance.
- Once scanning starts, its own scan-box overlay appears — properly
  sized and centered, since the library is now doing that calculation
  itself instead of us guessing at container dimensions.
- A successful scan navigates to the verify result page, same as before.

## One cosmetic note

The library's default UI (buttons, dropdown, borders) won't visually
match the rest of the app's styling out of the box — it'll look like a
generic web widget dropped into a themed page. That's a deliberate
trade-off for reliability; `html5-qrcode` does support CSS overrides to
restyle it if you want it to match later, but that's a "make it pretty"
follow-up, not something blocking it from working. Say if you want that
pass.
