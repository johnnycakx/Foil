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

---

# Certification addendum (2026-06-07) — decision-accuracy certification of the resolver

**Goal:** certify **100% DECISION accuracy** — every admit and every identity-gate reject the resolver makes is provably correct — NOT 100% coverage. An honest null on a card with no verifiable listing is a correct decision; no gate was loosened to manufacture coverage. Method: a full live sweep → classify EVERY reject with cited evidence (aspects / full getItem / fixture) → fix true false-rejects + pin → re-audit → measure the recoverable-coverage levers. Live budget for the whole loop: **~1,610 / 2,500 calls**, logged via `browse_calls` (surface `manual`). No eBay listing data persisted (R-008); the dumps were ephemeral OS-temp files, deleted at loop end.

## Decision-accuracy statement (the deliverable)
On the post-fix full sweep (207 curated, k=4, ANY_RAW):

| | count | certification |
|---|---|---|
| **Verified admits** | **149** | **0 false-accepts** — every admit has a matching Card Number aspect (numerator == SDK, zero-pad tolerant), English-or-absent Language, and is not a graded slab. |
| **Identity-gate rejects** | **56** | **0 false-rejects** — every reject hand-audited to a genuinely different card (wrong print / foreign / graded slab / different set), confirmed against the listing's own eBay aspects. |
| **Prefilter nulls** | **2** | NOT identity-gate decisions — see "out of scope" below. |

**Every identity decision the resolver makes is provably correct.** The one false-reject found was fixed; the verified side is clean.

## Coverage (reported, not chased)
| Sweep | Verified | Null | Coverage | Calls |
|---|---|---|---|---|
| Pre-fix (k=4) | 144 | 63 | **69.6%** | 686 |
| **Post-fix (k=4)** | **149** | **58** | **72.0%** | 680 |

Run-to-run delta is live-listing rotation (±3) plus the +1 from the fix below. Post-fix null distribution: **37 number · 8 language · 6 set · 5 graded · 2 prefilter**.

## The one FALSE reject — found, fixed, pinned, flipped
**`neo2-9-poliwrath`** (a $12 raw English Neo Discovery #9 **holo**) was wrongly rejected as graded for an ANY_RAW request. Root cause: `detectGraded` treated ANY `Grade` aspect as a slab signal, and this raw listing carried a stray `Grade="9"` (the CARD NUMBER leaking into eBay's Grade field); a sibling carried `Grade="Heavily Played (Poor)"` (a condition phrase). **Fix (`fix(listing)` commit):** an explicit `Graded="No"` or top-level `Ungraded` now **vetoes the weak bare-`Grade` signal**, while the STRONG signals (top `Graded`, `Graded="Yes"`, Grading Company / Professional Grader / Grader) remain authoritative and win outright. Resolver-only (`lib/listing/identity.ts`); the live buy-signal classifier is untouched. Pinned by an R-010 fixture + 5 unit tests. Live re-run: `neo2-9` flips null→verified; genuine slabs (`base6-3` CGC9/PSA6, `swsh9-18` PSA9) stay correctly null.

**Why the fix is zero-false-accept (validated, not asserted):** the post-fix sweep surfaced **6 PSA slabs the seller had mis-tagged `Graded="No"`** (`base3-13-muk`, `swsh12pt5-19`, `base4-1-alakazam`, `gym1-14`, `neo1-14`, …) — each carrying `Professional Grader = "PSA"`. A naive "Graded=No ⇒ raw" veto would have **admitted all 6 as raw (false-accepts)**. Because the strong signal wins before the veto, they stay correctly graded. The fix recovers the genuine raw false-reject without admitting a single mis-tagged slab.

## Out of scope (reported as goal #2 inputs, per the loop's stop-and-report limits)
1. **Prefilter false-nulls — `base6-1-alakazam`, `base6-4-dark-blastoise` (and the Legendary Collection set generally).** The shared picker's `TITLE_JUNK_KEYWORDS` includes `"collection"`, which collides with the **set name "Legendary Collection"** and drops every such listing; the price-outlier filter additionally drops cheap holos against a reverse-holo/slab-inflated median. These are cost-optimizer (picker) drops *before* the identity gate, not gate decisions — genuine cheap listings exist ($25–45 Alakazam holos; $15 Dark Blastoise). **Fix touches `lib/affiliate/listing-picker.ts`, which the live consumers share → goal #2** (and risks reintroducing the ADR-026 junk-listing bug if loosened naively). Recommend: exempt the card's own set name from the junk-keyword match + reconsider the outlier filter for bimodal-price cards.
2. **Candidate starvation — the dominant *recoverable* null class.** The catalog card is the **holo** (vintage #1–16) or the **regular** (modern), but cheaper non-holo reprints / secret-rares fill the cheapest-`k=4`. Two levers measured on the null slice:
   - **Finish-aware query (highest-value, SAFE):** appending the finish word to the search recovered **12/12 sampled vintage holos** (Jungle/Fossil/Team Rocket/Gym). Spot-checked clean — the verified candidates carry the **correct Card Number aspect** (`01/64`=#1, `1/62`=#1, `8/82`=#8) and `Finish="Holo"`; the resolver correctly trusts the structured aspect over misleading seller *titles* ("17/64", "16/62"). Zero false-accept in the sample. This safely addresses most of the 37-card number-null bucket. Recommend implementing in goal #2 (bias the query by the catalog card's finish/rarity).
   - **k=6/k=8 (modest):** k=8 recovered **3/10** graded+modern nulls (`shaymin-v` at rank 6, `giratina-v-alt-art` raw at rank 4; one was rotation) at up to +4 getItem/card. All flips were correct admits. Lower yield than finish-query.
   - k=4 is John's recorded design decision and a finish-aware query is a search-construction change → both **reported, not implemented** this goal.
3. **Contradictory-listing rejects (correct under null-beats-unverified).** A few rejects are listings whose structured aspect contradicts their title — e.g. `neo1-12-pichu` (title "Neo Genesis 12/111", but Set aspect = "Astral Radiance"); `neo1-17-typhlosion` (title "#17/111", but Card Number aspect = "111", the set size). The resolver refuses these (it trusts the verified aspect; the data is self-contradictory). Correct/conservative. Noted as a design nuance: when Number matches exactly and the title corroborates the set, John may later choose to down-weight a mismatched Set aspect — a goal #2 judgment, NOT a fix here. **`neo1-17` confirmed a real card** (SDK: Neo Genesis has Typhlosion #17 *and* #18, both Rare Holo) — the 2026-06-06 catalog-reconciliation flag is resolved (two real cards, not an error).

## Not recoverable (correct refusals — the product working as designed)
8 **language** nulls (Japanese/German/Italian, confirmed by the Language aspect or `(Jp)`/`Italian`/`No.xxx` markers) and 5 **graded** nulls (genuine PSA/CGC/BGS slabs, raw copy beyond k or a slab-only market). These are the honest "no verified English raw listing right now" — the design's whole point.

## Projected goal-#2 ceiling (if the SAFE levers land, no gate loosening)
149 verified today + ~25 (finish-aware query) + ~2–6 (picker "collection" fix) + ~2–3 (k bump) ≈ **~85–90% coverage**, with the residual being correct refusals (foreign-market, slab-only, contradictory-data). **The accuracy bar is already met at k=4; coverage is a goal-#2 lever set, not an accuracy problem.**

## Exit
Zero known false-rejects (the one found is fixed + pinned); zero false-accepts observed; every audited identity reject is evidence-classified CORRECT; all fixes carry regression tests. Loop closed. **John reviews this before goal #2** (per-card page migration onto the resolver).
