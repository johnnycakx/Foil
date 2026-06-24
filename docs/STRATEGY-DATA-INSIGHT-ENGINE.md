# Strategy: Data-Insight Engine (+ EU / Cardmarket expansion)

**Created:** 2026-06-24 · **Status:** strategy (upstream of goals) · **Author:** John Craig, with Cowork
**Companion to:** [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) · [newsletter-business-playbook.md](knowledge/newsletter-business-playbook.md) · the [subscriber-growth-loop charter](goals/subscriber-growth-loop.md) · [ADR-064](DECISIONS.md) (dual-track)

## Thesis

One **data → insight → distribution flywheel**: a reliable daily-refreshed pricing/market dataset feeds a *single* insight layer ("what's interesting today" — movers, anomalies, best deals), which fans out to all three surfaces: the **newsletter**, the **/deals board**, and **X**. One brain, three outputs — not three separate engines.

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

## Open questions to resolve before committing spend

- Cardmarket affiliate program? (the EU monetization path — verify)
- PokeTrace Pro cost + rate limits vs the daily-snapshot volume across the catalog
- Scrydex coverage/cost (currently unverifiable) — only if it becomes relevant
- Is the deal-finder a confirmed enough priority to fund a paid data spine, given the email-list north star? (The data engine serves BOTH the newsletter and /deals, so the answer is likely yes — but name it explicitly.)
