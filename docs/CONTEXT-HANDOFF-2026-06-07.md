> 🗄️ **ARCHIVED / SUPERSEDED (2026-07-06)** — historical record, kept per the never-delete rule. Not current state. See [HOME.md](HOME.md) · index: [archive/README.md](archive/README.md).

# Cowork session handoff — 2026-06-07 (READ THIS FIRST)

Replaces CONTEXT-HANDOFF-2026-06-05.md. Captures end-of-day state after the architecture-pivot session of 2026-06-06/07. New Claude Code / Cowork sessions: read this, then the docs listed at the bottom.

## TL;DR

Architecture pivot day. A production trust bug (the English Typhlosion page surfaced + redirected to a JAPANESE listing) ended the era of layered patches. John's standing verdict: **build 100% correctly and architecturally scalable, no more small fixes.** The response: a design-first **verified-listing resolver** (the backbone), probed, designed, approved, and goal #1 SHIPPED (dark) same day. Separately, the GSC/sitemap discovery gap was found and fixed. **X bot is PAUSED** until the backbone reaches user-facing clicks.

## What shipped (all pushed to origin/main)

1. `d9339c2` fix(seo) — /deals + /pricing-methodology added to sitemap.xml (live-verified, 1,025 URLs). The sitemap module is now `lib/seo/sitemap-landings.ts` with a test.
2. `41bc158` docs — ROADMAP reconciled with PLAN-2026-06-05. ADR-059 (utility-first positioning, subscription-ready, never paywall the funnel).
3. `09ed775` docs — the three 2026-06-05 strategy source docs committed so ADR-059's links resolve.
4. `0902632` docs — DESIGN-VERIFIED-LISTING-RESOLVER.md (the approved design) + probe-findings-listing-aspects-2026-06-06.md (build-step-0).
5. `436831c` feat(listing) — **resolver core + calibration (Tranche A #1, ships dark).** `lib/listing/{normalize,identity,resolve}.ts`, the single `resolveVerifiedListing(cardId, condition)` boundary. Picker demoted to pre-filter. No consumer wired yet.

## The architecture (see DESIGN-VERIFIED-LISTING-RESOLVER.md — the canonical doc)

- **Root cause of the Typhlosion bug:** two brains — the PICKER (title-only, chooses what users see/click) and the CLASSIFIER (aspect-gated, decides what counts as a deal) never shared a correctness standard. ADR-026/053/057 each hardened one layer while the next stayed blind.
- **The fix:** ONE resolver. Identity verification (Set + Number + Finish + Language + Graded, via getItem aspects) is the only admission gate. Title parsing pre-filters, never admits. Null beats unverified-cheapest, always.
- **Demand-driven:** resolves at page-visit time for ANY catalog card (tier distinction retired for live listings). Quota spends on visitors, not catalog size. /deals becomes budgeted rotation + visitor feed. §4 quota portfolio: visitors / rotation ~750 / wishlist / bot line ~near-zero (crawlers get the baked TCGplayer offer — rich results preserved without eBay calls).
- **Two tranches:** A = #0–#3 (probe ✅, resolver core ✅, per-card page, redirect + wishlist) — committed; **X bot may unpause after #3.** B = #4–#7 (board rotation, variants, tier retirement, budget guard) — GATED on a John checkpoint after Tranche A.

## Calibration results (docs/calibration-resolver-2026-06.md)

207 cards × k=4, ~1,550 live calls. **Coverage: 66.7–68.1% raw, 72.3% defensible, ~85% on the post-fix base1 slice.** ~55 rejects hand-audited: dominant false-reject driver was a **catalog-data bug, not the resolver** — the 16 `base2-*` (Base Set 2 / Jungle?) entries carry corrupted baked metadata (`base2-1-clefable` = setName "Jungle", number "1" vs market's 17). One genuine normalizer false-reject found + fixed (base→"Base Set" alias; roman-numeral version tokens). IDEAS entry captured: identity gates double as a catalog-QA probe.

## In flight at handoff time

- **base2 catalog reconciliation** — John kicked this off in Claude Code at end of session (2026-06-07 ~00:00 PT). Check the top of SESSION-LOG.md for its outcome. It is the #2 prerequisite: fixing it reintroduces the recoverable coverage.

## Decision gates (John)

1. **Goal #2 (per-card page migration)** — go/no-go after reviewing coverage + false-reject numbers post-base2-fix. Expect an honest "no verified listing" on ~15–30% of curated cards; fewer-but-true is the product.
2. **Goal #3 (redirect + wishlist)** — mechanical after #2. Then X bot creds + spending cap + live flip (runbook: docs/runbooks/x-bot.md).
3. **Tranche B** — only after A closes and John reviews.
4. **eBay Growth Check** — do NOT submit yet (usage ~8% of ceiling, eBay requires "approaching the limit"). The resolver ramp + real traffic builds the evidence. Re-evaluate after Tranche A.

## John's manual TODOs

- **Mercury:** email verified, approval expected ~Monday 2026-06-08. BEFORE approval: fix the 2710 vs 3710 home-address mismatch across Stripe + Mercury. After: connect Mercury→Stripe, clear verify-business, live mode ready.
- **GSC:** sitemap resubmitted 2026-06-06 (Google last-read was stale at 209 URLs vs 1,025 live). 10 priority URLs got Request Indexing (quota ~10/day) — round 2 candidates: /newsletter, more top cards. Check indexing mid-week. The 3 "page with redirect" failures are canonical-variant noise (www/http → apex), NOT a bug. The 7 "crawled not indexed" are _next/static assets, noise.
- **X bot:** PAUSED (John's call, correct). Do not set creds/flip live until Tranche A #3 ships.

## New workflow (2026-06-06)

Goals are no longer pasted into chat. Cowork writes the next goal to **docs/goals/NEXT-GOAL.md** (gitignored, transient). John types into Claude Code: `Read docs/goals/NEXT-GOAL.md and execute it as a /goal`. Cowork (Claude strategy session) is the goal author + reviewer; Claude Code builds.

## Read these next (in order)

CLAUDE.md → this handoff → docs/DESIGN-VERIFIED-LISTING-RESOLVER.md → docs/calibration-resolver-2026-06.md → top of docs/SESSION-LOG.md → docs/ROADMAP.md. Supporting: docs/probe-findings-listing-aspects-2026-06-06.md, docs/PLAN-2026-06-05.md, docs/BUSINESS-MODEL-2026-06-05.md.
