# Batch 9 — Fixes QR verification, adds Print ID

## The bug

The scanner (`pages/verify/index.jsx`) tried `new URL(text)` to pull the
registration number out of whatever the QR code encoded. That only works
if the QR holds a full absolute URL (`https://yourapp/verify/YPM-...`).
If it instead held a relative path (`/verify/YPM-...`) — which happens if
`NEXT_PUBLIC_VERIFY_BASE_URL` was ever empty on a card at the moment it
was generated — `new URL()` throws, and the old code fell back to using
the **entire string**, slashes and all, as the "registration number."
That guarantees every scan looks up a string that doesn't exist in the
database → always shows not found/invalid, regardless of whether the
card is real. That's almost certainly what "not confirming" was.

**Fix:** `extractRegNo()` now just splits on `/` and takes the last
non-empty segment — works identically whether the QR holds a full URL, a
relative path, or a bare code with no slashes at all. No more silent
fallback to the wrong string.

**Also added:** the verification API now matches the registration number
case-insensitively (`upper(reg_no) = upper(...)`), so manually typing a
reg number in the wrong case (lowercase, mixed case) still resolves
correctly.

## Files in this zip

**Replace existing files with these:**
- `pages/verify/index.jsx` — the fix above.
- `pages/api/verify/[regNo].js` — case-insensitive match.
- `pages/admin/card/[id].jsx` — adds a **Print ID** button.
- `pages/register.jsx` — adds a **Print ID** button to the post-registration success view.

## Print ID — how it works

Opens a new tab containing just the card (not the rest of the page),
then calls the browser's native print dialog on it. No new dependencies —
this uses `window.print()`, which every browser already has. The person
can pick "Save as PDF" in the print dialog if they want a file instead of
actual paper, so this effectively gives a second export path alongside
the existing image/PDF downloads.

## Setup order

```bash
npm install
```
Nothing new to install, actually — no new packages in this batch. Just
merge the files, push, redeploy.

## To confirm the verify fix worked

1. Open a member's card (`/admin/card/[id]` or right after a fresh public
   registration).
2. Scan its QR with the Verify ID tab.
3. Should land on `/verify/<their real reg number>` and show "Active Member."
4. Also try typing a reg number by hand in lowercase — should still match.

If scanning still doesn't confirm after this, the next thing to check is
whether `NEXT_PUBLIC_VERIFY_BASE_URL` is actually set in Vercel's
Production environment (not just Preview) — that's what gets baked into
the QR content at build time. Let me know what you see and I'll dig
further.
