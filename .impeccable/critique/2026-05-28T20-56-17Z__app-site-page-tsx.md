---
target: the home page (deployed)
total_score: 34
p0_count: 0
p1_count: 0
timestamp: 2026-05-28T20-56-17Z
slug: app-site-page-tsx
---
# Critique (re-run, deployed) — Home page (foiltcg.com / app/(site)/page.tsx)

## Design Health Score: 34/40 (Good) — up from 30/40

| # | Heuristic | Score | Change | Note |
|---|-----------|-------|--------|------|
| 1 | Visibility of System Status | 3 | = | EmailCapture states solid; pricing CTAs still scroll to #waitlist (pre-Stripe, ADR-020). |
| 2 | Match System / Real World | 3 | +1 | H1 now leads with deal-finding; "Lock in lifetime"->#waitlist mismatch remains (deferred pre-Stripe). |
| 3 | User Control and Freedom | 3 | = | Low-stakes landing. |
| 4 | Consistency and Standards | 4 | +1 | Radius snapped to ladder; button color-hover unified (magnetic translate now intentional hero-only). |
| 5 | Error Prevention | 3 | = | type=email + server validation. |
| 6 | Recognition Rather Than Recall | 4 | = | How-it-works + example result. |
| 7 | Flexibility and Efficiency | 3 | = | Single path, appropriate. |
| 8 | Aesthetic and Minimalist Design | 4 | +1 | Hero now one primary action; newsletter demoted to a link. |
| 9 | Error Recovery | 4 | +1 | Error text now navy + coral icon (AA-readable), was coral-on-cream ~2.6:1. |
| 10 | Help and Documentation | 3 | = | Adequate for a marketing page. |

## Verdict
Both P1s (contrast, reduced-motion) and both P2s (competing hero CTAs, H1 positioning) from the 30/40 baseline are resolved. Deterministic detector still 0 findings. Deployed HTML confirms the fixes are live.

Note: the Nielsen score (34) understates the accessibility win — the contrast + reduced-motion fixes are WCAG-AA gains that don't all map onto a usability heuristic. A pure a11y audit would move further than the +4 here.

## Remaining (known, deferred)
- Pricing CTAs both scroll to #waitlist (intentional pre-Stripe per ADR-020; revisit at launch).
- Browser-overlay visual evidence unavailable in this environment (no browser-automation tool); this re-run used live WebFetch HTML + detector against the deployed commit.
- /start + /upload still carry the coral-error-text + slate/60 placeholder patterns (ROADMAP followup).
