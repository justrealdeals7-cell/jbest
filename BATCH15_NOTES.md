# Batch 15 — Diagnostics, not another guess

You were right to push back on getting another "should be fixed" claim.
Desktop-works/mobile-doesn't, same browser, is specific enough that
guessing again would just be the same pattern with extra steps. This
batch doesn't claim to fix anything — it adds a visible diagnostic panel
under the camera so your phone's actual behavior is on screen instead of
invisible.

## What it shows, live, while scanning

- **Camera mode** — which of the three constraint attempts actually
  succeeded (exact-environment+1080p, environment+1080p, or plain
  browser default).
- **Actual resolution** — what the phone's camera really delivered, not
  what we asked for. Browsers routinely ignore "ideal" resolution
  requests.
- **Frame rate** — same idea, actual vs requested.
- **Facing mode** — confirms it's actually the rear camera, not front.
- **Frames processed** — a live counter. This is the one that actually
  tells us where the problem lives:
  - **Climbing steadily** while you point it at a real QR code → frames
    ARE reaching the decoder continuously. The problem is decode
    *quality* — focus distance, motion blur, lighting, or the physical
    camera module's macro performance. That's a fixable but different
    problem than anything touched in batches 10–14.
  - **Stuck at 0, or barely moving** → frames are not reaching the
    decoder at all. That points to something more fundamental — the
    video element not actually playing on that device, or the stream
    stalling silently after start() resolves.

## What to actually do

1. Merge this file, push, redeploy (`npm install` — no new packages).
2. On your phone, open Verify ID in Chrome, let the camera start, point
   it at a real card for 5–10 seconds.
3. **Screenshot the diagnostic panel** while doing that (or right after
   it fails to catch anything) and send it over, along with which phone
   model it is.
4. That tells me definitively which of the two categories above we're
   in, and the next change targets that specific thing — not another
   guess across the whole pipeline.

The native/APK path is untouched — this only instruments the plain-
browser scanning path, which is what you're testing right now.
