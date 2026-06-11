// Identity-gate tests for the verified-listing resolver (lib/listing/identity.ts).
// Uses the REAL probe-captured fixtures for the two headline regression cases
// and inline observed-shape aspects for the per-gate units (R-010).

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { aspectsFromLocalized, type ListingAspects } from "../buy-signal/aspects.ts";
import { verifyIdentity, detectGraded, type IdentityTarget, type ResolveCondition } from "../listing/identity.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "..", "__fixtures__", "ebay-listings");

function loadFixture(name: string): { aspects: ListingAspects; topCondition: string | null; title: string } {
  const raw = JSON.parse(readFileSync(join(FIX, name), "utf8"));
  return { aspects: aspectsFromLocalized(raw.localizedAspects), topCondition: raw.topCondition ?? null, title: raw.title };
}

function aspects(pairs: Array<[string, string]>): ListingAspects {
  return aspectsFromLocalized(pairs.map(([name, value]) => ({ name, value })));
}

const NEO17: IdentityTarget = { setName: "Neo Genesis", setId: "neo1", number: "17", name: "Typhlosion" };
const NEO18: IdentityTarget = { setName: "Neo Genesis", setId: "neo1", number: "18", name: "Typhlosion" };

function gate(v: ReturnType<typeof verifyIdentity>, name: string) {
  return v.gates.find((g) => g.gate === name)!;
}

// --- The production bug: JP Typhlosion 117223259644 -------------------------

test("JP Typhlosion (117223259644) is REJECTED for neo1-17 — Language + Number fire", () => {
  const f = loadFixture("jp-typhlosion-117223259644.json");
  const v = verifyIdentity({ target: NEO17, aspects: f.aspects, topCondition: f.topCondition, title: f.title, condition: "ANY_RAW" });
  assert.equal(v.pass, false);
  // Two independent HARD gates catch it (defense-in-depth):
  assert.equal(gate(v, "language").pass, false, "Language=Japanese must reject");
  assert.equal(gate(v, "number").pass, false, "No. 157 vs 17 must reject");
  // Set CORRECTLY matches — it IS Neo Genesis (the Japanese printing). Forcing
  // Set to reject would require treating the '2000 ' year-prefix as a different
  // set, which would false-reject legit English vintage. The market gate
  // (Language) + the print gate (Number) are the right rejects.
  assert.equal(gate(v, "set").pass, true, "'2000 Neo Genesis' IS Neo Genesis");
});

// --- DUAL fixture: 18/111 → wrong-print reject for neo1-17, identity-match for neo1-18

test("18/111 listing is REJECTED for neo1-17 on the Number gate (wrong print)", () => {
  const f = loadFixture("en-typhlosion-neo-genesis.json");
  const v = verifyIdentity({ target: NEO17, aspects: f.aspects, topCondition: f.topCondition, title: f.title, condition: "ANY_RAW" });
  assert.equal(v.pass, false);
  assert.equal(gate(v, "number").pass, false, "18 vs 17 must reject — different cards");
});

test("18/111 listing IDENTITY-matches neo1-18 (language+set+number all pass)", () => {
  const f = loadFixture("en-typhlosion-neo-genesis.json");
  const v = verifyIdentity({ target: NEO18, aspects: f.aspects, topCondition: f.topCondition, title: f.title, condition: "ANY_RAW" });
  // The identity gates confirm it IS neo1-18:
  assert.equal(gate(v, "language").pass, true);
  assert.equal(gate(v, "set").pass, true);
  assert.equal(gate(v, "number").pass, true);
  // But this fixture is a PSA 6 slab, so ANY_RAW correctly rejects on condition.
  assert.equal(v.pass, false);
  assert.equal(gate(v, "graded_condition").pass, false, "graded slab can't satisfy a raw request");
});

// --- Clean full-pass (raw English NM neo1-18) -------------------------------

test("a clean raw English NM Typhlosion 18/111 fully PASSES for neo1-18", () => {
  const a = aspects([
    ["Set", "Neo Genesis"],
    ["Card Number", "18/111"],
    ["Language", "English"],
    ["Finish", "Holo"],
    ["Card Condition", "Near Mint or Better"],
  ]);
  const v = verifyIdentity({ target: NEO18, aspects: a, topCondition: "Ungraded", title: "Pokemon Typhlosion Neo Genesis Holo NM 18/111", condition: "ANY_RAW" });
  assert.equal(v.pass, true, v.reason);
  assert.equal(v.condition, "NM");
  assert.equal(v.verifiedAspects.graded, false);
});

// --- Per-gate units (observed shapes) ---------------------------------------

test("Set gate: a 'Base Set 2' listing rejects for a Base (base1) card", () => {
  const a = aspects([["Set", "Base Set 2"], ["Card Number", "4/130"], ["Language", "English"]]);
  const target: IdentityTarget = { setName: "Base", setId: "base1", number: "4", name: "Charizard" };
  const v = verifyIdentity({ target, aspects: a, topCondition: "Ungraded", title: "Charizard Base Set 2 4/130", condition: "ANY_RAW" });
  assert.equal(gate(v, "set").pass, false);
  assert.equal(v.pass, false);
});

test("Number gate: present-and-mismatched is a hard reject; absent is not fatal", () => {
  const mismatch = aspects([["Set", "Neo Genesis"], ["Card Number", "17/111"], ["Language", "English"], ["Card Condition", "Near Mint or Better"]]);
  assert.equal(verifyIdentity({ target: NEO18, aspects: mismatch, topCondition: "Ungraded", title: "Typhlosion 17/111", condition: "ANY_RAW" }).pass, false);
  // No Card Number aspect → corroboration unavailable, gate passes (not fatal).
  const absent = aspects([["Set", "Neo Genesis"], ["Language", "English"], ["Card Condition", "Near Mint or Better"]]);
  const v = verifyIdentity({ target: NEO18, aspects: absent, topCondition: "Ungraded", title: "Typhlosion Neo Genesis Holo NM", condition: "ANY_RAW" });
  assert.equal(gate(v, "number").pass, true);
  assert.equal(gate(v, "number").present, false);
  assert.equal(v.pass, true);
});

test("Graded detection works when 'Graded' aspect is blank (Grading Company/Grade only)", () => {
  const a = aspects([["Set", "Base Set"], ["Card Number", "4/102"], ["Grading Company", "PSA"], ["Grade", "9"]]);
  assert.equal(detectGraded(a, null), true);
  const target: IdentityTarget = { setName: "Base", setId: "base1", number: "4", name: "Charizard" };
  // Matches the requested PSA 9...
  const psa9: ResolveCondition = { graded: { service: "PSA", grade: "9" } };
  assert.equal(verifyIdentity({ target, aspects: a, topCondition: "Graded", title: "PSA 9 Charizard Base Set 4/102", condition: psa9 }).pass, true);
  // ...and a raw request correctly rejects the slab.
  assert.equal(verifyIdentity({ target, aspects: a, topCondition: "Graded", title: "PSA 9 Charizard Base Set 4/102", condition: "ANY_RAW" }).pass, false);
});

test("Graded grade-specificity: a PSA 9 slab does NOT satisfy a PSA 10 request", () => {
  const a = aspects([["Set", "Base Set"], ["Card Number", "4/102"], ["Grading Company", "PSA"], ["Grade", "9"]]);
  const target: IdentityTarget = { setName: "Base", setId: "base1", number: "4", name: "Charizard" };
  const psa10: ResolveCondition = { graded: { service: "PSA", grade: "10" } };
  assert.equal(verifyIdentity({ target, aspects: a, topCondition: "Graded", title: "PSA 9 Charizard", condition: psa10 }).pass, false);
});

// --- Graded detection: explicit-raw veto of a stray Grade aspect (calibration 2026-06) ---

test("detectGraded: explicit Graded=No vetoes a stray numeric Grade aspect (raw card)", () => {
  // neo2-9-poliwrath: a raw holo whose eBay 'Grade' aspect held the CARD NUMBER ('9').
  const a = aspects([["Set", "Neo Discovery"], ["Card Number", "9/75"], ["Language", "English"], ["Graded", "No"], ["Grade", "9"]]);
  assert.equal(detectGraded(a, "Ungraded"), false);
});

test("detectGraded: a condition-phrase Grade ('Heavily Played (Poor)') is not a slab", () => {
  const a = aspects([["Graded", "No"], ["Grade", "Heavily Played (Poor)"]]);
  assert.equal(detectGraded(a, "Ungraded"), false);
});

test("detectGraded: top-level 'Ungraded' vetoes a stray Grade even without a Graded aspect", () => {
  assert.equal(detectGraded(aspects([["Set", "Crown Zenith"], ["Grade", "10"]]), "Ungraded"), false);
});

test("detectGraded: STRONG signals are NEVER vetoed (a real slab stays graded)", () => {
  // Grading Company wins even if Graded says 'No' (mis-tagged real slab) — zero false-accept.
  assert.equal(detectGraded(aspects([["Grading Company", "PSA"], ["Grade", "9"], ["Graded", "No"]]), "Ungraded"), true);
  // top-level 'Graded' wins.
  assert.equal(detectGraded(aspects([["Grade", "8"]]), "Graded"), true);
  // blank Graded + numeric Grade (the probe's blank-Graded slab) still graded.
  assert.equal(detectGraded(aspects([["Grading Company", "BGS"], ["Grade", "9.5"]]), null), true);
  assert.equal(detectGraded(aspects([["Grade", "10"]]), null), true);
});

test("verifyIdentity: the raw Neo Discovery Poliwrath #9 (stray Grade=9) PASSES ANY_RAW", () => {
  const f = loadFixture("neo-discovery-poliwrath-raw-stray-grade.json");
  const target: IdentityTarget = { setName: "Neo Discovery", setId: "neo2", number: "9", name: "Poliwrath" };
  const v = verifyIdentity({ target, aspects: f.aspects, topCondition: f.topCondition, title: f.title, condition: "ANY_RAW" });
  assert.equal(v.pass, true, v.reason);
  assert.equal(gate(v, "graded_condition").pass, true, "explicit Graded=No → raw, not a slab");
  assert.equal(v.verifiedAspects.graded, false);
});

test("Language fallback: the bare ITA abbreviation rejects (2026-06-11 paired-audit false-accept)", () => {
  // Real observed listing: Italian Houndoom with NO Language aspect and NO
  // Card Number aspect — only the title fallback can catch it. Caught live by
  // the Tranche A I-009 paired audit; pinned so the gap stays closed.
  const target: IdentityTarget = { setName: "Neo Discovery", setId: "neo2", number: "4", name: "Houndoom" };
  const a = aspects([["Set", "Neo Discovery"], ["Finish", "Holo"]]);
  const v = verifyIdentity({
    target,
    aspects: a,
    topCondition: "Ungraded",
    title: "POKÉMON NEO DISCOVERY UNLIMITED HOUNDOOM HOLO 4/75 LP ITA",
    condition: "ANY_RAW",
  });
  assert.equal(gate(v, "language").pass, false, "bare ITA must read as a foreign-market marker");
  assert.equal(v.pass, false);
});

test("Language fallback: absent aspect + foreign title rejects; clean title passes", () => {
  const target: IdentityTarget = { setName: "Plasma Storm", setId: "bw11", number: "136", name: "Charizard" };
  const foreign = aspects([["Set", "Uragano Plasma"], ["Card Number", "136/135"]]);
  const vF = verifyIdentity({ target, aspects: foreign, topCondition: "Ungraded", title: "Charizard Plasma Storm 136 ITALIAN", condition: "ANY_RAW" });
  assert.equal(gate(vF, "language").pass, false, "ITALIAN title (no Language aspect) must reject");

  const clean = aspects([["Set", "Plasma Storm"], ["Card Number", "136/135"], ["Card Condition", "Near Mint or Better"]]);
  const vC = verifyIdentity({ target, aspects: clean, topCondition: "Ungraded", title: "Charizard Plasma Storm 136/135 NM", condition: "ANY_RAW" });
  assert.equal(gate(vC, "language").pass, true, "no Language aspect + clean title → presumed English");
  assert.equal(vC.pass, true, vC.reason);
});

// --- ANY_GRADED (wishlist "Any (Graded)" token — goal #3) --------------------

test("ANY_GRADED: any genuine slab passes the graded gate; raw listings reject", () => {
  const target: IdentityTarget = { setName: "Base", setId: "base1", number: "4", name: "Charizard" };
  const slab = aspects([["Set", "Base Set"], ["Card Number", "4/102"], ["Language", "English"], ["Grading Company", "CGC"], ["Grade", "8"]]);
  const vSlab = verifyIdentity({ target, aspects: slab, topCondition: "Graded", title: "CGC 8 Charizard Base Set", condition: "ANY_GRADED" });
  assert.equal(vSlab.pass, true, vSlab.reason);
  assert.equal(vSlab.condition, "GRADED");

  const raw = aspects([["Set", "Base Set"], ["Card Number", "4/102"], ["Language", "English"], ["Card Condition", "Near Mint or Better"]]);
  const vRaw = verifyIdentity({ target, aspects: raw, topCondition: "Ungraded", title: "Charizard Base Set NM", condition: "ANY_GRADED" });
  assert.equal(vRaw.pass, false, "a raw listing can't satisfy a graded watch");
  assert.equal(gate(vRaw, "graded_condition").pass, false);
});

test("ANY_GRADED: identity gates still apply — a Japanese slab rejects on Language", () => {
  const target: IdentityTarget = { setName: "Base", setId: "base1", number: "4", name: "Charizard" };
  const jpSlab = aspects([["Set", "Base Set"], ["Card Number", "4/102"], ["Language", "Japanese"], ["Grading Company", "PSA"], ["Grade", "9"]]);
  const v = verifyIdentity({ target, aspects: jpSlab, topCondition: "Graded", title: "PSA 9 Charizard", condition: "ANY_GRADED" });
  assert.equal(v.pass, false);
  assert.equal(gate(v, "language").pass, false);
});

test("Finish gate: hard only when a variant is requested", () => {
  const a = aspects([["Set", "Evolving Skies"], ["Card Number", "215/203"], ["Language", "English"], ["Finish", "Holo"], ["Card Condition", "Near Mint or Better"]]);
  const base: IdentityTarget = { setName: "Evolving Skies", setId: "swsh7", number: "215", name: "Umbreon" };
  // No variant requested → finish unconstrained → passes.
  assert.equal(verifyIdentity({ target: base, aspects: a, topCondition: "Ungraded", title: "Umbreon VMAX 215/203", condition: "ANY_RAW" }).pass, true);
  // Reverse-holo requested but the listing is Holo → finish hard reject.
  const v = verifyIdentity({ target: { ...base, requestedVariant: "reverse-holofoil" }, aspects: a, topCondition: "Ungraded", title: "Umbreon VMAX 215/203", condition: "ANY_RAW" });
  assert.equal(gate(v, "finish").pass, false);
  assert.equal(v.pass, false);
});
