# Batch 17 — Diagnostics removed, confirmed-working version is now clean

The distance issue confirmed what the frame counter already suggested:
frames were reaching the decoder fine, it was a focus/distance problem,
not a pipeline problem.

## What changed

`pages/verify/index.jsx` — removed:
- The on-screen diagnostic panel (resolution/fps/facing/frame count).
- Every `logEvent(...)` call and the heartbeat interval.

**Kept:** the continuous-autofocus request (`applyConstraints({ advanced:
[{ focusMode: "continuous" }] })`) — that's a real, permanent improvement
for devices that support it, not diagnostic scaffolding, so it stays.

## Optional cleanup

`pages/api/diagnostics/log.js` (added in batch 16) is no longer called
by anything. You can delete it from the repo, or leave it — an unused,
harmless API route that just returns `{ ok: true }` if anything ever
hits it again. Your call, no urgency either way.

## Setup order

```bash
npm install
```
No new packages. Merge `pages/verify/index.jsx`, push, redeploy.
