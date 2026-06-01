// Gate 13 anti-hype tests (ADR-053). Confirms each banned term + emojis FAIL,
// soft superlatives warn (not block), and the buy-signal-visible copy (the
// methodology page + the badge labels) PASSES.

import test from "node:test";
import assert from "node:assert/strict";
import { antiHypeCheck, HYPE_HARD_TERMS } from "../seo/quality-gates.ts";
import { methodologyText } from "../buy-signal/methodology-content.ts";

// Every HARD-banned term must trip the gate.
for (const term of HYPE_HARD_TERMS) {
  test(`Gate 13: "${term}" is a hard violation`, () => {
    const r = antiHypeCheck(`This card is a ${term} right now if you ask me.`);
    assert.ok(r.hard.length > 0, `expected "${term}" to be flagged`);
  });
}

test("Gate 13: emojis are a hard violation (no emojis on buy-signal surfaces)", () => {
  assert.ok(antiHypeCheck("Below median 🚀").hard.some((h) => h.startsWith("emoji")));
  assert.ok(antiHypeCheck("Hot pick 🔥").hard.some((h) => h.startsWith("emoji")));
});

test("Gate 13: bare 'moon' does NOT fire (Moonbreon must not false-positive)", () => {
  assert.deepEqual(antiHypeCheck("Moonbreon (Umbreon VMAX Alt Art) sold for $2,100.").hard, []);
});

test("Gate 13: unquantified superlative SOFT-warns; with a number it does not", () => {
  assert.ok(antiHypeCheck("This card saw a huge run-up.").soft.includes("huge"));
  assert.deepEqual(antiHypeCheck("This card rose a huge 38% in 30 days.").soft, [], "a nearby number clears the soft warning");
});

test("Gate 13: the methodology page passes (no hard hype, no emojis)", () => {
  const r = antiHypeCheck(methodologyText());
  assert.deepEqual(r.hard, [], `methodology must carry no hype/emoji: ${JSON.stringify(r.hard)}`);
});

test("Gate 13: the three badge labels pass", () => {
  for (const label of ["Below 30-day sold", "At 30-day sold", "Above 30-day sold"]) {
    assert.deepEqual(antiHypeCheck(label).hard, [], `badge label must be hype-free: ${label}`);
  }
});

test("Gate 13: a clean analytical sentence passes both hard and soft", () => {
  const r = antiHypeCheck("The asking price is 12% below the 30-day sold average across 41 sales.");
  assert.deepEqual(r.hard, []);
  assert.deepEqual(r.soft, []);
});
