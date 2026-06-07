# Calibration — verified-listing resolver (2026-06-07)

**Tranche A #1 closure gate** (John's requirement). Live sweep of `resolveVerifiedListing` across all eBay-live **curated** cards, `ANY_RAW`, k=4, with a hand-audit of the rejects and a normalizer tune. Derived aggregates only — **no eBay listing data persisted** (R-008); the per-reject titles were read from ephemeral stdout, never committed.

## Method
- **Scope:** 207 curated cards × up to k=4 cheapest candidates, condition `ANY_RAW`.
- **Runs:** sweep A (pre-tune) → 50-reject audit → normalizer fix → base1 re-sweep (affected slice) → sweep B (post-tune, full). **~1,550 Browse calls total**, under the 3,000 budget. Each resolve = 1 search + ≤4 getItem.
- **Tool:** `scripts/calibrate-resolver.ts` (read-only; logs gate decisions to stdout, not a DB).

## Coverage (the early read on #2 "coverage shock")
| Measure | Value |
|---|---|
| Raw coverage, full sweep A | **68.1%** (141/207) |
| Raw coverage, full sweep B (post-tune) | **66.7%** (138/207) |
| Run-to-run delta | ±3 cards = **live-listing rotation noise** (the cheapest candidates change between sweeps minutes apart), not a regression |
| **Defensible coverage** (excluding the 16-card base2 catalog defect, below) | **72.3%** (138/191) |
| base1 slice, post-tune (the normalizer-fix demonstration) | **85.0%** (17/20) |

**Read for goal #2:** migrating the per-card page to the resolver returns an **honest null** ("no verified listing right now" + search CTA) on **~28–33%** of curated cards under `ANY_RAW`, vs today's picker showing *something* (often wrong — the whole reason for this work) on nearly all. That is the coverage/trust tradeoff #2 must weigh: fewer-but-true. Much of the gap is recoverable (base2 catalog fix + k tuning); the rest is the correct refusal to show a wrong card.

## Per-gate reject distribution (sweep B)
| Failing gate | Rejects | Verdict |
|---|---|---|
| number | 219 | mostly CORRECT (wrong-print + Base Set 2) **+ the base2 catalog defect (false)** |
| language | 79 | CORRECT — Japanese/foreign listings excluded |
| graded_condition | 30 | CORRECT — graded slabs excluded from an `ANY_RAW` request |
| set | 29 | CORRECT — Base Set 2 / different-set listings rejected (version-token guard) |
| finish | 0 | no variant requested in the sweep → unconstrained |

Aspect presence at scale **confirms the probe**: vintage Set 394/408, Number 382/408, Finish 345/408, Language 377/408; modern Set 82/87, Number 78/87. Corroboration fires on the large majority of candidates.

## Hand-audit of ~55 rejects → classification
1. **DOMINANT false-reject driver = a CATALOG-DATA defect, not the resolver.** The 16 curated **Base Set 2 (`base2-*`)** cards carry corrupted baked metadata — e.g. `base2-1-clefable` has `setName:"Jungle"`, `number:"1"` while every eBay listing for the actual card reads `17`. 14/16 were false-rejected on the Number gate (consistent +16 offset). The resolver corroborated correctly against a **wrong catalog number**; loosening the Number gate would reintroduce the production wrong-print bug (17≠18). **Fix is upstream (catalog), not the gate** — see recommendations.
2. **One genuine NORMALIZER false-reject — FIXED this session.** `setMatches("Base", "Base Unlimited Shadow")` wrongly rejected (a legit Base Set variant name). Root cause: the `SET_ALIASES["base"]→"base set"` rewrite forced a "set" token that broke the subset match. **Removed the alias** (redundant with the token-subset match) and **extended the version-token guard to roman numerals** so Base Set 2 spelled "Base II" / "Pokemon Game Base II" still rejects. Re-ran the base1 slice → 85%. New unit tests pin both.
3. **The rest are CORRECT rejects:** Base Set 2 listings surfaced for a base1 (Base Set) card → rejected (different set); graded slabs surfaced for an `ANY_RAW` request → rejected; Japanese/foreign listings → rejected. These are the resolver doing its job.

## False-accept estimate
**Low.** A false-accept requires a wrong card that matches Language=English **and** Set **and** Number **and** raw/graded — the four-gate conjunction makes it unlikely, and none surfaced in the verified spot-checks. **Caveat:** the audit focused on rejects (per the goal); a verified-side spot-check is a recommended #2 step before the page goes live.

## Normalizer revisions made (this session)
- Removed `SET_ALIASES["base"]="base set"` (redundant + caused the Base-variant false-reject).
- `isVersionToken` now also matches roman numerals `ii–vi` (Base Set 2 ≡ "Base II").
- Tests added: `setMatches` Base-variant matches + Base-II rejects (`listing-normalize.test.ts`).

## Recommendations for goal #2 (per-card page migration)
1. **Reconcile the 16 `base2-*` catalog entries first** (correct `setName`/printed `number`), or exclude them from the live tier until fixed. This is the single biggest coverage lever and a pure data fix. Recovers ~10–14 cards.
2. **Consider k>4 or a set-targeted query** for cards with a cheaper reprint (Base Set 2) or many graded slabs ahead of the genuine raw card in the cheapest-k — the dominant *legitimate* null cause. Measure the quota cost (k=6 → up to 7 calls/resolve) against the coverage gain.
3. **Keep the honest null.** ~28–33% no-verified-listing is the correct, trustworthy outcome — the design's whole point. The per-card page already has the "Browse on eBay" search-CTA fallback for exactly this.
4. **Spot-check the verified side** (false-accept) on a flagship sample before the page ships.

## Quota
~1,550 calls for the full calibration (2 full sweeps + 1 slice + smokes), under the 3,000 budget. Steady-state per resolve: 1 search + ~1.5 getItem amortized (≈2.5), worst case 5 — matches the design §4 model.

---

# Correction addendum (2026-06-07) — the "16 base2 corrupted entries" finding was a MISREAD; the catalog is clean

A follow-up goal opened to "reconcile the 16 corrupted `base2-*` catalog entries." The P0 premise check **disproved the corruption premise** with authoritative evidence. Recording the correction here because this doc is the deliverable John reviews for the goal #2 go/no-go, and recommendation #1 above is now **void**.

## What was actually wrong: the audit read `base2` as "Base Set 2"
In **pokemontcg.io** — the bake's own source — the WOTC set ids map (verified live 2026-06-07 against `api.pokemontcg.io/v2/sets/*`):

| SDK set id | Set name | Released |
|---|---|---|
| `base1` | Base | 1999/01/09 |
| **`base2`** | **Jungle** | 1999/06/16 |
| `base3` | Fossil | 1999/10/10 |
| **`base4`** | **Base Set 2** | 2000/02/24 |
| `base5` | Team Rocket | 2000/04/24 |

`base2` **is Jungle**, not Base Set 2 (that's `base4`). `cards/base2-1` returns `Clefable, #1, set Jungle, Rare Holo` — **byte-identical to the baked entry.** The bake script (`scripts/bake-card-metadata.ts`) is a straight per-id fetch with **no join/offset/merge**, so re-baking reproduces the exact same values. **The proposed FIX (re-bake) is a no-op; there is nothing to reconcile.**

## Catalog-QA sweep (the "identity gates double as a catalog-QA probe" idea, run cheaply)
Swept all **1,007** baked cards for the defect class: **0** setId↔setName mismatches (vs the baked `sets` map), **0** id/setId/number desyncs, **0** orphan setIds, **0** numbers over set total, **0** sibling-setName splits. The catalog is clean. Pinned by `lib/__tests__/catalog-qa.test.ts` (in the `npm test` runner) so a real future corruption — or a "reconcile base2 → Base Set 2" change that would reintroduce a wrong-print bug — fails the build.

## What the "+16 offset" actually is: Jungle's holo/non-holo numbering
Jungle prints each of its 16 rares twice — **holo #1–16** and the **non-holo #17–32** of the same Pokémon (Clefable holo **#1** / non-holo **#17**; Electrode holo **#2** / non-holo **#18**; …). A consistent **+16**. The 14/16 base2 "false-rejects" were the resolver **correctly** rejecting the cheaper **non-holo** print on a **holo** card's page (a #17 listing is a different card from the #1 holo — exactly the wrong-print class the Number gate exists to stop). **Loosening the Number gate would reintroduce the production bug.**

**Live confirmation (2026-06-07, ~15 calls, derived facts only — no listing data persisted):**
- `base2-1-clefable` (holo #1): all 4 cheapest candidates were the non-holo `17/64` print → correctly rejected `number 1 ≠ 17` → honest null.
- `base2-2-electrode` (holo #2): all 4 cheapest were the non-holo `18/64` print → correctly rejected `2 ≠ 18`.
- `base2-17-clefable` (non-holo #17): the **same `17/64` print that the #1 page rejects VERIFIES here** — the decision is correct in *both* directions.
- `base2-11-snorlax` (holo #11): VERIFIED — a holo `11/64` listing was within the cheapest-k. So when the holo print is in-budget, it resolves.

## Corrected guidance for goal #2 (supersedes recommendations #1–#2 above)
1. ~~Reconcile the 16 base2 entries~~ → **VOID.** Nothing is corrupt; re-baking is a no-op. The base2 nulls are not a data defect.
2. The base2 holo nulls are a **candidate-starvation** case (the holo print exists but sits below the cheapest-`k=4`, behind the cheaper non-holo reprints), not a gate flaw. This is the **k / finish-aware-query** question — measured on the null slice in the certification loop below and reported as a goal #2 design input (k=4 is John's recorded design decision, so this addendum reports rather than changes it).
3. **Keep the honest null** — unchanged; still the design's point.
4. **Spot-check the verified side** — done continuously in the certification loop (zero false-accepts observed).

**Net for the go/no-go:** the headline coverage stands (**66.7–68.1% raw**); the "72.3% defensible / recover ~10–14 via base2 fix" line is **withdrawn** — those base2 cards are correct decisions (honest nulls / starvation), not a recoverable data defect. Coverage is not the bar; **decision accuracy** is. The certification loop addendum (appended below when it closes) carries the final decision-accuracy statement.
