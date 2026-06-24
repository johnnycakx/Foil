# Data sources for the "biggest grading gains" leaderboard

**Status:** Research-only (no code, no deps, no commits). Written 2026-06-04.
**Feeds:** ROADMAP [B.4 — Buy-signal leaderboard page](ROADMAP.md). This is the data-layer
research that B.4 needs *before* any build, plus it surfaces the one true gap in our stack.
**Related:** [ADR-020 pivot](DECISIONS.md#adr-020--pivot-to-buyer-side-deal-finder-positioning),
[R-008 (no eBay caching)](RISKS.md), ROADMAP [#15 Scrydex migration eval](ROADMAP.md).

## The product we're researching for (context, NOT this goal)

A Collectrics-style leaderboard ranking cards by the upside of grading. Per row:

| raw / ungraded | PSA 10 | PSA 10 vs raw ($) | PSA 10 vs raw (%) | **gem %** | *Foil's edge →* live best eBay deal + buy-signal |
|---|---|---|---|---|---|

`gem %` = PSA 10 population ÷ total PSA-graded population for that card.
**Foil's differentiator over Collectrics:** the last two columns — our live best-listing +
buy-signal attached to each row, which they don't do.

Five data needs follow. **(3) is the only one we cannot satisfy with what's wired today.**

---

## (a) Codebase audit — what we already pull

I read the actual clients, not the docs' claims about them: `lib/poketrace.ts`,
`lib/poketrace/by-uuid.ts`, `lib/poketrace/price-history.ts`, `lib/pricecharting.ts`,
`lib/pricing.ts`, `lib/affiliate/ebay-browse.ts`, `lib/buy-signal/reference.ts`, and grepped the
whole tree for any population / gem-rate source.

| Source | Wired in | Auth | Returns (verified from code) | Cached where |
|---|---|---|---|---|
| **PokeTrace** | `lib/poketrace*.ts` | `X-API-Key`, `api.poketrace.com/v1` | Per-source (eBay/TCGplayer/Cardmarket) × per-tier snapshots: **raw** (NEAR_MINT/LP/MP/HP/DMG + AGGREGATED/MARKET roll-ups) **and the graded ladder** (PSA_7/8/9/9.5/**10**, BGS_10, CGC_10, SGC_10). Each snapshot = `avg/low/high/avg1d/avg7d/avg30d/**saleCount**`. **Daily price-history series** via `/cards/{uuid}/prices/{tier}/history` (date, avg, median7d, low, high, saleCount). Code comment confirms we're on the **Scale-tier** key. | In-process stale-while-revalidate (1h TTL); card images → Supabase Storage `card-images` bucket |
| **PriceCharting** | `lib/pricecharting.ts` | `t=<key>` query param, `www.pricecharting.com/api` | The **graded ladder** as a cross-reference: `loose-price`→RAW, `cib`→PSA7, `new`→PSA8, `graded`→PSA9, `box-only`→PSA9.5, `manual-only`→**PSA10**, CGC_10, SGC_10, BGS_10. Integer pennies; `0` = no data. | PokeTrace-id→PriceCharting-id map in Supabase `pricecharting_id_map` |
| **eBay Browse** | `lib/affiliate/ebay-browse.ts` | OAuth bearer, `api.ebay.com/buy/browse/v1` | **Live listings**: title, itemWebUrl, image, price, currency. Quality-picked (`listing-picker.ts`). | **Never** — `cache:"no-store"` per **R-008**; persistence forbidden |
| **Pokemon TCG SDK** | `lib/cards/sdk.ts` | pokemontcg.io | Catalog: names, set codes, images, TCGplayer/Cardmarket price *pointers*, metadata. | — |

**Mapping to the five needs:**

| Need | Status today | Source |
|---|---|---|
| (1) raw / ungraded price | ✅ **Wired** | PokeTrace (RAW_UNGRADED) |
| (2) PSA 10 price + graded ladder | ✅ **Wired** | PokeTrace graded tiers + PriceCharting cross-ref |
| (3) **PSA population / gem rate** | ❌ **ABSENT — no source anywhere in the tree** | none |
| (4) live eBay listings | ✅ **Wired** | eBay Browse |
| (5) price history (sparkline) | ✅ **Wired** | PokeTrace `/prices/{tier}/history` (daily, median7d) |

**The premise holds.** Four of five needs are already in production. The grep for
`population|gem|popReport|gemRate|…` returned only docs, blog content, and grade-token parsing
(`"gem mint"` in `buy-signal/condition-infer.ts`) — **zero data clients**. Critically:
**PokeTrace `saleCount` is sold-volume, NOT graded population** — they measure different things
(how many *sold* recently vs. how many *exist in slabs*). You cannot compute gem % from anything
we currently pull. **Need (3) is the whole research problem.**

---

## (b) Comparison tables, per data need

All figures cited inline. Where a figure is unverified (site blocked automated fetch, or page
didn't state it), it's marked **UNKNOWN** rather than guessed.

### Need (1) raw / ungraded price & (2) PSA 10 + graded ladder
*(grouped — the same sources serve both)*

| Source | Raw | Graded ladder + PSA 10 | Coverage | 2026 cost | Rate limit | Auth | Official? | Store/cache ToS |
|---|---|---|---|---|---|---|---|---|
| **PokeTrace** *(wired)* | ✅ NM + played tiers | ✅ PSA/BGS/CGC/SGC/ACE/TAG | Vintage + modern, US + EU | Free 250/day (US, raw); **Pro $19.99/mo** 10k/day (+EU,+graded); **Scale $99/mo** 100k/day | per-day, per-request | API key | ✅ Official API | No public prohibition on caching derived values found — **confirm at signup** |
| **PriceCharting** *(wired)* | ✅ single `loose-price` | ✅ PSA 7/8/9/9.5/10 + CGC/SGC/BGS 10 | Vintage + modern | Paid sub required; premium **~$6/mo or $59/yr** (collector tier; *API-enabling tier cost* **UNKNOWN**) | **1 call/sec** | `t=` token | ✅ Official API | API/CSV = **current values only, no history**; CSV bulk only on Legendary tier |
| **Scrydex** | ✅ raw | ✅ PSA/BGS/CGC/TAG/ACE | Vintage + modern (successor to pokemontcg.io) | Credit-based (1 credit standard / 3 price-history / 5 image); **$/mo UNKNOWN** (site blocks automated fetch) | per-credit-quota | secret key | ✅ Official API | **UNKNOWN — confirm** |
| **Pokemon TCG SDK** *(wired)* | pointer only | ❌ none | Modern-leaning | Free | generous | key optional | ✅ ("now part of Scrydex") | catalog/images only |
| **TCGplayer API** | ✅ market price | ❌ no graded | Modern | Free *if approved* | — | OAuth 2.0 | ✅ but **approval-gated, not indie-self-serve** | partner terms; affiliate plumbing is our V1.5 plan (ROADMAP #26) |

**Verdict (1)+(2): no change needed.** PokeTrace (Scale, already paid) gives raw + the full PSA
ladder incl. PSA 10. PriceCharting (already wired) is a fine second-opinion cross-ref.

### Need (3) PSA population / gem rate — THE GAP

| Source | Population data? | Coverage | 2026 cost | Auth | Official? | Store/cache ToS |
|---|---|---|---|---|---|---|
| **PSA Public API** (psacard.com) | ❌ **No.** Public API exposes **cert verification by cert number only**; the Pop Report is a separate website tool, not an API method | n/a | Free 100 calls/day; paid = email PSA | bearer token from PSA login | ✅ Official | "PSA API End User Agreement" governs — but **moot, no pop endpoint** |
| **PokemonPriceTracker** | ✅ **Yes** — "Pop Reports" + daily **pop dump export** | Pokemon, modern + vintage | **Pop is Business-tier:** general pricing page = **$99/mo** (200k/day, 12mo+ history, Pop Reports, daily cards/sealed/eBay/**pop** dump); a separate PSA-API landing page lists **$19/$49/$149** tiers — **discrepancy, confirm at signup** | API key | Semi-official (commercial third party) | "Commercial use license" stated on all tiers; **the daily pop dump implies caching is allowed** — confirm redistribution limits |
| **Scrydex** | ✅ **Yes** — "real-time population reports… how many PSA 10s exist in the wild" (PSA/BGS/CGC/TAG/ACE) | Vintage + modern | **$/mo UNKNOWN** (blocked) | secret key | ✅ Official API | **UNKNOWN — confirm** |
| **Apify PSA pop scraper** (`lulzasaur/psa-pop-scraper`) | ✅ scrapes the PSA Pop Report | whatever PSA lists | Apify usage-based | Apify token | ❌ **Scrape — ToS risk** | scraping PSA's site likely violates PSA terms; treat as fragile fallback only |
| **Collectrics** | (the competitor — has it, doesn't sell it) | — | — | — | — | — |

**Verdict (3):** the official PSA API is a dead end for population. The realistic choices are
**PokemonPriceTracker Business (~$99/mo, has a cacheable pop dump)** or **Scrydex (get a quote)**.
Scraping is a last resort.

### Need (4) live eBay listings

| Source | Returns | Cost | Store/cache ToS |
|---|---|---|---|
| **eBay Browse** *(wired)* | live asks (title/price/url/image) | free within quota (~5k/day ceiling, Growth Check pending — ROADMAP #10) | **R-008: cannot cache/persist listing data** — render-time only |
| eBay Marketplace Insights (sold comps) | sold prices | — | **Limited Release, business-approval-gated; not realistically available to us now** |

**Verdict (4): no change.** Browse already powers the per-card live deal. Note: the leaderboard
must respect R-008 — a *precomputed* leaderboard cannot store eBay listing fields; it stores our
own derived buy-signal classification and links out to a live Browse call (exactly B.4's design).

### Need (5) price history (trend sparkline)

| Source | Returns | Cost | Notes |
|---|---|---|---|
| **PokeTrace `/prices/{tier}/history`** *(wired)* | daily date/avg/median7d/low/high/saleCount, periods 7d–all | included in Scale | already powers the sold-history chart (ADR-044) |
| PokemonPriceTracker | 6mo (API tier) / 12mo+ (Business) history | per tier above | bundled if we take it for pop anyway |
| PriceCharting | ❌ no history via API | — | "current values only" |

**Verdict (5): no change.** PokeTrace daily history already exists; reuse it for the sparkline.

---

## (c) Recommended source per need + one recommended stack

**Per need:**

1. Raw price → **PokeTrace** (wired, Scale).
2. PSA 10 + ladder → **PokeTrace** (wired); PriceCharting as optional cross-ref (wired).
3. Population / gem rate → **PokemonPriceTracker Business** *(primary recommendation)* — only
   official-ish API that returns population **with a daily pop-dump export we can cache**, which
   is exactly what a cron-precomputed leaderboard (B.4) needs. **Scrydex** is the strong
   alternative *if* its quote is competitive (it would also let us consolidate — see decision 2).
4. Live eBay → **eBay Browse** (wired; render-time, R-008-compliant).
5. Price history → **PokeTrace history** (wired).

**Recommended stack & rough monthly cost:**

| Component | Source | Monthly |
|---|---|---|
| Raw + graded ladder + PSA 10 + daily history (needs 1,2,5) | PokeTrace Scale *(already paying)* | ~$99 |
| Graded cross-reference (optional) | PriceCharting *(already paying)* | ~$6 |
| Live deal (need 4) | eBay Browse | $0 |
| Catalog | Pokemon TCG SDK | $0 |
| **Population / gem % (need 3 — NET NEW)** | **PokemonPriceTracker Business** | **~$99** |
| **Total** | | **~$200/mo (~$99 net-new)** |

The leaderboard build itself is then mostly *wiring*: one new population client, an
ID-mapping table (mirror the existing `pricecharting_id_map` pattern), and a cron that writes a
`buy_signals`/leaderboard cache table (R-008-safe — derived metadata, not eBay listings).

---

## (d) Open risks & unknowns

- **Scrydex dollar pricing is UNVERIFIED.** `scrydex.com/pricing` + `/docs` returned HTTP 403 to
  automated fetch and search snippets never surfaced dollar amounts. The credit model (1/3/5
  credits) and the population claim are confirmed; the price is not. **Get a quote before
  choosing it.**
- **PriceCharting's API-enabling tier cost is UNVERIFIED.** The ~$6/mo · $59/yr figure is a
  collector-tier price from a search snippet; historically API access has required a higher tier.
  The `api-documentation` page blocked automated fetch. Doesn't matter unless we lean on
  PriceCharting harder — PokeTrace already covers the ladder.
- **PokemonPriceTracker pricing discrepancy.** General pricing page = Business $99/mo with Pop
  Reports; a separate PSA-API landing page lists $19/$49/$149. Confirm which product/tier actually
  unlocks the pop dump at signup.
- **Caching/storage rights for the chosen pop source are load-bearing and must be confirmed in
  writing** before building B.4. The whole point of B.4's precompute-and-cache architecture is to
  decouple from eBay's R-008 no-cache constraint — that only works if the *population* source
  permits storing derived values. PokemonPriceTracker's daily pop dump strongly implies caching is
  allowed; **confirm redistribution terms.** Scrydex: unknown.
- **ID mapping is real work.** Our card identity is PokeTrace UUIDs / Foil slugs. Any pop source
  uses its own IDs. Expect a `*_id_map` table + a reconciliation pass (we already do this for
  PriceCharting; same shape, same fuzzy-match failure modes).
- **Population freshness & coverage (vintage vs. modern) per source is unverified.** Pop reports
  are cumulative and update at different cadences; thin-pop modern cards may lag.
- **eBay quota.** A leaderboard must NOT fire a Browse call per row at render (R-012). B.4's
  cron-precompute design already handles this; don't regress it into a live-per-tile fan-out.

## (e) Honesty caveat to encode in the product (gem % is survivorship-biased)

**The published gem rate overstates a random raw card's odds of grading PSA 10.** PSA population
is the set of cards people *chose to submit* — and they self-select their best-looking copies,
crack-and-resubmit slabs chasing a bump, and don't bother grading obvious low-grade copies. So:

> A 35% gem rate means **"of the copies people chose to grade, 35% came back PSA 10,"** NOT
> **"a raw copy off the shelf has a 35% chance of being a PSA 10."** The real-world odds for an
> unscreened raw card are materially lower.

Additional honesty notes for the UI/methodology page:

- Pop counts are **cumulative all-time** and include resubmission/crackout inflation (the same
  physical card can appear in the count more than once over its life).
- **Grading standards drift** across years; a PSA 10 from 2016 and 2026 aren't identical bars.
- Present gem % as a **scarcity/relative signal between cards**, never as a personal grading-odds
  prediction. This is the same anti-hype discipline as the buy-signal (Gate 13 / ADR-053).

---

## Decisions for John

1. **Pick the population source.** PokemonPriceTracker Business (~$99/mo, has a cacheable pop
   dump — recommended) vs. Scrydex (consolidation play — but get a price quote first) vs. ship the
   leaderboard *without* a gem-% column at launch and add it later. (Scraping PSA via Apify is a
   ToS-risk fallback, not a primary.)
2. **Bolt-on vs. consolidate.** Add a pop client onto the current stack (fastest), OR fold this
   into the long-pending **Scrydex migration eval (ROADMAP #15)** and replace PokeTrace + Pokemon
   TCG SDK + add population in a single subscription. Decide whether the leaderboard is the
   trigger to finally run that eval.
3. **Get caching/storage rights in writing for the chosen pop source** before B.4 is built — the
   precomputed-leaderboard architecture depends on it being legal to store derived population
   values (unlike eBay R-008).

---

## Follow-up 2026-06-04 (part 2) — live pop-field check + PSA link feasibility

*Verify-only follow-up. Premise re-checked: this doc's part-1 finding (PokeTrace Scale + PriceCharting = no population field) confirmed; `.env.local` holds working `POKETRACE_API_KEY` (len 51) + `PRICECHARTING_API_KEY` (len 40). A temporary throwaway probe (modeled on `scripts/probe-pricecharting.ts`) hit both LIVE APIs, dumped full raw JSON, scanned every key path, then was deleted (not committed).*

### (A) Population field — definitively ABSENT in both providers' LIVE responses

The part-1 conclusion was doc-based; this confirms it against the wire. Probe called the real APIs for Base Set Charizard + Pikachu (PokeTrace `/v1/cards/{uuid}?market=US`) and the matching PriceCharting `/api/product?id=`. Every key path was collected recursively and matched against `/pop|census|population|gem|distribut|graded.?count|grade.?count|cert.?count/i`.

**Result: 4/4 probes → `POP-LIKE KEY MATCHES: NONE`.** Full leaf-field universe observed:

- **PokeTrace** — card-level: `id, name, cardNumber, set{slug,name}, variant, rarity, productType, productFamily, image, game, market, currency, refs{tcgplayerId,cardmarketId}, marketplaceUrls{tcgplayer,cardmarket,ebay}, prices{}, conditionOptions[], gradedOptions[], hasGraded, topPrice, totalSaleCount`. Per price-snapshot: `avg, low, high, avg1d, avg7d, avg30d, median3d, median7d, median30d, saleCount, approxSaleCount, lastUpdated`.
  - The fields we don't currently parse are **not population**: `gradedOptions`/`conditionOptions` are arrays of *which tiers have a price* (e.g. `["ACE_1","BGS_3",…]`) — no counts; `hasGraded` is a boolean; `topPrice` is a price (cents); **`totalSaleCount` (3437 for Charizard) is summed sold-volume, not slab population.**
- **PriceCharting** — 26 keys: `loose-price, cib-price, new-price, graded-price, box-only-price, manual-only-price, condition-17-price, condition-18-price, bgs-10-price, retail-{loose,cib,new}-{buy,sell}, gamestop-price, gamestop-trade-price, sales-volume, console-name, product-name, release-date, id, epid, tcg-id, genre, status`.
  - The only count-like field is **`sales-volume` — sold transaction volume, not population.**

**Proof of the saleCount≠population distinction, observed live:** Charizard Base Set #4 PokeTrace `totalSaleCount` = **3,437** (cumulative *sales* across all tiers/sources). PSA's public Pop Report lists this card's PSA population in the **tens of thousands** of graded copies. Different universes — sold-volume cannot stand in for population/gem-rate. **Conclusion: population is absent from both providers, documented AND live. Part-1's gap stands — a population source must come from elsewhere (see part 1: PokemonPriceTracker Business or Scrydex).**

### (B) Can we build a stable PSA pop-report link from data we already have? — Partially, with caveats

**PSA URL structure (from PSA-owned URLs surfaced in search; psacard.com 403s all automated fetch so none were programmatically resolved):**

- **Exact / set-level deep-link:** `https://www.psacard.com/pop/tcg-cards/{year}/{set-slug}/{spec-id}` — e.g. real PSA URLs `…/pop/tcg-cards/1999/pokemon-game/57801` and `…/pop/tcg-cards/2000/pokemon-game/57803`. The trailing **`spec-id` is a PSA-internal numeric id** (set- or card-level) **not derivable from our catalog.**
- **Search page:** `https://www.psacard.com/pop/search` — a **dynamic JS type-ahead** (results render as you type), **not a documented URL-query-param endpoint.** Whether a pre-filled `?q=` works is **UNKNOWN** (couldn't verify — 403).

**Inputs a link needs vs. what we have:**

| Link type | Inputs needed | Have in catalog? | id-map needed? |
|---|---|---|---|
| Bare search (`/pop/search`) | none (user types) | ✅ | none — but **no pre-fill**, dumps user on blank search |
| Pre-filled search (`/pop/search?q=…`) | query string | ✅ name/set | **UNKNOWN if `?q=` works** (403, unverified) |
| Set-level page | year + set-slug + **set spec-id** | year ✅, set name ✅ (slug derivable), **spec-id ❌** | **set→spec-id map** (~150 sets — small) |
| Exact card page | + **card spec-id** | name/number/year ✅, **card spec-id ❌** | **card→spec-id map** (~18k cards — large) |

We have card name, set name, collector number, and release year (SDK metadata). We have **no PSA spec-id at any level** — that's the missing key for any deep-link.

**Candidate URLs (for John to click-test — automated resolution blocked by PSA 403):**

1. Bare search, then type the card: `https://www.psacard.com/pop/search`
2. Pre-filled search guess (UNVERIFIED `?q=`): `https://www.psacard.com/pop/search?q=Charizard%20Base%20Set`
3. Real set-level page (should list Charizard #4): `https://www.psacard.com/pop/tcg-cards/1999/pokemon-game/57801`
4. Real set-level page (2000 set): `https://www.psacard.com/pop/tcg-cards/2000/pokemon-game/57803`

*(Worth a look as more link-friendly third parties: GemRate `gemrate.com/universal-search`, Pikawiz per-set pages e.g. `pikawiz.com/cards/pop-report/baseset` — unverified.)*

**Recommendation (one line):** A truly id-map-free *pre-filled per-card* link is **not feasible today** (PSA search is JS type-ahead with no confirmed query param; set- and card-level deep-links both need a PSA spec-id we don't hold) — cheapest viable is a bare `/pop/search` link (zero infra, user types), and **note the key limitation: a link gives the user the pop page but does NOT give Foil the gem-% number to compute/rank the leaderboard column — that still requires the part-1 population API (PokemonPriceTracker Business or Scrydex).**
