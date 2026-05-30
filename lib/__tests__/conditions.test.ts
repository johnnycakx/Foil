// Condition-token map exhaustiveness + validator (Session 49b / ADR-043).
//
// The token set is load-bearing in three places (DB column, picker UI, eBay
// keyword gate). These tests pin that every token has a label + a keyword map
// entry (no silent gaps), that the validator accepts exactly the token set,
// and spot-check the gnarly substring-collision cases (BGS 9 vs BGS 9.5,
// CGC 9 vs CGC 9.5) the keyword maps are designed around.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CONDITION_TOKENS,
  RAW_CONDITION_TOKENS,
  GRADED_CONDITION_TOKENS,
  CONDITION_LABELS,
  CONDITION_EBAY_KEYWORDS,
  DEFAULT_CONDITION,
  isValidConditionToken,
  conditionLabel,
  ebayKeywordsForCondition,
  conditionRelaxesJunkGate,
} from "../cards/conditions.ts";

test("token set: 17 tokens, raw + graded partition with no overlap", () => {
  assert.equal(CONDITION_TOKENS.length, 17);
  assert.equal(RAW_CONDITION_TOKENS.length, 6);
  assert.equal(GRADED_CONDITION_TOKENS.length, 11);
  const union = new Set([...RAW_CONDITION_TOKENS, ...GRADED_CONDITION_TOKENS]);
  assert.equal(union.size, 17, "no token appears in both groups");
  assert.equal(DEFAULT_CONDITION, "any-raw");
});

test("every token has a label AND a keyword map entry (exhaustiveness)", () => {
  for (const tok of CONDITION_TOKENS) {
    assert.ok(CONDITION_LABELS[tok], `label missing for ${tok}`);
    const kw = CONDITION_EBAY_KEYWORDS[tok];
    assert.ok(kw, `keyword map missing for ${tok}`);
    assert.ok(Array.isArray(kw.include) && Array.isArray(kw.exclude), `keyword shape for ${tok}`);
  }
  // No stray keys beyond the token set.
  assert.equal(Object.keys(CONDITION_LABELS).length, CONDITION_TOKENS.length);
  assert.equal(Object.keys(CONDITION_EBAY_KEYWORDS).length, CONDITION_TOKENS.length);
});

test("isValidConditionToken accepts the whole set and rejects junk", () => {
  for (const tok of CONDITION_TOKENS) assert.ok(isValidConditionToken(tok));
  for (const bad of ["", "PSA10", "psa_10", "near-mint", "default", null, undefined, 10]) {
    assert.equal(isValidConditionToken(bad as unknown), false, `rejects ${String(bad)}`);
  }
});

test("raw conditions exclude graded slabs; graded include their authority", () => {
  for (const tok of RAW_CONDITION_TOKENS) {
    const kw = CONDITION_EBAY_KEYWORDS[tok];
    assert.ok(kw.exclude.includes("PSA"), `${tok} must exclude PSA`);
    assert.ok(kw.exclude.includes("BGS") && kw.exclude.includes("CGC"));
  }
  assert.deepEqual([...CONDITION_EBAY_KEYWORDS["psa-10"].include], ["PSA 10"]);
  assert.ok(CONDITION_EBAY_KEYWORDS["bgs-10-bl"].include.includes("Black Label"));
});

test("substring-collision guards: BGS 9 excludes 9.5/10; CGC 9 excludes 9.5/10", () => {
  // "BGS 9.5" contains the substring "BGS 9", so bgs-9 must exclude the .5 form.
  assert.ok(CONDITION_EBAY_KEYWORDS["bgs-9"].exclude.includes("BGS 9.5"));
  assert.ok(CONDITION_EBAY_KEYWORDS["bgs-9"].exclude.includes("BGS 10"));
  // bgs-9-5 must NOT exclude "BGS 9" (that's a substring of its own include).
  assert.ok(!CONDITION_EBAY_KEYWORDS["bgs-9-5"].exclude.includes("BGS 9"));
  assert.ok(CONDITION_EBAY_KEYWORDS["cgc-9"].exclude.includes("CGC 9.5"));
  assert.ok(CONDITION_EBAY_KEYWORDS["cgc-9"].exclude.includes("CGC 10"));
  assert.ok(!CONDITION_EBAY_KEYWORDS["cgc-9-5"].exclude.includes("CGC 9"));
});

test("helpers: conditionLabel, ebayKeywordsForCondition, conditionRelaxesJunkGate", () => {
  assert.equal(conditionLabel("psa-10"), "PSA 10");
  assert.equal(conditionLabel("nonsense"), "nonsense");
  // Unknown / empty token → empty keyword sets (no-op gate).
  assert.deepEqual(ebayKeywordsForCondition(undefined), { include: [], exclude: [] });
  assert.deepEqual(ebayKeywordsForCondition("bogus"), { include: [], exclude: [] });
  assert.equal(ebayKeywordsForCondition("nm").include[0], "Near Mint");
  // Played/damaged tiers relax the picker's condition-junk gate; pristine ones don't.
  assert.equal(conditionRelaxesJunkGate("dmg"), true);
  assert.equal(conditionRelaxesJunkGate("hp"), true);
  assert.equal(conditionRelaxesJunkGate("mp"), true);
  assert.equal(conditionRelaxesJunkGate("nm"), false);
  assert.equal(conditionRelaxesJunkGate("psa-10"), false);
  assert.equal(conditionRelaxesJunkGate(undefined), false);
});
