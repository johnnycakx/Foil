# Foil Pokémon Card Identification Framework

This document defines the rules that govern how Foil reads, identifies, and prices Pokémon TCG cards from user-uploaded photos. **Read this before changing `lib/vision.ts`, `lib/poketrace.ts`, `lib/vision-confirm.ts`, `lib/vision-retry.ts`, or `lib/low-confidence-gate.ts`.**

The framework exists because consumer trust degrades fast when a card scanner confidently misidentifies a card. A single inflated total ("your stack is worth $400" → actually $40) is more damaging than ten honest "needs review" results. Every rule below is here to keep the system honest under uncertainty rather than helpful at the cost of accuracy.

---

## 1. Core principle: null over guess

> Return `null` rather than a fabricated value. Mark `insufficient_information` rather than emit a wrong identification.

This is the only principle that overrides every other instinct the model has. Vision-LLMs are trained to be helpful, which manifests as filling in fields with plausible-but-wrong values when the source is illegible. For a card scanner, plausible-but-wrong is the worst possible failure mode: it produces a confident price for the wrong card, which is what we are explicitly trying not to do.

**Concretely:**

- If a field is not legible on the crop → `null`.
- If a 3-letter set code is partially obscured → `setCode: null`, raw bytes go in `setCodeRaw`.
- If a collector number is smudged → `collectorNumber: null`.
- If `name` AND (`setCode` OR `collectorNumber`) are all `null` → `status: "insufficient_information"` with an `insufficientReason` describing what was unreadable.

A card surfaced as "needs review" is a successful outcome of the pipeline. It is not a failure to recover from.

---

## 2. The primary key: collector number + set code

The printed identity of a Pokémon card is **collector number + set code**, not the Pokémon's name. The name is ambiguous (there are dozens of Charizards across sets and printings) and the artwork is even more ambiguous (different illustrators draw the same Pokémon across reprints, and Foil deliberately ignores artwork to avoid name-from-art guessing).

The pipeline scores PokeTrace matches in this order (see `lib/poketrace.ts` → `score()`):

| Signal | Score |
| --- | --- |
| Exact collector number match (`cardNumberForms` includes PokeTrace's `cardNumber`) | +100 |
| Bare collector number match (left side of `XXX/YYY`) | +60 |
| Set code → set slug exact match (`SET_CODE_TO_SLUG`) | +50 |
| Fuzzy set name match (full equality) | +30 |
| Fuzzy set name match (substring) | +20 |
| Variant compatibility (rarity → expected finishes) | +20 |
| Source has usable prices | +15 |
| Name equality (case-insensitive) | +10 |

Name is the weakest signal in this stack on purpose. A perfect name match with a wrong number is the wrong card.

---

## 3. Numbering rules

### 3.1 Left number can exceed right number

`XXX/YYY` where `XXX > YYY` is a real, legitimate **secret rare** — it is not a typo and not a fake. Examples in the wild:

- `188/132` from a 132-card set
- `201/108` from a 108-card set
- `225/197` from a 197-card set

The Vision prompt is explicitly instructed: **never auto-correct these.** The number on the card is the source of truth. The pipeline trusts the printed value and looks up PokeTrace by it directly.

If a tool, helper, or test ever assumes "left ≤ right" — it is wrong. Delete the assumption.

### 3.2 Promo codes use a prefix, not a slash

Promo cards have a black star with "PROMO" instead of a set symbol. Their identifier is a prefix code with no slash:

- `SVP027` — Scarlet & Violet Promo #27
- `SWSH262` — Sword & Shield Promo #262
- `SM210` — Sun & Moon Promo #210

The pipeline treats these as the `collectorNumber` field directly and does not attempt to parse them into `XXX/YYY`.

### 3.3 Zero-padding is tried, not assumed

When looking up a card via PokeTrace, the pipeline expands the user-readable number into multiple equivalent forms (`cardNumberForms`):

- `4/102` → `["4/102", "004/102", "004/102"]`
- `188/132` → `["188/132"]` (no padding ambiguity)

PokeTrace's API is inconsistent about whether it stores `4/102` or `004/102`. The lookup tries all forms and takes the first hit. The pipeline never modifies the user-visible value; the variants exist only for the lookup attempt.

---

## 4. Set codes are atomic

The 3-letter set code printed in the SV era (2023+) is the **canonical set identifier**. It is not a stand-in for a set name that can be translated or expanded.

### 4.1 The reference table is exhaustive

The Vision prompt ships with a fixed table of known SV-era codes:

```
SVI = Scarlet & Violet Base · PAL = Paldea Evolved · OBF = Obsidian Flames
MEW = Pokemon 151 · PAR = Paradox Rift · PAF = Paldean Fates
TEF = Temporal Forces · TWM = Twilight Masquerade · SFA = Shrouded Fable
SCR = Stellar Crown · SSP = Surging Sparks · PRE = Prismatic Evolutions
JTG = Journey Together · DRI = Destined Rivals · BLK = Black Bolt
WHT = White Flare · MEG = Mega Evolution
```

If the 3-letter code the model reads is **not** in this table, the prompt requires `setCode: null` and the raw bytes go in `setCodeRaw`. The model never invents a code.

When a new set releases, the table in `lib/vision.ts` AND the `SET_CODE_TO_SLUG` map in `lib/poketrace.ts` AND `SET_CODE_TO_REGULATION_MARK` (if applicable) must all be updated together. They are coupled by definition.

### 4.2 Older cards use set symbols, not codes

Pre-2023 cards predate the 3-letter code system. They have a set symbol graphic in the same location. The Vision prompt routes those into `setSymbolDescription` (free text) and leaves `setCode: null`. Lookup falls back to fuzzy set name match via `setName` if the model can identify the set from the symbol; otherwise it surfaces as a low-confidence match and the gate (§7) decides.

### 4.3 Partial codes go in `setCodeRaw`

If the model can read "SV?" but the third letter is unreadable, the prompt requires `setCode: null, setCodeRaw: "SV?"`. This preserves the signal for the retry pass (§8) without committing to a guess.

---

## 5. Regulation marks gate the era

The single letter in the bottom-left square (D / E / F / G / H / I) encodes the legality era and acts as a coarse era check on the set code.

| Mark | Era | Sets |
| --- | --- | --- |
| D | SWSH base (2020) | — |
| E | SWSH mid (2021) | — |
| F | SWSH late + Crown Zenith (2022) | CRZ |
| G | SV base (2023) | SVI, PAL, OBF, MEW, PAR, PAF |
| H | TWM onward (2024) | TEF, TWM, SFA, SCR, SSP, PRE |
| I | BLK/WHT onward (2025+) | JTG, DRI, BLK, WHT, MEG |

The `regulationCompatible()` check in `lib/poketrace.ts` uses this as a soft filter: if the printed mark on the card disagrees with the expected mark for a candidate set, the candidate is rejected. This catches the failure mode where the model reads the right Pokémon and the right number but the wrong set — the mark is the lie detector.

Missing mark (unreadable, or a pre-D-era card) → no filter applied. Don't penalize what we can't read.

---

## 6. The pipeline order

The pipeline lives in `app/upload/actions.ts` and runs in this order. Each step has a defined output that the next step consumes.

```
1. DETECT       — Vision returns bounding boxes per card on the input image
2. FILTER       — Drop edge slivers, low-confidence boxes, weird aspects; merge duplicates
3. CROP         — Per-card crops, lanczos3, 1024–1600px long edge
4. IDENTIFY     — Vision reads printed fields on each crop (null over guess)
5. PRICE        — PokeTrace lookup, scored by collector # + set code (§2)
6. GATE         — Low-confidence name-only matches require visual confirmation (§7)
7. RETRY        — Failed lookups get one Opus pass with PokeTrace candidates as context (§8)
8. AGGREGATE    — Per-card prices roll up to a total + overall confidence
```

### 6.1 Why detect then identify, not detect-and-identify together

Two passes with one job each beats one pass with two jobs. The detector's only job is "where are the cards?"; the identifier's only job is "what does this one card say?" Telling Sonnet to do both at once produces worse output on both — the bounding boxes get sloppier and the per-card reads get less careful because attention is split.

### 6.2 Why the post-detect filter exists

The detector over-detects. It returns:

- Edge slivers — cards bleeding off the photo's frame.
- Half-cards behind a stack where only a corner is visible.
- Two boxes on the same printed card.
- The occasional sleeve or top-loader edge.

`lib/detect-filter.ts` strips these:

| Filter | Threshold |
| --- | --- |
| Minimum area | 1.5% of image area |
| Minimum detectionConfidence | 0.55 |
| Aspect ratio (short/long, strict) | 0.55 – 0.95 |
| Aspect ratio (loose, binder mode) | 0.45 – 1.0 |
| IoU merge threshold | > 0.35 → keep higher-confidence box |

**Binder mode** auto-engages when strict aspect drops more than 50% of conf-survivors AND there are at least 4 raw detections. This is the heuristic for "tilted binder photo" — wide-aspect boxes get a more forgiving window without leaking non-card boxes on single-card shots.

### 6.3 Crop sizing

Vision quality on small printed fields (collector numbers, set codes, regulation marks) collapses below ~1024px on the long edge. `lib/crop.ts` upscales anything smaller with lanczos3, and caps at 1600px to keep per-crop wire bytes reasonable. Crops are JPEG q88.

---

## 7. The low-confidence visual gate

PokeTrace returns three match flavors:

1. **High-confidence**: collector number + set code agree exactly. Trust and price.
2. **Low-confidence (`lowConfidence: true`)**: name fuzzy-matched, set or number disagreed or was null. PokeTrace returns *something* but it may be a different printing entirely.
3. **No match (`matched: false`)**: nothing close. Eligible for retry (§8).

Low-confidence matches are dangerous because they look like valid results to the rest of the pipeline. Example: a Chimchar misread as `MEW #041` fuzzied to POP Series 6 — wrong card, would have shown a price.

**The gate** (`lib/low-confidence-gate.ts`) intercepts every low-confidence pricing and re-verifies it visually:

1. Pull up to 3 PokeTrace candidates (with images).
2. Call `confirmMatch` (Sonnet 4.6, multi-image) with the user's crop + each candidate's reference image.
3. If `chosenIndex !== null` AND `confidence` is `"high"` or `"medium"` → accept the chosen candidate, clear the `lowConfidence` flag, re-price if a different candidate was picked.
4. Otherwise → **demote** the card to `insufficient_information` with reason `"Low-confidence text match failed visual check."`

Medium is accepted here because the same crop's confidence flickers between runs under model nondeterminism. The fresh-rescue path in `actions.ts` requires `"high"` because it operates without the text-match prior.

The gate is the difference between trustworthy prices and confident lies.

---

## 8. The retry pass

Cards that fail PokeTrace (no candidates, low score, regulation mismatch) get one retry pass on Opus 4.5 (`lib/vision-retry.ts`). The retry is given:

- The original crop.
- The previous attempt's legible fields (so it doesn't relitigate what was already read).
- The PokeTrace failure reason.
- Up to N nearest PokeTrace candidates by name, so Opus can compare against real printings rather than re-imagining the card from scratch.

The retry has three valid outcomes:

1. **Correct itself**: re-read a previously-missed field on the crop (e.g. the set code now resolves to PAR instead of `null`). Re-price.
2. **Pick a candidate**: choose one of the PokeTrace candidates IF its name, set, and number visually match. Re-price.
3. **Decline**: return `status: "insufficient_information"`. **The same null-over-guess rule applies on retry.** Opus is not given license to invent.

This is the only place in the pipeline where we spend Opus's compute. The first pass is always Sonnet 4.6.

---

## 9. Visual confirmation (side-by-side)

`lib/vision-confirm.ts` runs Sonnet 4.6 in multi-image mode: user crop first, then N reference images from PokeTrace. The model returns one of:

- `{ chosenIndex: 0..N-1, confidence: "high" | "medium" | "low" }` — its best match and how sure it is.
- `{ chosenIndex: null, confidence: "low" }` — no candidate matches.

What the model is told to compare:

1. Name text at top
2. Pokémon artwork and pose
3. Set symbol or 3-letter code at bottom
4. Collector number
5. Rarity stars
6. Holo / foil treatment
7. Frame style and border

What the model is told to **ignore**:

- Lighting, glare, shadows
- Camera angle, perspective skew
- Edge wear, surface scratches
- Sleeves, top-loader reflections
- Image resolution

This separation matters: identity is intrinsic to the print; condition is extrinsic to the print. Confirmation is identity-only.

---

## 10. Pricing tier policy

PokeTrace emits prices at multiple grade tiers per source. The pipeline collapses them into a unified `PriceQuote[]` (see `lib/pricing.ts`):

- Ungraded preference order per source: `NEAR_MINT` → `AGGREGATED` → `MARKET`. The first usable tier wins; all three collapse into a single `RAW_UNGRADED` quote.
- Graded tiers (`PSA_*`, `BGS_*`, `CGC_*`) are passed through if they hit the fixed UI ladder; off-ladder grades are dropped rather than fabricated into adjacent slots.
- Per-source deduping prevents two competing ungraded quotes from the same source.
- PriceCharting's graded ladder is merged in downstream by the pipeline orchestrator, not by `poketrace.ts`.

The UI ladder is fixed. We never invent a row to fill it.

---

## 11. Language handling

The Vision prompt detects card language and tags it: `EN`, `JA`, `KR`, `ZH`, `DE`, `FR`, `ES`, `IT`, `PT`, or `unknown`. Japanese cards in particular **must not** be translated or treated as their English equivalent — even when the artwork is identical, the collector number, set code, and PokeTrace SKU are different.

Identification rules transfer cleanly across languages because the framework's primary key is `setCode + collectorNumber`, both of which are language-agnostic. The Pokémon's name is the weakest signal regardless of language (§2).

---

## 12. Hard rules for new work

These are the invariants the pipeline depends on. Breaking them silently breaks user-visible accuracy.

1. **Never auto-correct a printed value.** Pass through `188/132`, `SVP027`, illegible-but-partial set codes (via `setCodeRaw`) verbatim.
2. **Never expand the set-code table outside `lib/vision.ts`'s reference list.** If you add a code, add it in all three places (vision prompt, `SET_CODE_TO_SLUG`, `SET_CODE_TO_REGULATION_MARK`) in one commit.
3. **Never accept a low-confidence text match without visual confirmation.** The gate is not optional. If you bypass it for performance, prices will silently go wrong.
4. **Never grade a card from a photo.** Foil estimates condition only as a user-selectable input. We do not auto-grade — PSA grading is its own multi-thousand-dollar industry and we won't pretend to compete.
5. **Never use artwork as a primary identification signal.** Reprints share artwork across sets. Artwork is a confirmation cue at best.
6. **Null is a valid outcome.** Don't add fallback logic that fabricates a value when an upstream step returned `null`.
7. **When a real upload exposes a bug, pin a fixture.** Add a fixture under `lib/__fixtures__/cards/` and a test that fails before the fix and passes after.

---

## 13. Glossary

- **Crop** — A single-card sub-image extracted from the user's upload after detection + filtering.
- **DETECT pass** — Vision call whose only job is to return bounding boxes.
- **IDENTIFY pass** — Vision call whose only job is to read printed fields on one cropped card.
- **Confirmation pass** — Multi-image Sonnet call that visually compares a crop against PokeTrace references.
- **Retry pass** — Opus call on a single failed-PokeTrace card, given previous attempt + candidate context.
- **Low-confidence match** — A PokeTrace result derived from name-only fuzzy matching with no set or collector-number anchor.
- **Demote** — Reclassify a card as `insufficient_information` rather than show a price the gate doesn't trust.
- **Binder mode** — The detect-filter's auto-engaged loose-aspect window for tilted-binder photos.
- **Regulation mark** — The single letter (D–I) in the bottom-left of an SV-era card, used as an era lie-detector against the claimed set.
