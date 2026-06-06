# Design — Verified-Listing Resolver (the FoilTCG backbone)

**Status:** Approved (design). Amended 2026-06-06 with John's review verdicts — k=4, rotation slice 300/day, Set/Number corroborating, visitor-feed ~6h freshness threshold, §4 quota portfolio (bounded bot line), §9 two-tranche build plan. **Build-step-0 probe RUN 2026-06-06** ([findings](probe-findings-listing-aspects-2026-06-06.md)). Tranche A (#0–#3) committed; Tranche B (#4–#7) gated on a post-Tranche-A John checkpoint. No production code yet.
**Date:** 2026-06-06 (created + amended)
**Author:** Claude Code (design goal), spec by John Craig.
**Supersedes the approach of:** the layered patches ADR-026 (quality picker), ADR-053 (buy-signal condition match), ADR-057 (language gate). Those stay in history; this design folds their intent into ONE gate.
**Related:** ROADMAP **SM** row, [ADR-054](DECISIONS.md#adr-054--todays-best-deals-leaderboard-precompute-and-cache-derived-metadata-never-persist-ebay-listing-data) (/deals cache), [ADR-046](DECISIONS.md#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards) (tiers), [R-008](RISKS.md), [R-012](RISKS.md), PATTERN I-008/I-009.

---

## 1. The problem, stated once

A visitor opened the **English** Typhlosion page (`neo1-17`) and the "Best current listing" block surfaced — and the "Buy on eBay" button redirected to — a **Japanese** Neo Genesis Typhlosion: eBay item `117223259644`, title `"Typhlosion 2000 Neo Genesis Holo Rare Japanese #No. 157"`. A user looking for an English card was sent to a Japanese one, with our affiliate tag on it.

This is not a tuning miss. It is **architectural**. Two code paths resolve "the listing," to two different correctness standards:

| Path | Function | What it checks | What consumes it |
|------|----------|----------------|------------------|
| **PICKER** (what users see + click) | `getBestListing` → `pickBestListing` (`lib/affiliate/{ebay-browse,listing-picker}.ts`) | TITLE keywords only — outlier price, junk/lot words, condition words, variant keyword gate. **No identity, no language, no set/number/finish.** | per-card page "Best current listing" + "Buy on eBay" (`app/(site)/cards/[slug]/page.tsx:180,419`); `/go/deal/[slug]` redirect; wishlist alert cron |
| **CLASSIFIER** (what counts as a deal) | `computeCardBuySignal` → `inferListingCondition({ aspects })` (`lib/buy-signal/*.ts`) | eBay `getItem` item specifics: **Language gate** (ADR-057) + condition match + outlier guard | the buy-signal **badge** + the `/deals` board signal |

ADR-057's language gate lives **only in the classifier**. On the Typhlosion page the code literally fetched the listing's aspects (`page.tsx:262` `getListingAspects(best.itemId)`) and correctly resolved **UNKNOWN** (Japanese) — so the *badge* was suppressed — **but the unverified listing was still displayed and still linked**, because that verdict never gates the picker's output. The verification ran and was thrown away.

Three patch rounds each hardened one layer while the next stayed blind:
- **ADR-026** hardened the picker against junk *prices/titles* — not identity.
- **ADR-053** hardened the *classifier* condition match — not the picker.
- **ADR-057** hardened the *classifier* language gate — not the picker.

John's verdict: **no more layered patches.** One resolver, one correctness standard, every consumer.

### Secondary defects this design also closes
- **Triple-redundant condition inference.** Three separate title heuristics exist: `listing-picker.ts` keyword gates, `condition-infer.ts` (the good one, aspect-aware), and a *third* inline `inferConditionLabel` in `page.tsx:71`. They can disagree on the same listing.
- **Variants-panel market marker defect.** `page.tsx:347` passes the single `best.price` (one unverified picker listing) as `currentBestPriceUsd` to `<CardVariantsSection>` — the **same** unverified number is shown as the "current best" marker across **every** variant (Normal/Holo/Reverse/1st Ed), even though those are different cards with different markets.
- **Catalog-size-bound-by-quota.** The `/deals` cron (`refresh-batch.ts`) only iterates the **curated** set and caps at `MAX_DEALS_BROWSE_CALLS = 240`. Live listings exist only for the curated tier (`page.tsx:179` `if (tier === "curated")`). Catalog growth is gated on quota because we pre-scan a fixed set. The spec retires this.

---

## 2. Canonical operation — `resolveVerifiedListing`

> **One function. Every consumer calls it. Nothing unverified ever reaches a user.**

```ts
// lib/listing/resolve.ts  (new — the single boundary)

export type ResolveCondition =
  | "NM" | "LP" | "MP" | "HP" | "DMG"   // raw tiers
  | "ANY_RAW"                            // best across raw tiers (page default)
  | { graded: { service: "PSA"|"BGS"|"CGC"|"SGC"; grade: string } }; // e.g. PSA 10

export type VerifiedListing = {
  itemId: string;            // eBay RESTful id (used to build the affiliate URL, then transient)
  affiliateUrl: string;      // internally-built, never user-supplied
  price: number;
  currency: string;
  title: string;             // for display only — NOT the verification basis
  condition: ListingConditionTier;  // from aspects, not the title
  verifiedAspects: {         // the evidence, for telemetry/honesty — derived, transient
    set: string; number: string; finish: string; language: "English"; graded: boolean;
  };
};

/** Returns a fully IDENTITY-VERIFIED listing for `cardId` in `condition`,
 *  or an honest `null`. Null beats unverified-cheapest, always. */
export async function resolveVerifiedListing(
  cardId: string,                 // catalog slug (e.g. "neo1-17")
  condition: ResolveCondition,
  opts?: { customId?: string; surface?: BrowseSurface; budget?: QuotaBudget },
): Promise<VerifiedListing | null>;
```

### The pipeline (one path, replacing both old ones)

1. **Resolve identity target** from the catalog + SDK metadata: `{ setName, setId, number, finish/variant, language: English, graded?: condition }`. This is the *expected* identity — what the card IS.
2. **Search** eBay `item_summary/search` (1 call) for `name + setName` (+ quoted variant/condition bias, as today).
3. **Pre-filter (title only) — may NARROW, never ADMIT.** Run the existing picker gates (outlier price, junk/lot/proxy words, condition keyword bias) to *rank and shrink* the candidate set. Title parsing is a cost optimizer — it decides verification ORDER, never final inclusion.
4. **Verify top-k cheapest candidates, in order, until one passes** (`getItem` per candidate, cap `k`):
   - `getItem.localizedAspects` → identity check, ALL of:
     - **Language == English** (reuse `marketFromAspects`, ADR-057).
     - **Set** matches the card's set (`Set` / `Set Name` aspect; mapping table SDK↔eBay where names differ).
     - **Collector number** matches (`Card Number` aspect, e.g. `"17/111"` → compare the numerator to `card.number`).
     - **Finish/variant** matches the requested variant (`Finish` / `Features` aspect: Holo / Reverse Holo / Normal / 1st Edition).
     - **Graded-vs-raw + condition** matches `condition` (`Graded` + `Card Condition` / `Grade` aspects, reuse `conditionFromAspects`).
   - First candidate passing ALL gates → return it as `VerifiedListing`.
   - Candidate fails any gate → discard, try the next cheapest (within budget + cap `k`).
5. **Zero verified candidates** (all k failed, or `getItem` failed, or no aspects) → **return `null`.** The caller degrades to an honest "no verified listing right now" + an affiliate SEARCH CTA. Never the unverified cheapest.

**Hard rule:** title parsing may **pre-filter** candidates (cheap, reduces `getItem` spend) but may **never** be the sole basis to admit a listing for display. The aspect check is the only admission gate. `null > unverified-cheapest`, always.

> **Build-step-0 — RESOLVED by the probe (2026-06-06).** ✅ **Set, Card Number, Finish all EXIST** with high presence (Set 85–100%, Number 83–100%, Finish 75–83% per era — [probe findings](probe-findings-listing-aspects-2026-06-06.md)). The design holds; the work is **value normalization, not redesign**: their values are eBay's own strings, not SDK values (`"2000 Neo Genesis"` vs `"Neo Genesis"`; `"No. 157"`, `"18/111"`, `"004/102"`, `"DP46"`), so matching needs an alias/normalizer, never raw equality. Two concrete goal-#1 inputs the probe forced: graded detection must use `Grading Company`/`Grade`/top-level `condition:"Graded"` (the `Graded:Yes` aspect is often blank on real slabs); and `Language` is absent on a slice (esp. graded) → hard-exclude when it says non-English, else fall through to title market-markers + the foreign-Set tell. Full revision list in the findings §4. **Corroborating Set/Number (John's v1 default) confirmed correct** — strict equality would false-reject legit cards on string mismatch more than it false-accepts wrong cards.

---

## 3. Demand-driven architecture (retire the tier distinction for live listings)

**Principle (John, verbatim intent):** *Catalog size must NEVER be constrained by eBay quota again — quota spends on visitors, not on pre-scanning a fixed set.*

### 3a. Live listings become demand-driven for ANY catalog card
- `resolveVerifiedListing` runs **at page-visit time** for **any** card in the catalog — curated, longtail, or metadata-only. The **curated/longtail/metadata-only tier distinction is RETIRED for live listings.** (Tiers may still drive *render cost* concerns for ISR/SSG — that's ADR-047's separate axis — but they no longer decide *whether a card gets a live verified listing*.)
- A page view spends quota; an un-viewed card spends nothing. Quota now scales with **traffic**, not **catalog size**. A 25,000-card catalog with 500 views/day costs exactly what a 1,000-card catalog with 500 views/day costs.
- The per-card page no longer branches `if (tier === "curated")` for the live block. Every visited card resolves live (subject to the global daily budget, §4).

### 3b. `/deals` becomes a ranked aggregation of the SAME verified output, by BUDGETED ROTATION
The board is no longer a full pre-scan of a fixed curated set. It is fed by two sources, both producing the identical `VerifiedListing` verdict:

1. **Budgeted rotation cron** (replaces the all-curated `refresh-batch`):
   - A **daily call budget** for the board (e.g. `DEALS_DAILY_BUDGET`), separate from the visitor budget.
   - Each run processes a **slice** of the catalog, **prioritized by**: card value (SDK TCGplayer price — high-value cards first), then **watch count** (cards on watchlists), then staleness (longest-unscanned first).
   - Over **N days**, the rotation covers the **full catalog** (full-catalog coverage every N days, where N = catalogSize ÷ dailySliceSize). The board is always "the best verified deals we've confirmed within the last N days," refreshed continuously rather than all-at-once.
2. **Opportunistic visitor feed (freshness-thresholded):** when a visitor's page view resolves a verified BELOW-market listing, that **derived verdict** writes into `buy_signals` (the same cache, R-008-safe — §6) **only if the cached verdict for that card is older than ~6h** (John, 2026-06-06). The threshold avoids write amplification on hot pages while still letting real traffic freshen the board's popular cards for free; the rotation guarantees coverage of cold cards.

The board still **renders from the cache only** (zero Browse calls at view time — ADR-054 holds). It ranks BELOW-market, condition-matched, confident (n≥5) rows — exactly today, but now sourced from the verified resolver and not capped to 207 curated cards.

---

## 4. Quota model

eBay default ceiling: **5,000 Browse calls/day** (lifted by the Application Growth Check — ROADMAP #10).

### Calls per resolve
- 1 `search` + up to **k** `getItem` verifications (verify cheapest-first until one passes).
- **`k` cap** bounds the worst case. **k = 4** (John, 2026-06-06) — verify at most the 4 cheapest credible candidates.
- **Amortized** cost is far below the worst case: on a healthy English-listing card the cheapest candidate usually passes on the **1st or 2nd** `getItem`. Expected ≈ **1 search + 1.5 getItem ≈ 2.5 calls/resolve**; worst case `1 + k = 5`.

### Supported daily live page views under 5,000/day

| Scenario | Calls/view | Views/day under 5,000 |
|---|---|---|
| Amortized (≈2.5) | 2.5 | **~2,000** |
| Worst case (k=4 → 5) | 5 | **~1,000** |

### Quota portfolio — budget lines with distinct return horizons (replaces any hard bot-block)

The 5,000/day is **not one pool to race** — it is allocated into budget lines, each with its own return horizon, so no single source can starve another. A crawl burst can never crowd out a human visitor because each line is capped independently:

| Budget line | Size (starting) | Return horizon |
|---|---|---|
| **Visitors** | the largest line (≈4,000/day after the others) | **Immediate affiliate intent** — a human who resolves a live verified listing may click + buy; EPN pays on purchase. First call on the budget. |
| **/deals rotation** | **~750/day** | Deal discovery — feeds the board + the X bot + the newsletter. Bounded, resumable (§7). |
| **Wishlist cron** | ~200/day (existing `MAX_BROWSE_CALLS`) | Watcher alerts — direct user value, already capped. |
| **Bounded bot line** | **~300–500/day** (but see the finding below → near-zero) | Crawler user-agents (Googlebot etc.) resolve live **ONLY** within this line, prioritized toward the highest-value pages; once it's spent, crawlers get the degraded render. **A crawl burst can NEVER starve human visitors** — the line is hard-capped separately. |

**Bot-line rationale + the schema-check finding.** Bots earn no commission (EPN pays on *purchase*), so a crawler's direct ROI is zero. The only reason to spend *any* quota on bots is if **Product rich results in search depend on live Offer markup**. The build-step-0 schema check (code read, [probe findings](probe-findings-listing-aspects-2026-06-06.md)) answers this: the curated-tier `Product.offers` is currently fed by the **live eBay listing** (`page.tsx` `best.price`/`best.affiliateUrl`) — *but* a **baked TCGplayer `AggregateOffer`** (`aggregateOfferFromTcgplayer`, zero eBay calls, R-008-safe) already exists in-code and is used on the longtail tier, and curated cards also carry the baked `tcgplayerPrices` it needs. **Recommendation: serve crawlers the baked `AggregateOffer` instead of a live resolve** → Product offer markup (rich-result eligibility) is preserved for *every* page with **zero** eBay calls, so the **bot line collapses to near-zero** (kept as a small contingency only). Live verified Offers remain for human visitors. This is strictly better than spending bot budget: same SEO surface, no quota cost, no risk of a crawl starving visitors.

Net of the other lines (~750 rotation + ~200 wishlist + ~0 bot), ~**4,050/day** is left for visitors → **~1,600 amortized / ~810 worst-case** live page views/day.

### The math at 1,007 vs 25,000 catalog — the point
- **Catalog size is IRRELEVANT to the per-day quota.** Quota = `(daily page views × calls/view) + rotation budget + wishlist budget`. Catalog size appears **only** in the rotation's coverage period N (days to cover everything), never in the daily spend.
  - At **1,007** cards with a 300-card/day rotation slice → full coverage every **~3.4 days**.
  - At **25,000** cards with the same 300/day slice → full coverage every **~83 days** (cold long-tail cards refresh seasonally; hot cards stay fresh via the visitor feed + value-priority ordering). The daily quota spend is **unchanged**.
- The catalog can grow to 25K (or 250K) without ever touching the daily ceiling. Only **traffic** moves the ceiling.

### When real traffic exhausts the ceiling — and why that's the Growth-Check trigger
- The ceiling binds at roughly **~1,700 live page views/day** (amortized, after reserves). That is a *good problem*: it means real traffic arrived.
- eBay's **Application Growth Check** explicitly requires *"the application is live and approaching the default 5,000/day call limit"* as the evidence to approve a ceiling lift. **Demand-driven resolution makes hitting the ceiling the same event as having the Growth-Check evidence.** The budget instrumentation (§ below) that protects the ceiling is also the telemetry that proves "approaching the limit." Timing aligns by construction: traffic → calls approach 5,000/day → submit the Growth Check → lift unblocks the next traffic tier.
- Until then, a **global daily budget guard** (a shared counter in `browse_calls` telemetry, already tracking per-surface volume) degrades gracefully: when the day's budget is exhausted, further resolves return `null` + the affiliate SEARCH CTA (honest "live deal data is briefly unavailable," the existing soft-fail copy) rather than 429-ing eBay or blowing the quota. The board (cache-backed) is unaffected.

---

## 5. Consumers and migration

Every consumer routes through `resolveVerifiedListing`. **No wrapper layers** — the old picker entry point is deleted or demoted, not re-wrapped.

| Consumer | Today | After |
|---|---|---|
| **Per-card page** (`page.tsx`) | `getBestListing` (picker, unverified) displayed; aspects fetched separately only for the badge | Calls `resolveVerifiedListing(slug, condition)` once. Displays its output (already verified) or the no-verified-listing CTA. Badge reads the same verdict (one `getItem`, not two). |
| **`/deals` board** | cache from all-curated `refresh-batch` (signal-gated, but capped 207) | cache from the **budgeted rotation** + **visitor feed**, both producing `VerifiedListing`. Same render, no cap, demand-fed. |
| **`/go/deal/[slug]` redirect** (`resolveDealDestination`) | re-runs `getBestListing` (picker) at click — **unverified**, can land on a different/Japanese listing | re-runs `resolveVerifiedListing` at click → 302 to the verified item, or to the affiliate SEARCH (no verified listing) — never an unverified item. |
| **Wishlist alert cron** (`scan-batch`) | `getBestListing` (picker); emails when target ≥ price — **can alert on an unverified/Japanese listing** | `resolveVerifiedListing(slug, row.condition)`; emails only when a **verified** listing in the watched condition meets target. No verified match → no alert (correct). |
| **X bot data** (`lib/social/data.ts`) | reads `buy_signals` cache | unchanged — inherits the cache, which is now verified-sourced. |
| **Variants panel** (`<CardVariantsSection>`) | `page.tsx:347` passes ONE unverified `best.price` as the marker across ALL variants — **the named defect** | the marker for each variant comes from that **variant's own** `resolveVerifiedListing(slug, …)` result (or null → no marker). A variant with no verified listing shows no false marker. (May be phased: first stop reusing one price; later resolve per visible variant within budget.) |

### What gets DELETED vs DEMOTED in `listing-picker.ts`
- **DEMOTED to pre-filter** (kept, but only to rank/narrow candidates before `getItem`): `rejectPriceOutliers`, `rejectTitleJunk`, `rejectConditionJunk`, `rejectByKeywords`, `medianPrice`. These stay valuable as a cheap cost-optimizer that reduces `getItem` spend — they just lose authority to *admit* a listing.
- **DELETED / no longer a public entry point:** `pickBestListing` as the *terminal selector* and `getBestListing` as a *consumer-facing function*. `getBestListing` is absorbed into `resolveVerifiedListing` (search + pre-filter become internal steps). No module outside `lib/listing/` calls a picker directly.
- **DELETED:** the inline `inferConditionLabel` in `page.tsx:71` (the third redundant heuristic). Condition for display comes from the resolver's verified `condition` field.
- **Single condition-inference source:** `condition-infer.ts` (aspect-first) remains the one inference module; the picker's condition *keywords* survive only as pre-filter bias.

---

## 6. R-008 boundaries — what may persist, per field

R-008: **never persist eBay listing data.** The resolver reads listing data at compute time (`cache: "no-store"`), classifies, and **discards the listing**. Only **derived verdicts** persist. Explicit per field:

| Field | Origin | Persist? | Why |
|---|---|---|---|
| `signal` (BELOW/AT/ABOVE/UNKNOWN) | derived | ✅ yes | derived classification, not listing data (ADR-054 precedent) |
| `delta_pct` | derived | ✅ yes | derived metric |
| `sold_reference`, `sold_sample_size`, `matched_tier` | PokeTrace (non-eBay) | ✅ yes | not eBay data |
| `card_name`, `set_name`, `image_url`, `card_slug` | SDK catalog | ✅ yes | not eBay data |
| `computed_at`, `verified` boolean, `verified_condition` | derived | ✅ yes | derived verdict + freshness |
| eBay **item id** | listing | ❌ **never** | an eBay listing identifier |
| eBay **title** | listing | ❌ never | listing content |
| eBay **ask price** | listing | ❌ never | the raw listing price (only the derived `delta_pct` survives — ADR-054's honesty note) |
| eBay **seller / listing url / listing image** | listing | ❌ never | listing content |
| `verifiedAspects` (set/number/finish/language values read from the listing) | listing | ❌ never (use transiently, then discard) | these are read FROM the eBay listing; keep them only in-request for the verdict + telemetry counts, never in a table |

The persisted cache row is **shape-identical** to today's `DealUpsertRow` plus an optional `verified` flag — **no new eBay-listing column.** The board still links out live (resolves the item at click), so nothing durable stores a listing.

---

## 7. Failure modes — each degrades to null/UNKNOWN, never to an unverified listing

| Failure | Behavior |
|---|---|
| **Aspects absent** (listing has no `Set`/`Number`/`Finish` specifics — common on vintage) | Cannot verify identity → that candidate **fails**, try the next. If the field is *structurally* unavailable on eBay for a class of listings, see the degraded policy below. |
| **`getItem` error / 4xx / 5xx / network** | candidate unverifiable → discard, try next; all fail → `null`. (Same soft-fail posture as ADR-057.) |
| **Quota budget exhausted mid-resolve** (hit `k` or the global daily budget) | stop verifying, return `null` + affiliate SEARCH CTA. Never return an unverified candidate to "save" the page. |
| **Quota exhausted mid-rotation** (board cron hits its slice budget) | finish the candidates already verified, write those rows, stop. Next run resumes the rotation from where it left off (resumable, like the ADR-046 bake). Partial coverage is fine — the board shows verified cards only. |
| **Zero verified candidates** (all k fail identity) | `null`. Page shows "no verified listing right now" + SEARCH CTA; board shows nothing for that card; wishlist sends no alert; `/go` 302s to SEARCH. |
| **PokeTrace reference thin/absent** (for the BELOW classification) | signal = UNKNOWN (existing behavior) — the listing may still be *identity-verified* and displayable, just not classifiable as a deal. Identity verification and deal-classification are independent gates. |

**Degraded-aspect policy — DECIDED: CORROBORATING (John, 2026-06-06).** The v1 default is **corroborating, not strict**: **Language + Graded/Condition + Finish are HARD gates**; **Set + Card Number are corroboration** — enforced when present, with a title-number cross-check fallback when absent, and **presence-rate telemetry** so we can tighten to strict per-era later if the data supports it. Rationale: a strict Set/Number requirement would `null` out **vintage** listings (which the probe expects to carry these specifics least often) — and vintage (Base/Neo/Gym) is **Foil's core market**, so strict would blank the highest-value pages. The Typhlosion case is caught regardless by the **Language** hard gate; Set/Number raise precision on the harder same-language wrong-print cases. The build-step-0 probe's per-era presence table calibrates *where* Set/Number can be promoted toward hard.

---

## 8. Test plan

**Pinned regression fixture (the bug):**
- `lib/__fixtures__/ebay-listings/jp-typhlosion-117223259644.json` — the real `getItem` aspect shape for item **`117223259644`** (`Language: Japanese`, title `"Typhlosion 2000 Neo Genesis Holo Rare Japanese #No. 157"`). A unit test asserts `resolveVerifiedListing("neo1-17", "ANY_RAW")` **rejects** this candidate (Language gate) and, if it were the only candidate, returns **`null`** — never this item. This is the test that would have caught the production failure.
- Companion positive fixture: a real **English** Neo Genesis Typhlosion `getItem` shape that **passes** (Language English + Set + Number + Finish match) → returns a `VerifiedListing`.

**Unit coverage (pure, fixture-driven, R-010):**
- Each identity gate independently (language / set / number / finish / graded-vs-raw), pass + fail fixtures from real observed shapes.
- Pre-filter narrows but never admits: a title-clean-but-Japanese candidate is pre-filter-kept then aspect-rejected.
- k-cap + cheapest-first ordering: verify the 2nd candidate when the 1st fails; stop at k.

**Live-smoke (run with `--env-file=.env.local`, like `buy-signal-live-smoke.test.ts`):**
- Run `resolveVerifiedListing` over a flagship corpus (incl. `neo1-17`); assert every returned listing is English + set/number-matched; assert no return is a known cross-market item. Fails the suite on any unverified return.

**Before/after measure (PATTERN I-009 — mandatory at build closure):**
- Over the current eBay-live curated set, record BEFORE (picker) vs AFTER (resolver): how many cards' displayed "best listing" change, how many drop to `null` (honest no-listing), and confirm 0 cross-market/wrong-print survivors. Report the concrete delta in SESSION-LOG, honestly — even if coverage drops (fewer-but-true is the point, exactly as F4 went 5→3).

---

## 9. Build plan — ordered, each independently shippable + gated

Each goal ends with: `npm test` green, `tsc` clean, `npm run build` clean, `compliance:check` 6/6, `/security-review` no-High, and (for any live-path goal) the I-009 before/after measure.

> **Two tranches (John, 2026-06-06).** **Tranche A = #0–#3** — committed; it closes the trust bug on *every user-facing click* (per-card display, `/go` redirect, wishlist alert). The **X bot may unpause after #3** (every surface it could screenshot or link is verified by then). **Tranche B = #4–#7** — **GATED on a John checkpoint after Tranche A**, informed by the #2 I-009 coverage measure (how many cards drop to honest-null tells us whether the demand-driven board rotation + tier retirement are worth building as specced, or need a coverage fix first).

### Tranche A — committed (#0–#3): close the trust bug end-to-end

0. ✅ **Probe — DONE 2026-06-06** ([findings](probe-findings-listing-aspects-2026-06-06.md)). Confirmed Set/Card Number/Finish exist + their value formats + per-era presence; saved the JP reject + English positive fixtures (`lib/__fixtures__/ebay-listings/`); confirmed the schema-offer source (curated=live, longtail=baked TCGplayer → bot line near-zero). Corroborating Set/Number confirmed. The design stands; goal #1 inherits the findings' 5 normalization revisions.
1. **`resolveVerifiedListing` core + fixtures.** New `lib/listing/resolve.ts` (+ pure identity-gate module). Pin the Typhlosion fixture + the English positive fixture + per-gate units. **No consumer wired yet** — ships behind nothing, fully tested in isolation. Demote the picker functions to internal pre-filter.
2. **Per-card page migration.** Swap `page.tsx` to the resolver (display + badge from one verdict). Delete `inferConditionLabel`. I-009 before/after measure across the live curated set. This is the highest-leverage user-facing fix (it's the surface the bug appeared on).
3. **`/go` redirect + wishlist cron migration.** Route both through the resolver. The redirect 302s only to verified items; the wishlist alerts only on verified condition matches. (Both are small, mechanical swaps once #1 exists.)
### Tranche B — gated on a John checkpoint after Tranche A (#4–#7): demand-driven scale

4. **`/deals` budgeted rotation + visitor feed.** Replace all-curated `refresh-batch` with the rotation (value+watch-priority slices, resumable, daily budget) and add the opportunistic visitor-feed write. Retire the curated-only cap. The board renders unchanged (cache-only).
5. **Variants-panel per-variant marker.** Stop reusing one price; resolve per visible variant within budget (or show no marker). Closes the named defect.
6. **Retire the live-listing tier branch.** Remove `if (tier === "curated")` gating of live resolution so any visited card resolves live (subject to the global budget). Quota is now traffic-bound, catalog-unbound — the spec's core guarantee.
7. **Global daily budget guard + Growth-Check telemetry.** The shared counter that degrades resolves to SEARCH when the day's budget is spent, and surfaces the "approaching 5,000/day" evidence for the Growth Check.

**Ships first:** #0 (probe — this goal) → #1 (core) → #2 (per-card page) → #3 (redirect + wishlist) = **Tranche A**, which closes the production bug end-to-end on every user-facing click. **Tranche B (#4–#7)** generalizes it to the demand-driven scale model, gated on the post-Tranche-A checkpoint.

---

## Decisions (John, 2026-06-06) — formerly open questions
1. **k cap = 4.** Worst-case 5 calls/resolve; amortized ~2.5. (Recorded in §4.)
2. **Rotation slice = 300 cards/day (starting value).** ≈3.4-day full coverage at 1K, ≈83-day at 25K; tune against the visitor budget after the Growth Check. (§3b, §4.)
3. **Set/Number = CORROBORATING (v1 default).** Language + Graded/Condition + Finish are hard gates; Set/Number corroborate (enforced when present, title-number fallback when absent) with presence-rate telemetry. Strict would null out vintage — Foil's core market. (§7.)
4. **Visitor-feed write = freshness threshold.** Only write a visitor-resolved verified verdict into `buy_signals` when the cached verdict is older than **~6h**, to avoid write amplification on hot pages. (§3b.)
