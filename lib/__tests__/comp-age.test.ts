// The comp-age honesty contract (audit 2026-07-14). These tests pin the two
// halves of the fix so the "undated sold figure" defect cannot silently return:
//   1. compAgeLabel — the copy every surface shows (fresh reads plainly, old
//      says its age out loud, unparseable → null).
//   2. The structural invariant — resolveSoldPanel never emits a headline
//      without a date. The type makes asOfIso required; this pins the RUNTIME
//      null-guard that backs it, so a future refactor that reintroduces an
//      undated windowed row fails a test, not just the compiler.

import test from "node:test";
import assert from "node:assert/strict";
import { compAgeLabel, compAgeDays, formatCompDate, COMP_AGE_PLAIN_MAX_DAYS } from "../cards/comp-age.ts";
import { resolveSoldPanel } from "../cards/sold-coherence.ts";
import type { SoldHistory } from "../poketrace/by-uuid.ts";

const NOW = Date.parse("2026-07-14T12:00:00Z");

test("compAgeLabel: fresh reads plainly; older says its age out loud", () => {
  assert.equal(compAgeLabel("2026-07-14T02:00:00Z", NOW), "as of Jul 14"); // same day
  assert.equal(compAgeLabel("2026-07-13T00:00:00Z", NOW), "as of Jul 13"); // 1 day → plain
  assert.equal(compAgeLabel("2026-07-01T00:00:00Z", NOW), "as of Jul 1 · 13 days ago"); // Moonbreon
  assert.equal(compAgeLabel("2026-06-12T00:00:00Z", NOW), "as of Jun 12 · 32 days ago");
});

test("compAgeLabel: prior-year comps carry the year so they can't read as this year", () => {
  assert.equal(compAgeLabel("2025-12-30T00:00:00Z", NOW), "as of Dec 30, 2025 · 196 days ago");
});

test("compAgeLabel: the plain/aged boundary is COMP_AGE_PLAIN_MAX_DAYS", () => {
  assert.equal(COMP_AGE_PLAIN_MAX_DAYS, 1);
  assert.ok(!compAgeLabel("2026-07-13T00:00:00Z", NOW)!.includes("ago"), "1 day is plain");
  assert.ok(compAgeLabel("2026-07-12T00:00:00Z", NOW)!.includes("2 days ago"), "2 days is aged");
});

test("compAgeLabel: singular vs plural day", () => {
  assert.match(compAgeLabel("2026-07-12T00:00:00Z", NOW)!, /2 days ago/);
  // 1-day is plain (no 'ago'), so 'day' singular only appears via compAgeDays.
});

test("compAgeDays / formatCompDate: clock skew never yields a negative age; junk → null", () => {
  assert.equal(compAgeDays("2026-07-15T00:00:00Z", NOW), 0, "a future stamp floors at 0, not -1");
  assert.equal(compAgeDays("not-a-date", NOW), null);
  assert.equal(compAgeLabel("not-a-date", NOW), null);
  assert.equal(formatCompDate("garbage", NOW), null);
});

// --- The structural invariant: no dated headline may escape undated ---

function histWith(lastUpdated: string | null): SoldHistory {
  return {
    uuid: "u",
    fetchedAt: 0,
    bySource: {
      ebay: {
        NEAR_MINT: {
          avg: 100,
          low: null,
          high: null,
          avg1d: null,
          avg7d: 100,
          avg30d: 100,
          median7d: null,
          median30d: null,
          saleCount: 20,
          lastUpdated,
          approxSaleCount: false,
        },
      },
    },
  };
}

test("INVARIANT: a fresh windowed headline always carries a date", () => {
  const model = resolveSoldPanel(histWith("2026-07-01T00:00:00.000Z"), { kind: "tier", tier: "NEAR_MINT" }, NOW);
  assert.ok(model.headline, "fresh NM tier resolves a headline");
  assert.equal(model.headline!.asOfIso, "2026-07-01T00:00:00.000Z");
  assert.ok(compAgeLabel(model.headline!.asOfIso, NOW), "and that date renders a real age line");
});

test("INVARIANT: a windowed figure with no lastUpdated resolves to NO headline, never an undated one", () => {
  // A null lastUpdated fails isFreshStat, so it can't be windowed — but this
  // pins the belt to the braces: whatever path produces a headline, it may not
  // produce one without a date.
  const model = resolveSoldPanel(histWith(null), { kind: "tier", tier: "NEAR_MINT" }, NOW);
  assert.equal(model.headline, null, "no date → no headline (honest empty, not an undated number)");
});
