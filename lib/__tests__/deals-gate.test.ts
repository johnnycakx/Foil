// /deals gated-teaser logic (validation-sprint Phase 3, ADR-112). The load-
// bearing property is THIN-DAY HONESTY: with supply 0–6 deals/day, the gate must
// never fabricate a locked count when there aren't more than 2 deals to lock.

import test from "node:test";
import assert from "node:assert/strict";
import { dealsGateState, TEASER_COUNT } from "../deals/gate.ts";

test("full board: top 2 shown, the rest locked with the REAL count", () => {
  const g = dealsGateState(6);
  assert.equal(g.shownCount, 2);
  assert.equal(g.lockedCount, 4);
  assert.match(g.headline, /4 more good buys today/);
});

test("locked count is singular at exactly 3 deals", () => {
  const g = dealsGateState(3);
  assert.equal(g.lockedCount, 1);
  assert.match(g.headline, /1 more good buy today/); // "buy", not "buys"
});

test("thin day (2 deals): everything shown, NO fake locked count", () => {
  const g = dealsGateState(2);
  assert.equal(g.shownCount, 2);
  assert.equal(g.lockedCount, 0);
  assert.doesNotMatch(g.headline, /more good buy/); // never invents a locked row
  assert.match(g.headline, /whole board today/i);
});

test("thin day (1 deal): shows the one, no lock", () => {
  const g = dealsGateState(1);
  assert.equal(g.shownCount, 1);
  assert.equal(g.lockedCount, 0);
});

test("empty day (0 deals): the trust-flex honest degrade, not a fake count", () => {
  const g = dealsGateState(0);
  assert.equal(g.shownCount, 0);
  assert.equal(g.lockedCount, 0);
  assert.match(g.headline, /nothing worth locking today/i);
});

test("every state names Pro (the drop is Pro's deliverable — the content marker)", () => {
  // Re-locked by the 2026-07-11 offer-lock: the gate sells the trial, so the
  // stable marker is "Pro", present in every supply state.
  for (const n of [0, 1, 2, 3, 6, 12]) {
    assert.match(dealsGateState(n).subtext, /\bPro\b/, `n=${n} subtext must anchor the marker`);
  }
});

test("locked copy verbatim: 'Pro sees everything Foil finds, first.'", () => {
  assert.equal(dealsGateState(6).subtext, "Pro sees everything Foil finds, first.");
});

test("lockedCount never exceeds total-minus-teaser and never goes negative", () => {
  for (const n of [-3, 0, 1, 2, 3, 10]) {
    const g = dealsGateState(n);
    const total = Math.max(0, n);
    assert.equal(g.lockedCount, Math.max(0, total - TEASER_COUNT), `n=${n}`);
    assert.ok(g.lockedCount >= 0);
  }
});
