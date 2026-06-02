# Competitor: Collectrics IQ Price Lab

**Source:** pokedatadadguy — https://youtube.com/watch?v=0s0YMFOsrjY
**Date observed:** 2026-06-01

> Hand-authored competitive intel (not the script-generated [competitive-gaps.md](competitive-gaps.md)).

## Product summary

Multi-factor valuation model estimating a "fair" price vs market. Inputs: character premium, universal appeal (Google Trends), grading intensity (PSA pop / pull rates / time), demand pressure, pull cost, months-since-release, scarcity score, grading lag. UX: adjustable sliders + a leaderboard of undervalued cards.

## Lane separation

Collectric = a **valuation platform** answering "what should I collect long-term?" Foil = a **deal finder** answering "is this eBay listing right now a good buy?" Different products, adjacent users.

## Threat

Discovery beats search for casual users. A leaderboard of undervalued cards is sticky; per-card lookup is not. If users get used to finding deals on Collectric, Foil becomes a slower step.

## Counter-move (B.4 candidate, gated on #10)

**Live-deal leaderboard:** sort all curated cards by current buy-signal BELOW magnitude. Uses live asks (Collectric structurally can't — it's not pulling live eBay). Natively in Foil's moat. Gated on ROADMAP #10 (eBay Growth-Check ceiling lift) for the same Browse-quota reason as [#32.2](ROADMAP.md) — a leaderboard ranking by live BELOW needs a live ask per card.

## Reference-enrichment candidates (not pivots, just signal augmentation)

- **Grading intensity (PSA pop / time):** free data, useful where the 30-day sold sample is thin.
- **In/out-of-print status:** rotated manually per set release.
- **Pack scarcity / cost tracking:** cheap scrape, high signal.

## Do not steal

- **Character premium** (subjective, fights [ADR-048](DECISIONS.md) brand voice).
- **Adjustable sliders** (no natural inputs for a comparison-based signal).
- **Full multi-factor model now** (Foil's 1-input MVP just survived three rounds of de-risking — #32 / #32.1 / #32.3).

## Stealable UX patterns

- **Per-card "why" explanation inline** — use the #32.3 data Claude Code already surfaces (inferred condition + matched tier + delta).
- **Honest subjectivity framing** ("if you disagree, adjust") — fits ADR-048.

## Strategic posture

Don't pivot to valuation. Out-discover on the live-deal axis. Stay in lane.
