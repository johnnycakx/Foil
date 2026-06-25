# Strategy: Data-Insight Engine (+ EU / Cardmarket expansion)

**Created:** 2026-06-24 · **Status:** strategy (upstream of goals) · **Author:** John Craig, with Cowork
**Companion to:** [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) · [newsletter-business-playbook.md](knowledge/newsletter-business-playbook.md) · the [subscriber-growth-loop charter](goals/subscriber-growth-loop.md) · [ADR-064](DECISIONS.md) (dual-track)

## Thesis

One **data → insight → distribution flywheel**: a reliable daily-refreshed pricing/market dataset feeds a *single* insight layer ("what's interesting today" — movers, anomalies, best deals), which fans out to all three surfaces: the **newsletter**, the **/deals board**, and **X**. One brain, three outputs — not three separate engines.

---

## The insight-led reframe (2026-06-25) — market movers over single listings

**Motivating bug (John, 2026-06-25).** The live `/deals` board flagged "Umbreon VMAX 215/203 · Near Mint · $2,161 · 31% below sold," but the listing it pointed to was a **£1,000 (~$1,316), Lightly Played, UK** card via the Global Shipping Program. The signal matched an LP/UK/GBP listing against an NM/USD comp — most of the "31% below" is just the LP-vs-NM discount + currency, not a real deal. This is the inherent fragility of a **single-listing** signal: one mismatched condition/region/currency publishes a *false* deal, which on a trust-first brand is the worst failure mode.

**The reframe: lead with market-level movement, not single listings.** "NM Umbreon VMAX 215/203 is down 12% vs its 30-day average → good-buy candidate" is an **aggregate** — it cannot be broken by one mispriced listing. This:
- **Fixes the fragility by construction** — aggregates don't depend on per-listing matching.
- **Upgrades the value prop** from "coupon finder" (commodity, fragile) to **"the Pokémon-card market analyst"** (owned insight). This is the playbook's "sell insight, not commodity," a stronger email-list moat + a cleaner Pro path, and a better fit for the research-intent audience.
- **Keeps affiliate, repositioned.** The click moves from "buy this exact listing" to a card-level "browse NM [card] on eBay" affiliate *search* link. Affiliate becomes the monetization *of* the insight, not the product. Net-aligned with the moat strategy.

**Feasibility — buildable now, no snapshot store required for v1.** PokeTrace's by-uuid endpoint already returns **avg1d / avg7d / avg30d** per card per condition. A v1 momentum signal = `avg7d below avg30d by ≥ threshold, with adequate saleCount → trending down / good-buy candidate`. The daily-snapshot store (below) still adds value later (week-over-week, longer trends, fewer API calls) but is NOT a blocker for the first market-movers signal.

**Implication: PokeTrace is now CORE, not optional.** The entire insight layer runs on PokeTrace's aggregate windows. This turns the re-subscribe decision from "maybe, for /deals freshness" into "yes, this is the engine," and elevates the ~July-15 key lapse from a minor deadline to a **load-bearing** one. (Only the secondary single-listing board + live eBay survive a PokeTrace lapse; the insight product does not.)

**Single-listing deals are demoted, not deleted.** Keep the per-listing "below sold" board as a *secondary* surface — but tighten its like-for-like gate (condition + region/currency) so the Moonbreon class of false deal stops shipping. The **lead** product across newsletter, the headline `/deals` view, and X becomes **market movers / good buys**.

---

## Current data layer — inventory (2026-06-24, code-grounded)

**External sources actually called:**
- **eBay Browse API** — live listings; free; `cache: "no-store"` (R-008, never cached). The live-ask side.
- **PokeTrace** — the pricing spine. Returns per-source aggregates for **ebay + tcgplayer + cardmarket** (`POKETRACE_SOURCES`), plus a daily **price-history** endpoint per tier. **Cardmarket/EU is already pulled** (EU-only cards surface via cardmarket). ⚠️ Pro tier gates EU + graded + commercial use. **Cancelled 2026-06-16; key valid ~until July 15.**
- **PriceCharting** — graded ladder only (PSA/BGS/CGC). **Cancelled** at the same time.
- **Pokémon TCG SDK** — catalog metadata (name/set/image/number); free; 24h cache + baked fallback.
- **Scrydex** — NOT wired; pricing unverifiable (docs 403). A question mark, not a ready option.

**What's persisted (Supabase):** `buy_signals` (deal classification, **UPSERT/overwrite per card — current-state only**), `pricecharting_id_map` (cache), `browse_calls` (telemetry log), `watchlists`, `scans`. **There is NO time-series price table.** Daily price history lives **only inside PokeTrace**, fetched on-demand (1h cache), never stored in Foil.

**Insight computed today:** none beyond point-in-time (live ask vs 30-day sold average). **No movers / momentum / velocity / anomaly detection exists.**

**Refresh:** `deals-refresh` cron daily 08:00 UTC (was disabled 06-13→06-24 during the vending pivot; restored in today's dual-track push — should self-heal on the next run); `wishlist-alerts` hourly; `browse-telemetry` daily 06:00 UTC.

---

## Two corrections the inventory forced (vs the original idea)

1. **EU/Cardmarket is "surface it," not "build it."** The Cardmarket data is *already pulled* through PokeTrace — Foil just never exposes it (no market toggle, no EU pages). So EU expansion is far cheaper than assumed on the *data* side; the work is surfacing + i18n + monetization, not a new integration. The gate is the **PokeTrace Pro tier** (EU is Pro-gated) — i.e. the subscription just cancelled.
2. **"What's moving" is impossible today — nothing accumulates.** `buy_signals` overwrites daily; price history is never persisted. The insight layer the vision needs (movers, trends, anomalies) **requires a new daily-snapshot store** first. This is the real foundational gap, more than the agent itself.

---

## Target architecture

```
SOURCES                         STORE (new)              INSIGHT (new, daily)        DISTRIBUTION
PokeTrace (spine: ebay/      →  daily snapshot table  →  one "interesting today"  →  newsletter draft
  tcgplayer/cardmarket          (per card · per           job: top movers ↑↓,         /deals board
  + history; Pro = EU/graded)   source · per day,         anomalies (raw vs           X bot
eBay Browse (live ask, free)    append-only)              graded), best below-sold
SDK (catalog, free)                                       deals, restock/rotation
```

One insight set per day, stored, consumed by all three surfaces. The [subscriber-growth-loop](goals/subscriber-growth-loop.md) is what would later optimize this.

---

## Decisions to settle (the planning, before any spend)

- **D1 — Data vendor.** PokeTrace is the known spine and already does Cardmarket/EU + daily history; Scrydex is unverified (403) and its EU coverage is unknown. **Recommendation: re-commit to PokeTrace (Pro) as the spine when the data path is a confirmed priority; evaluate Scrydex only if cost or rate limits force it.** Graded ladder (PriceCharting) is a separate, optional re-sub — only if graded content/leaderboards are a priority.
- **D2 — Persist daily snapshots.** Add a `*_daily` append-only Supabase table populated by the daily cron (per card · per source · per day). This is the unlock for every "what's moving" feature and is worthless without a reliable daily source (D1).
- **D3 — Single insight layer.** One daily job computes the "interesting set" over the accumulated history; newsletter, /deals, and X all read from it. Do not build per-channel insight logic.
- **D4 — EU/Cardmarket.** Data's already there; the cost is surfacing (market toggle / EU-intent pages), i18n/hreflang, and — critically — **a verified EU monetization path.** ⚠️ Open question: does Cardmarket have an affiliate program? eBay Partner Network is US/eBay; Foil has no wired EU revenue path today. **Verify monetization before investing in EU traffic.**

---

## Sequencing (validate before spending / expanding)

- **Phase 0 — free, now.** Let the restored `deals-refresh` cron run (next 08:00 UTC); confirm `/deals` self-heals. If still stale, relabel `/deals` honestly ("Updated daily" is currently inaccurate). This also answers whether the staleness was the disabled cron (free fix) vs a genuine PokeTrace dependency.
- **Phase 1 — foundation.** Settle D1 (vendor) + build D2 (daily-snapshot persistence). Gated on the deal-finder being a confirmed priority worth the data spend.
- **Phase 2 — insight layer.** Build D3 (the single "interesting today" engine) once history has accumulated enough to compute trends.
- **Phase 3 — EU pilot.** Cheap test first: a few English-language, EU-intent content pieces (Cardmarket pricing, "[card] price Europe") + verify Cardmarket affiliate monetization. Full i18n/localization only if the pilot converts. Do NOT split focus to EU before the US flywheel shows traction (~currently 9 clicks/3mo).

---

## Catalog coverage — modern-set expansion (unblocked by the insight reframe)

**The old expansion blocker is gone for the insight product.** ROADMAP #29's catalog expansion (Wave 2 ~5K, Wave 3 ~18K) was paused, gated on the **eBay Browse quota** (R-012) — because the single-listing deal-finder hit eBay once per card. The market-movers signal is **PokeTrace-only** (zero eBay calls), so that gate does not apply to it. Per-card pages are demand-driven (resolve eBay at visit, not pre-scan), so catalog size doesn't pre-blow the eBay quota either. **The new bound is PokeTrace's rate cap (10K/day) + the cron's ~300s runtime**, not eBay.

**Prioritize modern high-demand sets.** The catalog skews vintage WOTC + 2021–23. Current search + sales volume concentrate in modern SV-era sets — **Prismatic Evolutions** (Jan 2025, still the most-hyped), the **Mega Evolution era incl. Chaos Rising** (released 2026-05-22, the newest), **Surging Sparks**, plus upcoming **Pitch Black** (2026-07-17) / 30th Celebration (Sep). Catalog source is the Pokémon TCG SDK (has every set); the ranked expansion pipeline (ADR-046) adds the *valuable* cards per set (TCGplayer-price-ranked), so it targets chase cards, not bulk commons. Confirm exact SDK set IDs before adding.

**Sales-volume ranking is feasible now.** ADR-046's "can't sort PokeTrace's list by volume" was about *discovery* (asking PokeTrace for top-volume cards blind), not ranking cards already tracked. The movers cron already pulls `saleCount` per card — so volume ranking/filtering is a local operation. The "good buys" board should filter on **min saleCount + min NM dollar value** so it surfaces liquid, material modern cards, not sub-$3 vintage bulk (the "Shaymin V down 17% = $0.34" noise).

**Movers universe scoping.** The cron covers the curated + newly-added modern chase cards; if that exceeds one ~300s run at the safe PokeTrace rate, paginate across daily runs (rolling window). The accumulating `market_snapshots` table makes week-over-week computable as coverage grows.

## Open questions to resolve before committing spend

- Cardmarket affiliate program? (the EU monetization path — verify)
- PokeTrace Pro cost + rate limits vs the daily-snapshot volume across the catalog
- Scrydex coverage/cost (currently unverifiable) — only if it becomes relevant
- Is the deal-finder a confirmed enough priority to fund a paid data spine, given the email-list north star? (The data engine serves BOTH the newsletter and /deals, so the answer is likely yes — but name it explicitly.)
