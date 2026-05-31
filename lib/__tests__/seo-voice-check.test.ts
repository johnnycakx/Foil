// Brand-voice check tests (Goal V / ADR-048).
//
// R-010 discipline: the negative fixtures are the FOUR REAL fabricated claims
// the Session 47.4 fact-check removed (from the pre-fix commit d09638b^). Each
// preserves the fabricated sentence as it shipped; surrounding prose is trimmed
// and em dashes are normalized to house style. Each `_observed` note cites
// where it shipped. The voice check must fail all four; a clean in-voice
// baseline must pass.
//
// See docs/BRAND-VOICE.md §6 for the annotated breakdown of each fixture.

import test from "node:test";
import assert from "node:assert/strict";
import { voiceCheck } from "../seo/voice-check.ts";

// --- The four real fabrications (verbatim) -----------------------------------

// _observed: how-much-is-my-pokemon-card-worth-a-60-second-checklist (live,
// fixed d09638b). Fabricated proprietary stat — no "18% spread" exists.
const FAB_1_FOIL_STAT =
  "Foil automates this three-source pull from a single photo. Foil's scan data shows that across 25 cards processed in the last 30 days, the spread between a card's TCGplayer market price and its 30-day eBay sold median averaged roughly 18% meaning collectors relying on a single source were off by nearly a fifth of the card's actual market value.";

// _observed: same post. Vague hedged price — real 30-day sold was ~$2,100 raw
// (off by 15-20x), and the figure is dressed as "around ... (approximate)".
const FAB_2_VAGUE_PRICE =
  "A raw NM copy of Umbreon VMAX (Alternate Art, EVS 215) might sit around $120-$140 in 2026 (approximate). A PSA 9 of the same card trades around $180-$220.";

// _observed: japanese-sar-vs-english-sir (live, fixed d09638b). Fabricated
// behavioral stat + vague multiplier — no "2x the rate" data exists.
const FAB_3_VAGUE_MULTIPLIER =
  "Foil's scan data shows users submitting English SIRs for grading at roughly 2x the rate of JP SARs of equivalent cards. Higher submission volume means faster-growing PSA pop counts.";

// _observed: same post. The Gardevoir-151 factual error (Gardevoir isn't a
// Kanto #1-151 card) is NOT text-detectable; the paragraph is caught on the
// co-located "~270 gsm / ~300 gsm estimate" vague-figure signature instead.
const FAB_4_HEDGED_FIGURES =
  "Japanese SARs are printed on slightly thinner card stock (~270 gsm vs the English ~300 gsm estimate) but receive a more aggressive foil embossing pass. The texture on a JP Gardevoir ex SAR from Pokemon Card 151 catches raking light at a sharper angle.";

const ALL_FABRICATIONS = [
  ["fabricated Foil stat (~18% spread)", FAB_1_FOIL_STAT],
  ["vague hedged price (around $120-140, approximate)", FAB_2_VAGUE_PRICE],
  ["fabricated multiplier (roughly 2x the rate)", FAB_3_VAGUE_MULTIPLIER],
  ["hedged technical figures (~270/~300 gsm)", FAB_4_HEDGED_FIGURES],
] as const;

// --- A clean in-voice baseline (must pass) -----------------------------------
// Exact numbers, sourced to completed sales, no hedges, no proprietary-stat
// rhetoric, no ban phrases, no em dashes. The register from BRAND-VOICE.md §3.
const BASELINE_GOOD =
  "Umbreon VMAX Alternate Art (EVS 215) is the clearest example. Raw Near Mint copies sold for a 30-day median of $2,100 across 363 eBay sales. PSA 9 sat at $2,300; PSA 10 cleared $4,400. The gap between a TCGplayer market figure and the real eBay sold median is where collectors lose money, so price against completed sales, not asking prices. I'm not stocking raw copies at current levels; the spread is too thin after fees.";

// -----------------------------------------------------------------------------

for (const [name, text] of ALL_FABRICATIONS) {
  test(`voiceCheck FAILS the real fabrication: ${name}`, () => {
    const result = voiceCheck(text);
    assert.equal(result.passed, false, `expected a voice violation in: ${name}`);
    assert.ok(result.violations.length > 0, "must surface at least one violation");
  });
}

test("voiceCheck catches ALL FOUR fabrications (the guardrail)", () => {
  const failed = ALL_FABRICATIONS.filter(([, t]) => !voiceCheck(t).passed);
  assert.equal(failed.length, 4, "the voice check must catch all 4 fabricated examples");
});

test("voiceCheck PASSES a clean in-voice baseline post", () => {
  const result = voiceCheck(BASELINE_GOOD);
  assert.equal(result.passed, true, `unexpected violations: ${JSON.stringify(result.violations)}`);
  assert.deepEqual(result.violations, []);
});

test("detector A: unsourced proprietary stat is flagged by kind", () => {
  const v = voiceCheck(FAB_1_FOIL_STAT).violations;
  assert.ok(v.some((x) => x.kind === "unsourced_proprietary_stat"), "expected unsourced_proprietary_stat");
});

test("detector B: vague/hedged numbers are flagged by kind", () => {
  const v = voiceCheck(FAB_2_VAGUE_PRICE).violations;
  assert.ok(v.some((x) => x.kind === "vague_number"), "expected vague_number");
});

test("detector C: ban phrases are flagged (hype + AI tells)", () => {
  const v = voiceCheck("This set is a game-changer. Let's dive in and delve into the tapestry.").violations;
  const phrases = v.filter((x) => x.kind === "banned_phrase").map((x) => x.detail);
  assert.ok(phrases.some((p) => p.includes("game-changer")));
  assert.ok(phrases.some((p) => p.includes("dive in")));
  assert.ok(phrases.some((p) => p.includes("delve")));
  assert.ok(phrases.some((p) => p.includes("tapestry")));
});

test("voiceCheck returns every violation, not just the first (exhaustive)", () => {
  // Fixture 1 trips both detector A (Foil stat) and detector B (roughly 18%).
  const v = voiceCheck(FAB_1_FOIL_STAT).violations;
  const kinds = new Set(v.map((x) => x.kind));
  assert.ok(kinds.has("unsourced_proprietary_stat") && kinds.has("vague_number"), "expected both A and B");
});
