# Batch 16 — Server-side event logging + the actual focus fix

## Why your last screenshot was actually useful, even though it didn't
   look like it

550 frames processed and climbing = frames ARE reaching the decoder
continuously. That rules out "camera never starts" entirely. What it
left was decode *quality* — and the QR code in your own screenshot was
visibly blurred. That's the real bug: on a lot of Android phones,
`getUserMedia()` only autofocuses once, right when the stream starts,
and never refocuses again even as you move the phone into scanning
position. Native camera apps and native scanner plugins (like the ML
Kit one already used for the APK) use continuous autofocus by default,
which is exactly why "other scanner apps" and the wrapped app's native
path would work fine while this specific browser path struggled.

## Why Vercel logs couldn't show this (explained, not dodged)

Camera capture and QR decoding both run entirely in your phone's
browser — no server request happens during scanning at all, only after
a successful decode. There was nothing in Vercel's logs for this
specific failure because nothing was ever sent to the server while it
was failing. That's not a gap I'm working around; it's just where the
work happens. What follows fixes that going forward.

## What changed

**The actual fix attempt:** after the camera starts, the code checks
whether the device's camera track supports continuous autofocus
(`track.getCapabilities().focusMode`), and if so, explicitly requests it
(`track.applyConstraints({ advanced: [{ focusMode: "continuous" }] })`).
Where the device doesn't support it, the diagnostic panel and the logs
will say so plainly — telling us for certain whether this was available
to try on your specific phone, instead of assuming.

**Server-side logging (what you actually asked for):** every meaningful
step of a scan attempt now POSTs to `pages/api/diagnostics/log.js`,
which `console.log`s it — and `console.log` output from a Vercel
serverless function is exactly what shows up in Vercel's own Logs tab.
Events sent:
- `scan_page_open` — page loaded, native or browser
- `scan_start_attempt` — camera start requested
- `scan_camera_started` — resolution, fps, facing, and autofocus support/applied
- `scan_heartbeat` — every 5s while scanning, with frame count so far
- `scan_success` — decoded, with total frame count
- `scan_camera_error` — camera failed to start, with the real browser error
- `scan_abandoned` — page closed or camera stopped before a successful scan, with frame count and elapsed time

## How to see them

Vercel dashboard → your project → **Logs** (sometimes shown as
"Runtime Logs" depending on your Vercel plan/UI version) → filter or
search for `[scan]` → each line is one event, in order, with a
timestamp. Test on your phone, then go straight to that tab — no
screenshot needed this time, the trail is already there.

## Setup order

```bash
npm install
```
No new packages. Merge both files (`pages/api/diagnostics/log.js` is
new, `pages/verify/index.jsx` replaces the previous version), push,
redeploy.

## What to actually check next

1. Test on your phone again.
2. Check Vercel's Logs tab for the `[scan]` entries — specifically what
   `scan_camera_started` says under "focus" (applied / supported-not-applied / not supported).
3. Try scanning again, holding the phone slightly further back at first
   then slowly moving in (continuous autofocus needs the lens to
   actually re-drive, which starting closer than working distance can
   prevent it from doing cleanly).
4. Tell me what the logs show — if autofocus wasn't supported on that
   device at all, that's the real, final answer, and the remaining
   option is steering people to the app's native scanner (already solid)
   for that device rather than the browser path.
