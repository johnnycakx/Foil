# Tour 2 — Visual Pass (Cowork, frames only)

**Source:** GKMO5875.MP4 (6:40, ~74 frames reviewed). **No audio in this pass** — the terminal's `/watch` run owns the transcript; reconcile its Round-2 section in TOUR-FINDINGS-2026-07-12.md against this before acting. John narrated this tour, so treat his voice as the primary channel where it conflicts with my frame reads.

## Coverage (much broader than round 1)

Full homepage funnel scroll (hero belt → "Your binder, with a market brain" vault section with per-card "emails you at $X" pockets → "How the chase works" Moonbreon walkthrough → "Foil watches the market" / "$1,845 · 17% under sold avg" → "One email, when it matters" → @FoilTCG "Post your card" X escape hatch → weekly digest) → /start → seeded 1 card → **submitted at 1–4 cards** (success) → kept adding via suggestions to 9 → **re-submitted at 9** → used the **typed search** ("Char…" → Mega Charizard X ex results, +Track) → toured **/pro** ($6/mo, 30-day trial, founding-member rate lock).

## Findings

1. **[Major — REPEAT, round 1 finding 1, still unfixed]** Every suggested card's tag reads "**Foil suggests: un…**" in the grid. Round 2 shows it on 6+ cards across multiple scroll positions. This is now twice-confirmed on device and remains the merge-holding item.
2. **[Major — new, validates SPEC-SLEEVE-SEARCH]** The typed search *works* (query → results → +Track all functioned) but renders as the **old cream-register form rows pasted on the night page** — bright white boxes, form-list look, exactly the "outdated components" John flagged. The cycle-3.5 spec (`design-loop/SPEC-SLEEVE-SEARCH.md`) is the fix; this finding raises its priority. Note: uncatalogued results (Charmeleon/Charmander) correctly render non-trackable.
3. **[Pass — important]** Incremental submit flow: submit at 4 cards → add 5 more → re-submit at 9 produced no visible errors or duplicate states. Server-side dedupe/update behavior appears to hold under the real user pattern (submit early, keep adding).
4. **[Pass]** /pro page live-checks: the free-tier copy propagated ("Free fills a binder page (9 cards)…"), sakura CTA on night register, founding-member framing, "reads real sales" trust line. B5/B6 sweep confirmed in production-shaped reality.
5. **[Note]** Homepage funnel sections all render coherently at 390pt; the vault section's "emails you at $X" pockets and the Moonbreon chase walkthrough are strong. No layout breaks spotted in ~74 frames.
6. **[Cleanup — repeat]** Real email (realjohncraig@icloud.com) used again for submits. Two live watch sets now exist on John's personal address. Decide: dogfood or delete.

## For the reconciliation (once /watch lands)

- John's narration on the rip feel and any hesitations — frames can't capture gesture quality.
- Whether he intended the 4-card submit as a test of partial-fill or hit it accidentally (changes whether the early-submit UX needs an affordance).
- His verdicts on: merge timing (tag fix first?), mascot card, media subdomain, pencil-underline ADR.
