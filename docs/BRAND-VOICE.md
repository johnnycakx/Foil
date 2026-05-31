# Brand Voice

**Status:** Canonical. Read by `lib/seo/content-engine.ts` (blog) and `lib/newsletter/draft-generator.ts` (newsletter) as the voice ground truth; enforced structurally by `lib/seo/voice-check.ts` + `BANNED_PHRASES` in `lib/seo/quality-gates.ts`. See [ADR-048](DECISIONS.md#adr-048--brand-voice-integration-into-the-autonomous-content--newsletter-pipelines).

**Synthesized 2026-05-31 (Session 47.5 / Goal V)** from four sources: [STRATEGY-AUDIENCE-MOAT.md](STRATEGY-AUDIENCE-MOAT.md) (John's actual hooks/bio/hero phrasing), [PRODUCT.md](../PRODUCT.md) ("trusted collector concierge" + the 4 anti-references), the Cowork voice research (`tcg-intel-voice-research.md` — Matt Levine × Morning Brew × active-seller composite + ban list), and the four fabricated paragraphs the Session 47.4 fact-check removed (the negative fixtures below).

> This is not a style preference. It's the trust mechanism. Foil's whole defensibility is "a Level-4 TCGplayer seller already did the scrubbing for you." The moment the writing fabricates a number, hypes, or hedges, that credential is worthless. Voice IS the product on the buyer-side surfaces.

---

## 1. Voice DNA

**Matt Levine × Morning Brew, applied to Pokémon TCG, anchored by a working seller's POV.**

- **Matt Levine** — dry, deadpan, never hypes, always teaches. Single-sentence punches followed by longer mechanical breakdowns. The voice itself is the proof of expertise; you can tell who wrote it without them saying "I."
- **Morning Brew** — formatting discipline. Bold to signal topic shifts (navigation, never decoration). White space. No walls of text. Scannable in two minutes.
- **The active seller** — the one thing no competitor has. John runs a TCGplayer storefront; real-time skin in the game. Phrases that work: *"I'm not playing it," "Watch what's moving, not what's marked down," "The market is telling you."* Phrases that don't: *"Some investors might consider," "It could be argued that."*

The personality from PRODUCT.md, in three words: **confident, knowledgeable, calm.** A sharp dealer who already did the scrubbing — never a hype machine. The feeling to evoke is the relief of *"someone reliable already checked this,"* not urgency or FOMO.

## 2. Who we're writing to

An active Pokémon TCG collector who already knows the card they want, often on a phone mid-scroll. Treat them as **smart and already in the niche.** No throat-clearing. Do not define ETB, SAR, PSA grade, sealed EV, pop diff, or reverse holo in the body — if a concept genuinely needs explaining, link a glossary. The cost of admission to the writing is that the reader is a hobbyist, not a tourist.

## 3. The canonical examples (John's real phrasing — match this register)

These three are the same idea scaled by context. They are the tuning fork for everything generated.

- **Bio (compressed):** "Tell me a card → I email you when it drops."
- **Homepage hero (medium):** "Tell us the Pokémon TCG card you want. We watch eBay, filter the keyword-stuffed junk, and email you the moment a real listing drops to your target price."
- **First-post hook (punchier):** "I built a Pokémon TCG site that does what eBay's search can't: surface real deals, not the $1.75 NEAR MINT keyword-stuffed junk."

Note what they avoid: no "find the best deals before someone else does" (implies urgency/competition that doesn't match the job-to-be-done, which is *cognitive offload*, not racing). The job is attention, not "deals."

## 4. The rules (every generation obeys these)

1. **Numbers are always exact, never vague.** "$192 to $176," not "around $180." "Surging Sparks cooled 8% this week," not "experienced a notable price contraction." Vagueness kills credibility instantly. No `around $X`, `roughly N%`, `~N`, `(approximate)` as a hedge on a price or a stat. If you genuinely don't have the exact figure, say so qualitatively or omit it — do not dress a guess as data.
2. **Every claim is grounded; never fabricate.** This is PRODUCT.md principle #1 (Earned trust over persuasion) and R-001. A proprietary statistic ("Foil's data shows X%") must trace to a real value the pipeline returns — if there's no real number behind it, the sentence does not get a number. A factual claim about a card (set, number, price, pop) must be true. **Fabrication is the single worst failure; it's worse than a bland sentence.**
3. **Personality is felt, not performed.** Don't write "I think" / "in my opinion" / "as a collector." Let the specificity carry the authority. One genuine operator aside per piece ("I'm not stocking these at that price") is worth more than ten "I"s.
4. **Dry humor permitted; hype banned.** Treat an absurdity (a Mew ex SAR jumping $200 on a tweet) with deadpan acknowledgment. Never "to the moon," "game-changer," "explosive growth."
5. **Sentence rhythm: mix short punches with longer analytical breakdowns.** A one-line claim, then the mechanical why. Monotone paragraph blocks are an AI tell.
6. **Bold for navigation, not decoration.** Signal a topic shift; never bold for emphasis-spam.
7. **No em dashes** (matches the global house style + the Cowork ban list). Use commas, colons, semicolons, periods, parentheses.
8. **"Pokémon" with the é** everywhere except code identifiers, set codes, and URLs.

## 5. Ban list (auto-failed by the voice check + quality gates)

Hype words, AI tells, and press-release filler. The live enforcer is `BANNED_PHRASES` in `lib/seo/quality-gates.ts`; the voice-specific additions land there too so gate (e) catches them on every blog + newsletter generation.

**Voice-specific bans (added Goal V):** `let's dive in`, `dive in`, `game-changer` / `game changer`, `to the moon`, `navigate the landscape`, `delve`, `tapestry`, `unpack` (in the figurative "let's unpack" sense), `in today's market`.

**Pre-existing bans (kept):** `in conclusion`, `in summary`, `as we've seen`, `in today's digital world`, `the world of pokemon`, `as a collector`.

Also avoid (judgment, not hard-banned): hedge-fund jargon, fake urgency, "the world of," "in today's [anything]," any sentence that reads like a press release.

## 6. Negative fixtures — the four real fabrications (Session 47.4)

These shipped live and passed the structural gates (word count, dollar figures, links) because **structural gates count tokens, not truth or tone** ([PATTERNS I-004](PATTERNS.md)). They are the anchor for `lib/__tests__/seo-voice-check.test.ts` (R-010: tests pin real observed failures, not invented ones). Each is annotated with the voice rule it breaks and the catchable signature.

1. **Fabricated proprietary stat (rule 2).**
   > "Foil's scan data shows that across 25 cards processed in the last 30 days, the spread between a card's TCGplayer market price and its 30-day eBay sold median averaged roughly **18%** …"
   No such number exists in the pipeline. **Signature:** a `Foil's scan data` proprietary citation co-occurring with a quantified claim → voice-check detector A.

2. **Vague hedged price (rule 1).**
   > "A raw NM copy of Umbreon VMAX (Alternate Art, EVS 215) might sit **around $120–$140** in 2026 **(approximate)**." (Real 30-day sold: ~$2,100 raw — off by 15-20×.)
   **Signature:** `around $…` + `(approximate)` hedge on a price → voice-check detector B.

3. **Fabricated behavioral stat + vague multiplier (rules 1 & 2).**
   > "Foil's scan data … shows users submitting English SIRs for grading at **roughly 2× the rate** of JP SARs …"
   **Signature:** `Foil's scan data` + `roughly` + `2×` → detectors A and B.

4. **Factual error inside a hedged-number paragraph (rule 2).**
   > "The texture on a JP **Gardevoir ex SAR from Pokémon Card 151** … (~270 gsm vs the English ~300 gsm **estimate**) …" (Gardevoir is not a Kanto #1–151 card; the corrected card is Venusaur ex #198.)
   **Honest limit:** a text voice-check *cannot* know Gardevoir isn't in 151 — that's a factual error only world-knowledge or [quality-gate 9/10](DECISIONS.md#adr-046--tiered-per-card-rendering--catalog-expansion-to-1000-cards) + human review catch. The check fails this paragraph on the co-located `~270 gsm` / `~300 gsm estimate` vague-figure signature (detector B), not on the fact. The voice check is a tone/trust-signature net, not a fact-checker.

**What this means in practice.** The voice check catches the *writing patterns that fabrication-prone copy exhibits* — unsourced proprietary stats and vague/hedged numbers — plus hype/AI ban phrases. It is one layer. Factual truth is enforced by gates 9 (link existence) + 10 (Foil-data provenance) and, ultimately, by the operator's review of the "from my store" judgment. No single automated layer makes the writing trustworthy; together they make fabrication hard to ship.
