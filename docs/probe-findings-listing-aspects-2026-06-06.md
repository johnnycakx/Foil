# Probe findings — eBay listing item-specifics (build-step-0)

**Date:** 2026-06-06
**Goal:** verified-listing resolver build-step-0 (read-only probe). [DESIGN-VERIFIED-LISTING-RESOLVER.md](DESIGN-VERIFIED-LISTING-RESOLVER.md) §9 #0.
**Method:** live eBay `getItem` `localizedAspects` across eras, per AGENTS.md "no eBay field assumption without an empirical call." 24 listings via ~24 `getItem` + ~13 `search` calls (logged through existing telemetry, surface `manual`). Throwaway probe script deleted after; raw shapes for the two named fixtures persisted to `lib/__fixtures__/ebay-listings/` (R-010 pattern). **Nothing else persisted (R-008).**
**Bottom line:** the design holds. **Set / Card Number / Finish all EXIST** as eBay item specifics with high presence — but their **values are eBay's own strings, not SDK/catalog values**, so matching needs normalization, never raw equality. **Corroborating (John's v1 default) is the right call.** A few concrete design revisions for goal #1, below.

---

## 1. Schema check (code read, zero calls) — what feeds the Product Offer

`app/(site)/cards/[slug]/page.tsx`:
- **Curated tier** → `productSchema.offers` is built from the **live eBay listing** (`best.price.toFixed(2)`, `url: best.affiliateUrl`, lines 202–212).
- **Long-tail tier** → `aggregateOfferFromTcgplayer(card.tcgplayerPrices, canonical)` — a **baked TCGplayer `AggregateOffer`**, **zero eBay calls**, R-008-safe (lines 213–219).
- **Metadata-only** → no `offers`.

**Answer:** the curated Product Offer **does** currently depend on the live eBay listing — BUT a no-eBay-call alternative (`aggregateOfferFromTcgplayer`) **already exists in-code** and curated cards also carry the baked `tcgplayerPrices` it needs.
**§4 revision (applied):** serve **crawlers** the baked `AggregateOffer` instead of a live resolve → Product rich-result markup is preserved for every page with **zero** eBay calls, so the **bot line collapses to near-zero** (contingency only). Live verified Offers remain for human visitors. This is strictly better than spending bot budget.

---

## 2. Per-era presence table (n = sampled listings)

| Era | n | Set | Card Number | Finish | Language | Graded* | Card Condition |
|-----|---|-----|-------------|--------|----------|---------|----------------|
| vintage (Base/Neo/Jungle/CLV) | 6 | 6/6 | 6/6 | 5/6 | 5/6 | 2/6 | 1/6 |
| mid (EX/DP/Plasma) | 6 | 6/6 | 5/6 | 5/6 | 5/6 | 1/6 | 1/6 |
| modern (SWSH/SV/Champions Path) | 6 | 5/6 | 5/6 | 5/6 | 5/6 | 1/6 | 2/6 |
| graded (PSA/BGS slabs) | 4 | 3/4 | 3/4 | 1/4 | 1/4 | 0/4 | 1/4 |
| FIXTURE jp `117223259644` | 1 | ✓ | ✓ | ✓ | ✓ (Japanese) | – | – |
| FIXTURE en `257548819927` | 1 | ✓ | ✓ | ✓ | ✓ (English) | ✓ | – |

\* `Graded` = the literal `Graded: Yes` aspect. **It is unreliable** — see §4: graded slabs frequently carry `Grading Company` / `Grade` / `Professional Grader` and top-level `condition: "Graded"` **without** a `Graded: Yes` aspect.

**Read:** Set/Number/Finish presence is **far higher than the design feared** (it worried vintage would lack them). Vintage is the *strongest* era for Set/Number (6/6). The presence gaps are concentrated in: (a) odd listings whose seller used the wrong product (e.g. an Italian "Uragano Plasma" Charizard, a graded slab listed under a bare title), and (b) `Finish`/`Language` occasionally absent on graded slabs.

---

## 3. Observed value formats — the gotchas (this is why the probe existed)

**Set** — eBay's own catalog string, **NOT the SDK setName**. Raw equality will NOT work; needs an alias/normalization map + fuzzy contains:
- `"2000 Neo Genesis"` (JP) vs `"Neo Genesis"` (EN) — same set, different strings.
- `"Base Set"`, `"Jungle"`, `"Trading Card Game Classic"`, `"World Championship Decks"`, `"EX Dragon Frontiers"`, `"Diamond and Pearl Promos"`, `"Mysterious Treasures"`, `"Plasma Storm"`, `"Champions Path"`, `"Sword & Shield - Lost Origin"`, `"SV01: Scarlet & Violet Base Set"`, `"Promo Cards"`.
- Foreign-set tell: `"Uragano Plasma"` (Italian "Plasma Storm") — a **Set string can itself reveal a wrong-market listing** even when `Language` is absent.

**Card Number** — many formats; extract the leading numeric token, tolerate zero-padding, treat promos as alphanumeric:
- `"No. 157"` (JP), `"18/111"`, `"004/102"` vs `"4/102"` (zero-pad), `"006/034"`, `"97/101"`, `"9/123"`, `"136/135"` (secret-rare left>right — real, do NOT "correct"), `"074/073"`, `"081/198"`, `"4/130"`, bare `"4"`, promo `"DP46"`, junk `"2025"`.

**Finish** — maps to variant; needs normalization:
- `"Holo"`, `"Holofoil"`, `"Unlimited Holofoil"` (edition+finish mixed), `"Reverse Holo"`, `"Regular"`.

**Language** — `"English"` / `"Japanese"`. Present ~83% raw, **lower on graded slabs**. When absent we cannot apply the English gate from this field alone.

**Graded** — the reliable signals are the trio `Grading Company` (`"PSA"`), `Grade` (`"9"`), `Professional Grader` (`"Other"`) **plus** top-level `condition: "Graded"` — NOT the `Graded: Yes` aspect (often blank on real slabs). `Card Condition` (raw tier, e.g. `"Moderately played (Very good)"`) is **rare** (~1/6), confirming the design: raw condition still leans on title + top-level `condition: "Ungraded"`.

---

## 4. Design revisions the data forces (for goal #1)

1. **Set match = normalize, never equate.** Build an SDK-setName → eBay-Set alias map + a normalized `contains` (strip year prefixes like "2000 ", set-code prefixes like "SV01: ", punctuation). Treat a **foreign-set string** (e.g. an Italian/Japanese set name) as a market-reject signal even when `Language` is absent.
2. **Number match = numerator extraction + zero-pad tolerance.** Compare `parseInt(leading numeric token)` to `card.number`; promos (`DP46`) match on the alphanumeric token. Never "correct" left>right secret-rare numbers (CLAUDE.md rule).
3. **Graded detection ≠ `Graded: Yes`.** Detect graded via ANY of `Grading Company` / `Grade` / `Professional Grader` / top-level `condition === "Graded"`. `condition-infer.ts::conditionFromAspects` currently checks `Graded`/`Grade`/`Professional Grader` but **not** `Grading Company` nor the top-level `condition` — **add both** (the probe saw graded slabs that would otherwise misclassify).
4. **Language gate when present; title-fallback when absent.** Hard-exclude when `Language` says non-English. When `Language` is absent, fall through to the existing title market-markers (`condition-infer.ts::MARKET_RE`) + the foreign-Set tell (#1); do **not** auto-pass a no-Language listing as English on faith. (The known JP-Typhlosion bug is caught regardless: it carries `Language: Japanese`.)
5. **`getItem` must capture top-level `condition`** (`"Graded"` / `"Ungraded"`) in addition to `localizedAspects` — `getListingAspects` today returns only the flattened aspect map and drops it. Goal #1's resolver read should keep `condition`.

---

## 5. RECOMMENDATION — strict vs corroborating, per era

**Confirm John's v1 default: CORROBORATING.** The data *would* support near-strict (Set/Number presence is 83–100% in raw eras), but corroborating is correct because:
- **Value normalization is non-trivial** (§3) — a strict equality gate would false-REJECT legitimate cards on string mismatch ("2000 Neo Genesis" ≠ "Neo Genesis") far more often than it false-ACCEPTs wrong cards. Corroborating (enforce when confidently matched, fall back to title-number cross-check when not) is safer until the alias map is proven.
- **Hard gates that the data supports as reliable:** **Language** (when present), **graded-vs-raw** (via the trio + top-level condition), **Finish** (75–83%, normalizable). These are the §7 hard gates.
- **Set + Number = corroboration with presence-rate + match-rate telemetry.** Promote toward hard per-era once the alias/normalizer match-rate is measured in production (the design's telemetry hook).

**Per-era nuance for the telemetry to watch:**
- **vintage / mid / modern raw:** Set/Number present ~83–100% → corroboration will fire often; good signal.
- **graded slabs:** Finish/Language thinner → lean on the graded trio + Set/Number; don't require Finish.

**No design revision is forced beyond §4's five items** — the core resolver (one gate, verify-before-display, null-over-unverified, k=4, corroborating Set/Number) stands. The probe **de-risked** it: the identity aspects exist and are rich; the work is normalization, not a redesign.

---

## 6. Fixtures saved (for goal #1)

- `lib/__fixtures__/ebay-listings/jp-typhlosion-117223259644.json` — the regression reject (Language=Japanese, Set="2000 Neo Genesis", Number="No. 157", Finish="Holo").
- `lib/__fixtures__/ebay-listings/en-typhlosion-neo-genesis.json` — an English positive (Language=English, Set="Neo Genesis", Number="18/111", Finish="Holo"; happens to be a PSA 6 → doubles as a graded-path positive).

**Catalog reconciliation flag (not a resolver bug):** every English Neo Genesis Typhlosion listing numbers it **18/111**, but the catalog slug is `neo1-17`. Confirm the catalog's stored number for `neo1-17` vs the canonical 18/111 before goal #2 wires the Number corroboration, so a correct listing isn't corroboration-dinged by a stale catalog number.
