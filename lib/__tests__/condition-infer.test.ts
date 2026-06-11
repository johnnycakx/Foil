// Listing-condition inference (ROADMAP #32.1 / ADR-053 / PATTERN I-009).
// Table-driven against real-world eBay title shapes, including the actual
// production Charizard Base title that triggered the I-009 disable.

import test from "node:test";
import assert from "node:assert/strict";
import { inferListingCondition, type ListingConditionTier, type InferenceConfidence } from "../buy-signal/condition-infer.ts";

type Row = { title: string; tier: ListingConditionTier; confidence?: InferenceConfidence; note: string };

const CASES: Row[] = [
  // The real production listing that caused the false BELOW — no condition word.
  { title: "Pokémon TCG Charizard 4/102 Base Set Unlimited Holo Rare - Nintendo 1999 Card！！！", tier: "UNKNOWN", confidence: "low", note: "vintage holo, no condition keyword" },
  // Explicit raw, high confidence.
  { title: "Charizard Base Set 4/102 Holo Near Mint", tier: "NM", confidence: "high", note: "explicit near mint" },
  { title: "Blastoise Base Set NM-MT WOTC", tier: "NM", confidence: "high", note: "NM-MT phrase" },
  { title: "Venusaur Base Set Lightly Played Holo", tier: "LP", confidence: "high", note: "explicit lightly played" },
  { title: "Charizard Base Set Moderately Played 4/102", tier: "MP", confidence: "high", note: "explicit moderately played" },
  { title: "Charizard Base Set Heavily Played reverse", tier: "HP", confidence: "high", note: "explicit heavily played" },
  { title: "Charizard Base Set DAMAGED creased holo", tier: "DMG", confidence: "high", note: "explicit damaged" },
  // Abbreviations, medium confidence.
  { title: "Pikachu Jungle 60/64 NM", tier: "NM", confidence: "medium", note: "abbreviation NM" },
  { title: "Gyarados Base Set LP 6/102", tier: "LP", confidence: "medium", note: "abbreviation LP" },
  { title: "Machamp Base Set HP 8/102", tier: "HP", confidence: "medium", note: "abbreviation HP" },
  // Graded, high confidence.
  { title: "Charizard Base Set PSA 10 GEM MINT 4/102 1999", tier: "GRADED", confidence: "high", note: "PSA 10" },
  { title: "Blastoise Base BGS 9.5 Gem Mint", tier: "GRADED", confidence: "high", note: "BGS 9.5" },
  { title: "Venusaur Base CGC 8.5 Holo", tier: "GRADED", confidence: "high", note: "CGC 8.5" },
  // Vague wear — no degree, conservative UNKNOWN.
  { title: "Charizard Base Set holo played condition", tier: "UNKNOWN", confidence: "low", note: "vague 'played' no degree" },
  { title: "Charizard Base Set used has wear", tier: "UNKNOWN", confidence: "low", note: "vague 'used/wear'" },
  // Lot / multi-card — not a single-card comparison.
  { title: "Pokemon Base Set Lot of 4 Holo Rares Charizard Blastoise", tier: "UNKNOWN", confidence: "low", note: "lot of 4" },
  { title: "Base Set Complete Set 102/102 WOTC", tier: "UNKNOWN", confidence: "low", note: "complete set" },
  { title: "Charizard Blastoise Venusaur x3 Holo Bundle", tier: "UNKNOWN", confidence: "low", note: "x3 bundle" },
  // Foreign market — wrong reference market.
  { title: "Japanese Charizard Base Set Holo Near Mint 1996", tier: "UNKNOWN", confidence: "low", note: "Japanese market beats the NM phrase" },
  { title: "Charizard Base Set German Glurak Holo", tier: "UNKNOWN", confidence: "low", note: "German market" },
  // Not-real comparables.
  { title: "Charizard Base Set Proxy Custom Holo", tier: "UNKNOWN", confidence: "low", note: "proxy/custom" },
  { title: "Charizard Base Set Reproduction Repro Card", tier: "UNKNOWN", confidence: "low", note: "reproduction" },
  // isGraded flag without a grade in the title.
];

for (const c of CASES) {
  test(`infer: ${c.note} -> ${c.tier}`, () => {
    const r = inferListingCondition({ title: c.title });
    assert.equal(r.tier, c.tier, `tier for "${c.title}" (evidence: ${r.evidence.join("; ")})`);
    if (c.confidence) assert.equal(r.confidence, c.confidence, `confidence for "${c.title}"`);
    assert.ok(r.evidence.length > 0, "every inference carries evidence");
  });
}

test("infer: isGraded flag forces GRADED but, with no parseable grade, medium + no gradeKey (#32.3 -> UNKNOWN downstream)", () => {
  const r = inferListingCondition({ title: "Charizard Base Set Holo Rare", isGraded: true });
  assert.equal(r.tier, "GRADED");
  assert.equal(r.confidence, "medium");
  assert.equal(r.gradeKey, undefined);
});

test("infer: empty / missing title -> UNKNOWN low", () => {
  assert.equal(inferListingCondition({ title: "" }).tier, "UNKNOWN");
  assert.equal(inferListingCondition({ title: undefined }).tier, "UNKNOWN");
  assert.equal(inferListingCondition({ title: null }).confidence, "low");
});

test("infer: market guard beats a graded grade (Japanese PSA 10 -> UNKNOWN, wrong market)", () => {
  const r = inferListingCondition({ title: "Japanese Charizard PSA 10 Base Set" });
  assert.equal(r.tier, "UNKNOWN");
  assert.match(r.evidence[0], /market/);
});

test("infer: the bare ITA abbreviation is a market marker (2026-06-11 paired-audit catch)", () => {
  // Real observed Italian listing with no language word beyond the ITA tag.
  const r = inferListingCondition({ title: "POKÉMON NEO DISCOVERY UNLIMITED HOUNDOOM HOLO 4/75 LP ITA" });
  assert.equal(r.tier, "UNKNOWN");
  assert.match(r.evidence[0], /market/);
  // And ITA must not false-positive on normal English titles.
  assert.notEqual(inferListingCondition({ title: "Houndoom 4/75 Neo Discovery Holo LP" }).evidence[0], "non-English market marker");
});

// --- #32.3: grade-token disambiguation + grade-specific gradeKey ---

test("infer: 'NM 7' is a bare grade with no service -> UNKNOWN, NOT Near Mint (the #32.3 bug)", () => {
  const r = inferListingCondition({ title: "Espeon 32/75 Neo Discovery Regular NM 7" });
  assert.equal(r.tier, "UNKNOWN");
  assert.match(r.evidence[0], /no grading service/);
});

test("infer: 'MT 8' bare grade -> UNKNOWN", () => {
  assert.equal(inferListingCondition({ title: "Charizard Base Set MT 8 holo" }).tier, "UNKNOWN");
});

test("infer: 'GEM MINT 10' (no service) -> UNKNOWN, not NM", () => {
  assert.equal(inferListingCondition({ title: "Blastoise Base Set GEM MINT 10 holo" }).tier, "UNKNOWN");
});

test("infer: 'NM-MT 8.5' (no service) -> UNKNOWN", () => {
  assert.equal(inferListingCondition({ title: "Umbreon Neo Discovery NM-MT 8.5" }).tier, "UNKNOWN");
});

test("infer: 'PSA 9' -> GRADED with gradeKey PSA_9 (grade-specific)", () => {
  const r = inferListingCondition({ title: "Charizard Base Set PSA 9 4/102" });
  assert.equal(r.tier, "GRADED");
  assert.equal(r.gradeKey, "PSA_9");
});

test("infer: 'BGS 9.5' -> gradeKey BGS_9_5", () => {
  assert.equal(inferListingCondition({ title: "Charizard Base BGS 9.5 Gem Mint" }).gradeKey, "BGS_9_5");
});

test("infer: 'CGC 8.5' -> gradeKey CGC_8_5; 'PSA 10' -> PSA_10", () => {
  assert.equal(inferListingCondition({ title: "Venusaur Base CGC 8.5 Holo" }).gradeKey, "CGC_8_5");
  assert.equal(inferListingCondition({ title: "Pikachu PSA 10 GEM MINT" }).gradeKey, "PSA_10");
});

test("infer: collector number is NOT a grade — 'LP 6/102' stays LP (lookahead guard)", () => {
  const r = inferListingCondition({ title: "Gyarados Base Set LP 6/102" });
  assert.equal(r.tier, "LP");
  assert.equal(r.gradeKey, undefined);
});

test("infer: a clean raw phrase with no digit is unaffected — 'Near Mint' -> NM", () => {
  assert.equal(inferListingCondition({ title: "Charizard Base Set Near Mint Holo" }).tier, "NM");
  assert.equal(inferListingCondition({ title: "Machamp 8/102 NM" }).tier, "NM");
});
