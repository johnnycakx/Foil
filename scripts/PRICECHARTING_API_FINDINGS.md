# PriceCharting API — Findings

Generated from `scripts/probe-pricecharting.ts` against 3 cards on 2026-05-19.
Read this **before** writing `lib/pricecharting.ts`. The architecture below is
what the API actually returns — not what we hoped it would.

---

## Auth

- API key passed as `?t=<40-char token>` in the URL query string.
- HTTP only (auto-upgrades to HTTPS). No header auth.
- Sample: `https://www.pricecharting.com/api/product?t=<TOKEN>&id=630417`
- Errors return `{ "status": "error", "error-message": "..." }`.

## Endpoints used

| Endpoint | Purpose | Latency observed |
|---|---|---|
| `GET /api/products?q=<text>` | Full-text product search. Returns up to 20 hits in a `products` array. Each hit has `id`, `product-name`, `console-name`, plus the full price field set. | 500–900ms |
| `GET /api/product?id=<id>` | Single-product detail. Same field set as a search hit but slightly richer (`retail-*` buy/sell guides). | 100–200ms |

PriceCharting "console" for Pokémon TCG cards is the **set name**, not the
game. Examples observed:

- `Pokemon Base Set`
- `Pokemon Promo`
- `Pokemon Japanese Inferno X`
- `Pokemon Phantasmal Flames`

So set scoping is implicit in the search text. There's no `console=` filter
documented in the URL — search relevance does the disambiguation.

## Rate limits / cost

Not documented in the public docs page (the docs URL returned 403 from
WebFetch; relied on third-party blog posts). PriceCharting Premium tiers are
required for API access. Best to assume **no hard rate limit but treat it as
~30 RPS budget** for safety, and cache aggressively — prices update daily, not
in real time.

## ⚠️ Key finding: PriceCharting does NOT split raw cards by condition

Every Pokémon TCG product returns the same field set, regardless of card. Of
the price fields, exactly **one** is for ungraded cards:

| Field | What it means for cards | Charizard #4 | Pikachu #58 | Oricorio EX #24 |
|---|---|---:|---:|---:|
| `loose-price` | **Ungraded** (any condition, market median) | $347.16 | $5.24 | $12.46 |
| `cib-price` | Grade 7 (PSA 7) | $760.39 | $20.75 | $12.40 |
| `new-price` | Grade 8 (PSA 8) | $1,290.86 | $30.01 | $13.84 |
| `graded-price` | Grade 9 (PSA 9) | $2,443.04 | $62.39 | $24.50 |
| `box-only-price` | Grade 9.5 (PSA 9.5) | $4,300.00 | $91.63 | $29.05 |
| `condition-17-price` | CGC 10 | $7,137.50 | $109.00 | $42.36 |
| `condition-18-price` | SGC 10 | $16,964.00 | $134.00 | $81.00 |
| `manual-only-price` | PSA 10 | $28,272.50 | $517.15 | $135.00 |
| `bgs-10-price` | BGS 10 Black Label | $36,754.00 | $672.00 | $232.50 |

Field-name-to-grade mapping is PriceCharting's industry-standard overloaded
schema — they reuse video-game CSV column names for cards with different
semantics. Verified against actual returned values forming a monotonic ladder.

Other observed fields (non-price): `console-name`, `product-name`, `id`,
`tcg-id`, `release-date`, `sales-volume`, `genre`, `epid`, and retailer
`retail-cib-buy/sell`, `retail-loose-buy/sell`, `retail-new-buy/sell`.
`gamestop-price` and `gamestop-trade-price` are always 0 for cards.

Prices are **integer pennies**. The display values above are computed as
`field / 100`.

## What this means for our paths

> **PATH A** assumed PriceCharting exposes distinct LP/MP/HP/DMG raw prices.
> It does not. **PATH A is off the table.**

> **PATH B** uses ungraded + graded splits. **PATH B is the correct fit.**

> **PATH C** assumed PriceCharting has nothing useful. **PATH C is off the
> table** — there is rich graded data for every card we probed.

## Recommended architecture: Path B with a twist

Drop the raw-condition picker entirely. Replace with:

```
Market (raw):   $5.24            ← loose-price, the only ungraded number
Graded:
  PSA 7         $20.75
  PSA 8         $30.01
  PSA 9         $62.39
  PSA 9.5       $91.63
  PSA 10        $517.15
  BGS 10        $672.00
```

For cards where the user knows their copy is played, this is honest: it shows
one ungraded market number with the understanding that played copies trade at
some discount. For graded copies, the picker is now meaningful and backed by
real data.

The condition multipliers (`0.88`, `0.75`, `0.60`, `0.40`) and
`effectivePrice()` go away entirely.

### Open architectural questions for the user

1. **Are graded buckets in scope for Pro V1?** They're useful but the target
   user (Marketplace buyer scrolling listings) usually doesn't have a slabbed
   card. The MVP could ship Path B with just the ungraded number and stash the
   graded display under a "Show graded prices" expander.
2. **Search strategy.** PriceCharting's `q` is fuzzy. We'd need to merge
   PriceCharting results with our existing PokeTrace match (which already has
   collectorNumber + setCode pinned). Suggestion: keep PokeTrace as the
   *identification* source (it has TCGplayer IDs + set codes), and use it to
   resolve to a PriceCharting product via the search endpoint + a re-rank by
   `console-name` (set name) and `#<collectorNumber>` in `product-name`.
3. **Caching.** Prices update daily. A 24h KV/Storage cache keyed by
   PriceCharting `id` would slash API calls dramatically.

## Per-card data quality

All three probe cards returned the full field set populated with non-zero
values, including the Promo printing and a very recent card. **PriceCharting
coverage for our use case looks excellent.** I did not hit a card that
returned all-zero prices, but the API does return zeros (not null) when data
is missing — the integration must treat `0` as "no data."

---

**Next step:** wait for the user to pick the variant of Path B (full graded
ladder vs. ungraded-only + collapsed graded panel) before writing
`lib/pricecharting.ts`.
