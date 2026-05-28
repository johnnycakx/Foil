---
target: the home page
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-05-28T19-06-45Z
slug: app-site-page-tsx
---
# Critique — Home page (app/(site)/page.tsx)

## Design Health Score: 30/40 (Good)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | EmailCapture states + aria-live good; pricing CTAs give no signal they only scroll. |
| 2 | Match System / Real World | 2 | H1 sells alerts while product is a deal-finder; "Lock in lifetime" scrolls to a newsletter form, not payment. |
| 3 | User Control and Freedom | 3 | Low-stakes landing; no traps. |
| 4 | Consistency and Standards | 3 | Two button motion systems; one off-ladder rounded-[14px]. |
| 5 | Error Prevention | 3 | type=email + server validation. |
| 6 | Recognition Rather Than Recall | 4 | How-it-works + example result make value obvious. |
| 7 | Flexibility and Efficiency | 3 | Single path, appropriate. |
| 8 | Aesthetic and Minimalist Design | 3 | Strong brand, but repeated email capture + two competing CTAs. |
| 9 | Error Recovery | 3 | Errors surface, but coral-on-cream low contrast + generic copy. |
| 10 | Help and Documentation | 3 | Adequate for a marketing page. |

## Anti-Patterns Verdict
Does NOT look AI-generated. Authored identity (rhombus, cream/navy/gold restraint, editorial display type, magnetic CTA, frosted-binder backdrop, concrete example-result mock). Avoids gradient text + hero-metric template.
Deterministic scan: detect.mjs = 0 findings (exit 0). Structurally clean. All issues are semantic (contrast, motion-a11y, positioning, competing actions) — the class the markup detector can't see.
Visual overlays: no browser-automation tool available; live overlay skipped (honest fallback, not a clean pass).
Borderline: HowItWorks 3-card grid survives only because it is numbered sequential steps; keep it numbered.

## What's Working
1. Restraint reads as premium — matches the "dealer's quiet backroom" North Star.
2. Example-result panel ($313 Charizard mock + grade ladder + grading heads-up) shows the product = "earned trust over persuasion".
3. Email capture state handling is thorough (pending/success/error, aria-live/invalid/describedby, sr-only label).

## Priority Issues

[P1] Accent-on-cream text fails AA contrast.
Gold eyebrow #c9a24b on cream #f8f5f0 ≈ 2.24:1 (needs 4.5:1). Coral error text ≈ 2.6:1 — error copy that most needs reading. DESIGN.md already warns about this.
Fix: navy eyebrow text, gold only in dot/underline/badge; or Gold Deep #a07d2c reserved for large bold. Errors in navy with coral icon/border, not coral text.
Suggested command: /impeccable audit

[P1] Motion ignores prefers-reduced-motion.
Magnetic CTA, live-dot animate-ping, BackgroundGradientAnimation shimmer, Card3D tilt all run unconditionally. Misses the WCAG AA + reduced-motion bar in PRODUCT.md (ADR-029 followup).
Fix: gate each behind prefers-reduced-motion: reduce. Sidecar ds-live snippet shows the pattern.
Suggested command: /impeccable animate

[P2] Hero asks for two things at once.
Primary CTA (Start tracking → /start) + inline newsletter EmailCapture + secondary text link, and the capture reappears in Final CTA. Two competing conversion goals dilute the primary action.
Fix: commit hero to one action (start tracking); demote newsletter lower (Final CTA already has it).
Suggested command: /impeccable distill

[P2] First-screen positioning undersells the product.
H1 frames Foil as a price-drop alerter; PRODUCT.md leads with "find the best live deal now" and the example section proves that.
Fix: lead H1 with deal-finding, make the alert the supporting promise.
Suggested command: /impeccable clarify

[P3] Two motion vocabularies + one off-ladder radius.
Hero CTA = JS magnetic lift; all other buttons = Tailwind translate lift. Inner rounded-[14px] off the 6/8/12/16/24 ladder; p-1 frame edges toward nested container.
Fix: one signature button motion everywhere; snap radius to rounded-xl/2xl.
Suggested command: /impeccable polish

## Persona Red Flags
Maya (mobile collector, primary): hero gives button + email field + link before she understands the product → hesitation. Gold eyebrow unreadable in daylight. Example panel dense at phone width. Came for "is this a good price," H1 talked about email.
Devon (reduced-motion/vestibular): shimmer never stops, dot pulses, CTA lunges, cards tilt in 3D — nothing respects his OS setting.
Jordan (first-timer/skeptic): "Lock in lifetime" just scrolls to a newsletter box, no checkout — trust dip on a trust-thesis brand.

## Minor Observations
- "Level-4 TCGplayer Verified Seller" trust signal buried in slate/80; promote to a badge near H1.
- FeatureIcon enabled check is gold on gold/20 — weak as information.
- Live pill = correct, disciplined glassmorphism use.
- Both pricing CTAs point to same #waitlist anchor; fine pre-Stripe (ADR-020) but not at launch.

## Questions to Consider
- If the hero asked for exactly one action, which earns the first tap — and does the newsletter belong above the fold?
- First three seconds: deal-finder or price-drop alerter? Page says both.
- What if gold appeared exactly three times, each navy-readable?
