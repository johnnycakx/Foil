// Tests for the eBay item-specifics aspect reader (ADR-057). Shapes are the
// REAL localizedAspects returned by Browse getItem (probe 2026-06-05), including
// the goal-cited Japanese Alakazam (item 358584162488) whose TITLE has no
// language word but whose Language specific says "Japanese".

import test from "node:test";
import assert from "node:assert/strict";
import { aspectsFromLocalized, marketFromAspects, conditionFromAspects } from "../buy-signal/aspects.ts";
import { inferListingCondition } from "../buy-signal/condition-infer.ts";

// Real getItem localizedAspects (trimmed) — Japanese Alakazam ex SV2a 151.
const JP_ALAKAZAM = aspectsFromLocalized([
  { type: "STRING", name: "Game", value: "Pokemon TCG" },
  { type: "STRING", name: "Card Condition", value: "Near Mint or Better" },
  { type: "STRING", name: "Card Name", value: "Alakazam ex" },
  { type: "STRING", name: "Set", value: "SV2a: Pokemon Card 151" },
  { type: "STRING", name: "Finish", value: "Holofoil" },
  { type: "STRING", name: "Language", value: "Japanese" },
  { type: "STRING", name: "Country of Origin", value: "Japan" },
  { type: "STRING", name: "Country/Region of Manufacture", value: "Japan" },
]);

// Real getItem localizedAspects (trimmed) — English Base Set Charizard.
const EN_CHARIZARD = aspectsFromLocalized([
  { type: "STRING", name: "Set", value: "Base Set" },
  { type: "STRING", name: "Graded", value: "No" },
  { type: "STRING", name: "Language", value: "English" },
  { type: "STRING", name: "Card Name", value: "Charizard" },
  { type: "STRING", name: "Finish", value: "Holo" },
]);

test("aspectsFromLocalized: flattens name→value, lowercases names, drops blanks", () => {
  const a = aspectsFromLocalized([
    { name: "Language", value: "English" },
    { name: "Card Condition", value: " Near Mint or Better " },
    { name: "Blank", value: "" },
    { name: 5 as unknown as string, value: "x" },
  ]);
  assert.equal(a["language"], "English");
  assert.equal(a["card condition"], "Near Mint or Better");
  assert.ok(!("blank" in a));
});

test("marketFromAspects: Japanese listing is NOT English (the cross-market false-positive)", () => {
  const m = marketFromAspects(JP_ALAKAZAM);
  assert.equal(m.isEnglish, false);
  assert.equal(m.language, "Japanese");
  assert.equal(m.region, "Japan");
});

test("marketFromAspects: English listing qualifies", () => {
  const m = marketFromAspects(EN_CHARIZARD);
  assert.equal(m.isEnglish, true);
  assert.equal(m.language, "English");
});

test("marketFromAspects: missing Language → not English (conservative exclude)", () => {
  const m = marketFromAspects(aspectsFromLocalized([{ name: "Set", value: "Base Set" }]));
  assert.equal(m.isEnglish, false);
  assert.match(m.reason, /no Language/);
});

test("conditionFromAspects: maps the eBay raw Card Condition enum", () => {
  const cc = (v: string) => conditionFromAspects(aspectsFromLocalized([{ name: "Card Condition", value: v }])).tier;
  assert.equal(cc("Near Mint or Better"), "NM");
  assert.equal(cc("Lightly Played (Excellent)"), "LP");
  assert.equal(cc("Moderately Played (Very Good)"), "MP");
  assert.equal(cc("Heavily Played (Poor)"), "HP");
  assert.equal(cc("Damaged"), "DMG");
});

test("conditionFromAspects: graded slab → grade-specific key (PSA 10)", () => {
  const c = conditionFromAspects(aspectsFromLocalized([
    { name: "Graded", value: "Yes" },
    { name: "Professional Grader", value: "Professional Sports Authenticator (PSA)" },
    { name: "Grade", value: "10" },
  ]));
  assert.equal(c.tier, "GRADED");
  assert.equal(c.gradeKey, "PSA_10");
});

test("conditionFromAspects: graded without parseable service/grade → GRADED, no gradeKey (→ UNKNOWN downstream)", () => {
  const c = conditionFromAspects(aspectsFromLocalized([{ name: "Graded", value: "Yes" }]));
  assert.equal(c.tier, "GRADED");
  assert.equal(c.gradeKey, undefined);
});

// --- inferListingCondition with aspects (the integration) ---

test("inferListingCondition: Japanese Alakazam → UNKNOWN via the market gate, despite an NM title", () => {
  // The TITLE looks like a clean English NM card; only the Language aspect saves us.
  const r = inferListingCondition({ title: "Alakazam ex Holo Special Art Rare SV2a: Pokemon Card 151 203/165 NM", aspects: JP_ALAKAZAM });
  assert.equal(r.tier, "UNKNOWN");
  assert.match(r.evidence.join(" "), /market gate.*Japanese/i);
});

test("inferListingCondition: English NM aspect → NM (high confidence, aspect-preferred)", () => {
  const r = inferListingCondition({ title: "whatever", aspects: aspectsFromLocalized([
    { name: "Language", value: "English" },
    { name: "Card Condition", value: "Near Mint or Better" },
  ]) });
  assert.equal(r.tier, "NM");
  assert.equal(r.confidence, "high");
});

test("inferListingCondition: English graded PSA 10 aspect → GRADED + PSA_10", () => {
  const r = inferListingCondition({ title: "x", aspects: aspectsFromLocalized([
    { name: "Language", value: "English" },
    { name: "Graded", value: "Yes" },
    { name: "Professional Grader", value: "PSA" },
    { name: "Grade", value: "10" },
  ]) });
  assert.equal(r.tier, "GRADED");
  assert.equal(r.gradeKey, "PSA_10");
});

test("inferListingCondition: English but no Card Condition aspect → falls back to title condition (market gated)", () => {
  // The real English Charizard had no Card Condition aspect; title carries it.
  const r = inferListingCondition({ title: "Charizard Base Set Near Mint", aspects: EN_CHARIZARD });
  assert.equal(r.tier, "NM");
});

test("inferListingCondition: aspects=null (getItem failed) → UNKNOWN (no false deal)", () => {
  const r = inferListingCondition({ title: "Charizard Base Set NM", aspects: null });
  assert.equal(r.tier, "UNKNOWN");
});

test("inferListingCondition: aspects=undefined → title-only path (back-compat)", () => {
  const r = inferListingCondition({ title: "Charizard Base Set Near Mint" });
  assert.equal(r.tier, "NM");
});

test("inferListingCondition: multi-card lot excluded even with English aspects", () => {
  const r = inferListingCondition({ title: "Pokemon lot of 4 Charizard NM", aspects: aspectsFromLocalized([
    { name: "Language", value: "English" }, { name: "Card Condition", value: "Near Mint or Better" },
  ]) });
  assert.equal(r.tier, "UNKNOWN");
  assert.match(r.evidence.join(" "), /lot/i);
});
