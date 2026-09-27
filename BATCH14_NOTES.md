# Batch 14 — Real root cause: this needed a native scanner, not another JS tweak

## Why the last four rounds didn't stick

Every prior batch (10 through 13) changed how `html5-qrcode` was configured
inside the browser — qrbox sizing, aspect ratio, auto-start timing, which
part of the library's API was used. All of that logic runs on top of one
browser API: `getUserMedia()`.

That's the part that doesn't work the way it does in a normal mobile
browser once the app is wrapped as an APK. The Android build
(`capacitor.config.ts`) doesn't bundle the site — it opens a WebView
pointed at the live Vercel URL. A plain Android WebView has no built-in
permission prompt for camera access; something native has to grant that
request explicitly, and nothing in this project's Android setup did that.
So inside the APK, `getUserMedia()` was either failing outright or handing
back a stream that never actually carried camera frames — which looks
exactly like "the camera opens but never picks up the code," no matter how
well the decode loop underneath was tuned. This also explains why the
symptom kept slightly changing shape (vanishing camera, warped box, feed
visible but nothing decodes) — same underlying cause, different visible
failure each time depending on the exact JS lifecycle around it.

**This only affects the APK.** Testing the same page in a normal mobile or
desktop browser was likely working fine each round, which is probably why
it kept seeming fixed and then not.

## The actual fix

Stopped trying to make browser camera APIs work inside a wrapped WebView,
and used the standard tool for this instead: a real native camera plugin.
`@capacitor-mlkit/barcode-scanning` (Google ML Kit) opens the device's
actual camera behind the WebView and hands back decoded text directly —
no `getUserMedia()`, no browser permission model involved at all. This is
the normal way QR/barcode scanning is done in Capacitor apps generally,
which is what "camera scanning" means once an app is native-wrapped.

`html5-qrcode` is **not removed** — anyone opening the Vercel URL directly
in a plain browser (not through the APK) still gets the exact batch-13
full-frame scanner, unchanged. `pages/verify/index.jsx` now checks
`Capacitor.isNativePlatform()` at runtime and picks whichever scanner
actually applies:

- **Inside the APK:** native ML Kit scanner. Handles its own camera
  permission request (with a real Android permission dialog this time),
  shows an "Open Settings" button if it was previously denied, and a
  plain viewfinder frame + Cancel button while scanning (there's no
  default UI for this plugin — the camera renders behind the page, so the
  page has to visually get out of the way, done via a CSS class toggled
  on `<body>`).
- **In a browser:** unchanged `html5-qrcode` full-frame scan from batch 13.
- The manual registration-number field is untouched and always available
  either way.

## What else had to change for this to actually work in the APK build

A native camera plugin needs a few things declared in the generated
Android project that weren't there before:

- `android.permission.CAMERA` and `android.permission.FLASHLIGHT` in
  `AndroidManifest.xml` (the old workflow already added `CAMERA` — this
  keeps that and adds `FLASHLIGHT` for the plugin's torch toggle).
- A `<meta-data>` entry telling Play Services which ML Kit model to
  fetch on-device.
- `dataBinding` enabled in `android/app/build.gradle`, which the plugin's
  Android view code requires.

Since this repo doesn't commit the generated `android/` folder (CI runs
`npx cap add android` fresh each build), `.github/workflows/main.yml` now
edits those files with a small Python step instead of the old one-line
`sed` — the manifest's `<application>` tag spans multiple lines, and a
plain `sed` match on it would be fragile. This step now runs **after**
`npx cap sync android` rather than before, so a future `cap sync` change
can't quietly undo it.

## Setup order

```bash
npm install
```

New dependency: `@capacitor-mlkit/barcode-scanning`. `@capacitor/core`
moved from `devDependencies` to `dependencies` in `package.json` — it's
actually used in the browser bundle at runtime (`Capacitor.isNativePlatform()`
on the verify page), not just as build tooling, so it needs to install the
same way in a production build.

No manual Android Studio steps needed — the GitHub Action handles the
manifest/gradle changes on every build. Push this batch, let the "Build
Android APK" workflow run, install the resulting debug APK, and test on a
real device (camera plugins don't work in an emulator without a virtual
camera configured).

## What to test

1. **In the APK:** open Verify → should prompt for camera permission the
   first time (real Android dialog, not silent) → grant it → point at a
   member's card → should navigate straight to the confirmation page with
   member details, same as scanning used to look before any of this
   started.
2. **Deny permission** (or revoke it in Android Settings first) → should
   show "Camera access is off for this app" with a working "Open
   Settings" button, not a blank screen.
3. **In a normal mobile browser**, visiting the Vercel URL directly →
   should behave exactly as it did after batch 13 (full-frame scan, no
   change here).
4. Manual reg-number entry still works in both cases.
