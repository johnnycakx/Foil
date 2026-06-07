// Unit tests for the verified-listing resolver's identity-aspect normalizers
// (lib/listing/normalize.ts). Values are from the build-step-0 probe
// (docs/probe-findings-listing-aspects-2026-06-06.md) — real eBay strings.

import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSetName,
  setMatches,
  parseCollectorNumber,
  numberMatches,
  normalizeFinish,
  finishForVariantKey,
} from "../listing/normalize.ts";

// --- Set ---------------------------------------------------------------------

test("normalizeSetName strips year + set-code prefixes and punctuation", () => {
  assert.equal(normalizeSetName("2000 Neo Genesis"), "neo genesis");
  assert.equal(normalizeSetName("SV01: Scarlet & Violet Base Set"), "scarlet and violet base set");
  assert.equal(normalizeSetName("Sword & Shield - Lost Origin"), "sword and shield lost origin");
});

test("setMatches: year-prefixed eBay set matches the SDK set (Neo Genesis)", () => {
  assert.equal(setMatches("Neo Genesis", "2000 Neo Genesis").match, true);
});

test("setMatches: SDK 'Base' matches eBay 'Base Set' but NOT 'Base Set 2'", () => {
  assert.equal(setMatches("Base", "Base Set").match, true);
  // The version token "2" must block the subset match (different set).
  assert.equal(setMatches("Base", "Base Set 2").match, false);
});

test("setMatches: SV set-code prefix + '&'→'and' bridges to the SDK name", () => {
  assert.equal(setMatches("Scarlet & Violet", "SV01: Scarlet & Violet Base Set").match, true);
});

test("setMatches: genuinely different sets do not match", () => {
  assert.equal(setMatches("Jungle", "Base Set").match, false);
  assert.equal(setMatches("Neo Genesis", "Neo Destiny").match, false);
});

test("setMatches: Base Set variant names match; Base Set 2 (arabic OR roman) rejects (calibration 2026-06)", () => {
  // Was a false-reject before the alias removal — these ARE Base Set (base1).
  assert.equal(setMatches("Base", "Base Unlimited Shadow").match, true);
  assert.equal(setMatches("Base", "Base Set Shadowless").match, true);
  // Base Set 2 must still reject, however eBay spells it.
  assert.equal(setMatches("Base", "Base Set 2").match, false);
  assert.equal(setMatches("Base", "Pokemon Game Base II").match, false);
});

// --- Collector number --------------------------------------------------------

test("parseCollectorNumber handles every observed format", () => {
  assert.deepEqual(parseCollectorNumber("No. 157"), { token: "157", numeric: 157 });
  assert.deepEqual(parseCollectorNumber("18/111"), { token: "18", numeric: 18 });
  assert.deepEqual(parseCollectorNumber("004/102"), { token: "004", numeric: 4 });
  assert.deepEqual(parseCollectorNumber("DP46"), { token: "DP46", numeric: null });
  assert.deepEqual(parseCollectorNumber("4"), { token: "4", numeric: 4 });
  // Secret rare left>right — passed verbatim, never "corrected".
  assert.deepEqual(parseCollectorNumber("136/135"), { token: "136", numeric: 136 });
});

test("numberMatches: 17 vs 18 is a MISMATCH (the wrong-print bug)", () => {
  assert.equal(numberMatches("17", "18/111").match, false);
});

test("numberMatches: zero-pad tolerance + No. prefix + promo token", () => {
  assert.equal(numberMatches("4", "004/102").match, true);
  assert.equal(numberMatches("157", "No. 157").match, true);
  assert.equal(numberMatches("DP46", "DP46").match, true);
  assert.equal(numberMatches("136", "136/135").match, true); // secret rare verbatim
  assert.equal(numberMatches("46", "DP46").match, false); // numeric vs promo token
});

// --- Finish ------------------------------------------------------------------

test("normalizeFinish maps observed values; edition words → null", () => {
  assert.equal(normalizeFinish("Holo"), "holo");
  assert.equal(normalizeFinish("Holofoil"), "holo");
  assert.equal(normalizeFinish("Unlimited Holofoil"), "holo");
  assert.equal(normalizeFinish("Reverse Holo"), "reverse-holo");
  assert.equal(normalizeFinish("Regular"), "normal");
  assert.equal(normalizeFinish("Unlimited"), null); // an edition, not a finish
  assert.equal(normalizeFinish(""), null);
});

test("finishForVariantKey maps PokeTrace variant keys", () => {
  assert.equal(finishForVariantKey("holofoil"), "holo");
  assert.equal(finishForVariantKey("reverse-holofoil"), "reverse-holo");
  assert.equal(finishForVariantKey("non-holo"), "normal");
  assert.equal(finishForVariantKey(undefined), null);
});
