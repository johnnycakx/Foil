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

---

## Update 2026-06-27 — Collectrics has grown from a valuation lab into a full analytics platform

**Re-observed at mycollectrics.com (live).** Since the 2026-06-01 snapshot, the "IQ Price Lab"
slider tool has expanded into a broad **Pokémon market-analytics platform**: a market-trends
dashboard (blended SV + Mega Evolution, 30-day, raw/ungraded), **card + sealed leaderboards**,
**set EV** ("expected raw value per pack"), a **pack-rip odds + EV calculator**, a **ripping
simulator** (coming soon), a **graded-impact** view, a **PSA 10 premium change leaderboard**,
**community polls**, and a live **store** ("premium features / themes / expansions" = freemium
monetization is already on). Many charts still read "not enough history to chart yet" → the data
is still accumulating; the platform is **early but shipping fast**.

**Who's behind it (confirmed):** **PokeDataDadGuy** (YouTube `@PokeDataDadGuy`; about page links
his channel `@TheDayFamilyProject`). A **data analyst by trade**, Pokémon-collector dad, **new to
YouTube** ("just a few months"), with at least one viral video ("cracked the code to speculating
Pokémon cards" — a data-model-for-chase-cards angle). **Same profile as John:** a solo,
data-literate builder shipping fast. Treat as a real peer competitor, not a hobby project.

**Core wedge clarified:** Collectrics answers "**is ripping this set +EV / what should I
collect**" (pack-EV, rip odds, set-EV) plus **macro market analytics**. Foil answers "**is THIS
specific card a good buy right now**" (per-card live eBay deal + buy-signal + wishlist alert).
The 2026-06-01 lane separation **holds** — and his structural gap is unchanged: **no live eBay
listings**, so he structurally cannot do the live best-listing per card. That live-deal signal is
Foil's **structural product wedge**, NOT the moat itself. The **moat is the owned email audience**
(north star: 10k engaged subscribers, see `STRATEGY-AUDIENCE-MOAT.md`); the buyer-intent deal signal
is the differentiated top-of-funnel that feeds that list and that he can't replicate.

**Threat reassessment (up from June 1):** bigger, because (a) he ships fast and has already
**monetized** (store live), and (b) he has a **YouTube distribution engine** feeding the tool —
the exact muscle Foil is building right now via X + newsletter. Overlap is the market-trends /
leaderboard surface, the "data-driven Pokémon" brand, SEO/content territory, and the audience.

**Posture (reinforced, unchanged):** do NOT chase the EV / valuation / rip-sim game (different
job, different data — we have no pull rates). Out-distribute on the **buyer-side live-deal axis +
the email moat**, and **borrow his content framings** (below), not his product.

### Borrowable CONTENT framings (computable from data Foil already holds)
All of these are X/newsletter content angles, not new product surfaces. Per
[grading-leaderboard-data-sources.md](grading-leaderboard-data-sources.md), PokeTrace already
gives us raw + the full PSA ladder (incl. PSA 10) + `saleCount` + daily history. The population/
gem-rate gap noted there does NOT block these — the premium story needs only PSA-10 vs raw prices,
both of which we have.
- **"Biggest PSA 10 premium movers this week"** — cards whose PSA-10-over-raw premium jumped most. Shareable, on-brand, weekly cadence.
- **"Graded vs raw gap" leaderboard** — cards where PSA 10 is worth the largest multiple over raw. Evergreen series.
- **"Sets heating up / cooling off"** — roll the existing card-level `market_movers` up to set level. Cheap; we already compute card movers.
- **Community polls on X** — low-lift engagement lever (drives reach, amplified by Premium reply-boost). He uses polls; we can too.
- **A "fair price for this card" mini-calculator** as a newsletter lead-magnet analog to his pack-EV calculator (uses our sold-average data; complements the cheat-sheet PDF).

### Do NOT borrow (still true)
Pack-EV / pull-rate engine + ripping simulator (we have no pull-rate data; different product),
the valuation sliders, character-premium subjectivity (fights [ADR-048](DECISIONS.md) voice). Our
**calm, anti-hype, numbers-first** voice is also a live differentiator vs. his warm "dad +
positivity" register and the broader speculation-hype crowd.

### Monetization signal
His **live freemium store** (premium features / themes / expansions) is a working proof that a
**data-tool freemium** model can monetize in this niche — a useful reference point for Foil's
later Pro-tier thinking (today: affiliate-primary).
