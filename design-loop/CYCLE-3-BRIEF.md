# Cycle 3 Brief: John's Veto Verdict + Free-Page Entitlement

**Date:** 2026-07-12. **Author:** Claude (Cowork co-pilot), on John's behalf and with his sign-off.
**Status:** This IS the veto verdict for start-binder-delight cycle 2. The cycle-2 commit (`bcdfbb4`) stands; cycle 3 fixes the composition and ships the entitlement change below. John is AFK (gym) — commit, do NOT push; he tours localhost on return.

---

## Part A — Veto verdict on /start (composition punch list)

Cycle 2's mechanics passed (rip, tag-write, heartbeat, mobile harness — all good). The *composition* failed the tour. Fixes, ranked:

**A1. The pack is invisible as an interaction.** It reads as a floating decoration: too small, no tear affordance, no physical grounding. Fix: scale the pack up substantially (it is the hero object), seat it visually (shadow contact / desk relationship with the binder below), make the crimped tear-strip legible at rest, and give it ONE subtle affordance cue (e.g. a single sheen pass or strip glint on load — transform/opacity only, `prefers-reduced-motion` = static, hero must still paint instantly). Acceptance: a first-time visitor at 1440px and at 390px can tell the pack tears *without* reading the aria-label.

**A2. The lamp lights the wrong thing.** The warm glow pool sits behind the H1, reading as a smudge detached from any artifact. Canon: each section's artifact is its light source. Move the lamp pool to belong to the pack/binder scene. The headline needs no glow.

**A3. Empty-sleeve vocabulary: three voices → one.** "tell Foil your grail" (keep — it's the brand voice), "EMPTY" (kill — sterile-enterprise, our own anti-reference), "PRO SLEEVE" ×6+ (kill the wall). Replace the locked-sleeve wall with at most ONE quiet pro affordance: a single locked sleeve or one line of text ("The rest of the binder opens with Pro"). A wall of locked upsell cells before the user seats one card is dark-pattern furniture; binder-desk.tsx's own comment says Pro sleeves must be "furniture … never a trap" — right now they're wallpaper.

**A4. Hierarchy: the demo card outshines the action.** The demo card (ice-white art) is the brightest object on screen while the next action is dim. Options (pick cheapest that works): dim/desaturate the demo card ~15–20% at rest (it brightens on hover — "the cards glow" on *attention*), and/or restyle the dismiss control — the current X overlaps the card frame and reads as browser chrome, not a designed control.

**A5. Hero copy discipline.** Subhead currently does pricing-table work ("Free checks yours once a day. Pro checks hourly."). Move tier mechanics down to the submit area or a quiet line near the Pro affordance (A3). Hero keeps ONE value sentence. Note: this copy changes anyway with Part B — write it once, in the new page language.

**A6. Whisper inflation.** Four italic microcopy lines on one screen. Keep ONE ("tell Foil your grail" in sleeve 2). "Not sure where to start? Foil packed today's most-chased" should become the pack's own label/caption (it points at the pack anyway); "Foil's example. Tap the card to keep it." can lose the italics and live as the demo card's normal meta line.

**A7. "3 sleeves open" counter.** Contradicts the visible grid and does inventory accounting. With Part B it becomes "X of 9 sleeves filled" or just disappears until the first card seats. Prefer the latter: the binder speaks for itself.

**A8. Vertical rhythm.** ~600px of runway before anything touchable. Tighten hero → pack → binder so the binder's top edge is visible above the fold at 1440×900 and the pack sits above the fold at 390×844.

**Not in scope:** no new components, no register changes, no new fonts/colors. This is scale, light, and copy. The rubric axes from cycle 2 apply; mobile 390px harness re-verification required (A1/A8 change layout).

## Part B — Entitlement change: Free = one binder page (9 sleeves)

**Product decision (John, 2026-07-12):** Free tier gets **one full binder page = 9 sleeves** (was 3 cards). Pro ($6/mo) = **more pages** + hourly checks. The metaphor and the entitlement now align: *"Free fills a page. Pro fills the binder."* Use that line (or a tighter variant) as the canonical free-vs-pro copy.

Touchpoints found by grep (verify completeness with `graphify query` — there is a fresh graph in `graphify-out/`):

1. **`components/start/binder-desk.tsx`** — slot cap logic + line ~283: "Free fills 3 sleeves, and yours are full. Pro fills the whole page and checks hourly." → becomes "Free fills this page, and yours is full. Pro opens more pages and checks hourly." Grid should present exactly 9 free sleeves (3×3 page); the demo card occupies sleeve 1 until replaced/kept (it counts toward the 9 only if kept — decide and test).
2. **Server-side enforcement** — wherever the 3-card cap is enforced on submit (app/actions or the /start API route; the funnel-integrity tests reference "the same 3 cards"). The cap moves to 9 **server-side first**, client mirrors it. If no server cap exists, ADD one (9), don't rely on the client.
3. **`lib/stripe.ts` / `lib/entitlements.ts`** — introduce a named constant (e.g. `FREE_PAGE_SLEEVES = 9`) rather than a magic number; `FREE_DAILY_SCAN_LIMIT` (daily scan cadence) is UNCHANGED — free stays daily, pro stays hourly.
4. **Tests** — update funnel-integrity + any test asserting the 3-cap; add: 9 accepted, 10th rejected server-side with the page-full message; duplicate-resubmit idempotency still holds at 9.
5. **Copy sweep** — hero subhead (A5), alert/onboarding emails if they cite the cap, `/pro` page and the V6.5 `pro-conversion-redesign.md` spec's free-vs-pro Card-Ladder table (free row = "1 binder page · 9 cards · daily"), any "Track 3 cards →" CTA instances.
6. **Docs cleanup** — DESIGN.md:258 CTA example ("Track 3 cards →" → "Fill a page →" or current real CTA), PRODUCT.md tier table, README if it states the cap, IDEAS.md entry noting the change + rationale, DECISIONS.md ADR entry (this supersedes the 3-card cap wherever it was decided). Roadmap: amend V6.5/V6.6 items to reflect the 9-card free page so the pro-conversion redesign spec doesn't ship stale numbers.
7. **Watchlist scan cost note (honesty):** this 3×'s free scan volume per user. At current user counts this is noise; record it in the ADR as the accepted cost with the revisit trigger (e.g. "revisit if daily scan cron exceeds X cards or Y minutes").

## Part C — Order of operations & gates

1. Part B server-side cap + constant + tests first (it changes copy Part A touches).
2. Part A composition pass (A1–A8), one commit per coherent beat, cycle-2 gates apply: tsc clean, full tests 0 fail, design:lint 0 new, security-review no High/Medium, Lighthouse mobile ≥ cycle-2 baseline (85) with CLS 0 — do not regress LCP with A1's affordance cue.
3. Copy + docs sweep (B5/B6) last, single commit.
4. Re-run the 390×844 iframe harness for the full rip → seat → tag-write → heartbeat loop AND the new 9-sleeve page.
5. Commit on the `start-binder-delight` branch. **NO PUSH.** Update the roadmap V6.6 entry: cycle 3 in progress → done, veto tour pending. John tours localhost when back from the gym: pack legibility at rest, lamp placement, one-whisper rule, 9-sleeve fill, 10th-card rejection message, phone check.

## Part D — Deferred (do not do this cycle)

- Video-first demo capture scripts (see `design-loop/VIDEO-FIRST-DIRECTION.md`) — next cycle, after this composition settles.
- Geist body-font subset (`mobile-lcp-font-js-floor` part 2) — already filed in IDEAS.md; separate perf beat.
- Tier-2 textures (pencil underline, sleeve edges) — parked pending ADR.
