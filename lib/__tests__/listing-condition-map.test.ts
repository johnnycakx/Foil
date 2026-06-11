// Watchlist condition-token → ResolveCondition mapping (lib/listing/condition-map.ts).
// Goal #3 (wishlist cron migration): every stored token maps to a resolver
// condition; unknown tokens map to null (skip, never a wrong-basis alert);
// bgs-10-bl carries the Black-Label title narrowing.

import test from "node:test";
import assert from "node:assert/strict";
import { CONDITION_TOKENS } from "../cards/conditions.ts";
import {
  resolveConditionForToken,
  tokenRequiresBlackLabel,
  verifiedListingMatchesToken,
} from "../listing/condition-map.ts";

test("every token in the closed conditions.ts set maps to a resolver condition", () => {
  for (const token of CONDITION_TOKENS) {
    assert.notEqual(resolveConditionForToken(token), null, `unmapped token: ${token}`);
  }
});

test("raw tiers + aggregates map to the resolver's string conditions", () => {
  assert.equal(resolveConditionForToken("any-raw"), "ANY_RAW");
  assert.equal(resolveConditionForToken("nm"), "NM");
  assert.equal(resolveConditionForToken("dmg"), "DMG");
  assert.equal(resolveConditionForToken("any-graded"), "ANY_GRADED");
  // Empty/missing → the any-raw default (mirrors DEFAULT_CONDITION).
  assert.equal(resolveConditionForToken(""), "ANY_RAW");
  assert.equal(resolveConditionForToken(null), "ANY_RAW");
});

test("graded tokens map to service + grade (PSA_10-style specificity)", () => {
  assert.deepEqual(resolveConditionForToken("psa-10"), { graded: { service: "PSA", grade: "10" } });
  assert.deepEqual(resolveConditionForToken("bgs-9-5"), { graded: { service: "BGS", grade: "9.5" } });
  assert.deepEqual(resolveConditionForToken("cgc-9"), { graded: { service: "CGC", grade: "9" } });
  assert.deepEqual(resolveConditionForToken("bgs-10-bl"), { graded: { service: "BGS", grade: "10" } });
});

test("unknown tokens map to null (the cron skips, never alerts on a guess)", () => {
  assert.equal(resolveConditionForToken("mint-fresh"), null);
  assert.equal(resolveConditionForToken("psa-11"), null);
});

test("bgs-10-bl narrows by Black Label title; all other tokens pass through", () => {
  assert.equal(tokenRequiresBlackLabel("bgs-10-bl"), true);
  assert.equal(tokenRequiresBlackLabel("psa-10"), false);
  assert.equal(verifiedListingMatchesToken("bgs-10-bl", "Charizard BGS 10 BLACK LABEL"), true);
  assert.equal(verifiedListingMatchesToken("bgs-10-bl", "Charizard BGS 10 Black-Label"), true);
  assert.equal(verifiedListingMatchesToken("bgs-10-bl", "Charizard BGS 10 PRISTINE"), false);
  assert.equal(verifiedListingMatchesToken("psa-10", "Charizard PSA 10"), true);
});
