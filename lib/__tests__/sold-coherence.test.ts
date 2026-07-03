// Sold-data coherence + honest display resolution (sold-data-integrity goal).
//
// The end-to-end pin is the REAL xy4-122 Dialga-EX incident payload
// (lib/__fixtures__/poketrace/xy4-122-dialga-ex.json, captured live
// 2026-07-03): the pre-fix page rendered "30-DAY SOLD AVG $391 · n=63 sales"
// for a card with ~3 raw sales in the actual last 30 days, a non-monotonic
// ladder (DMG $261 > HP $128 — a single January sale), and a PSA 10 row
// showing a lone April sale ($24,500) as current. These tests pin that the
// resolver can never reproduce any of those renders.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSoldHistory, type SoldHistory, type SoldStat } from "../poketrace/by-uuid.ts";
import {
  isFreshStat,
  windowedValue,
  displayFor,
  freshWindowedValue,
  ladderViolations,
  crossSourceViolations,
  resolveSoldPanel,
  describeViolations,
  SOLD_FRESHNESS_MAX_DAYS,
  LADDER_TOLERANCE,
  CROSS_SOURCE_RATIO_MAX,
} from "../cards/sold-coherence.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// Deterministic "today" — the day the incident payload was captured.
const NOW = Date.parse("2026-07-03T12:00:00Z");
const FRESH = "2026-06-25T00:00:00.000Z";
const STALE = "2026-01-30T00:00:00.000Z";

function stat(over: Partial<SoldStat>): SoldStat {
  return {
    avg: null,
    low: null,
    high: null,
    avg1d: null,
    avg7d: null,
    avg30d: null,
    median7d: null,
    median30d: null,
    saleCount: null,
    lastUpdated: FRESH,
    approxSaleCount: false,
    ...over,
  };
}

function ebayHistory(tiers: Record<string, SoldStat>): SoldHistory {
  return { uuid: "x", fetchedAt: 0, bySource: { ebay: tiers } };
}

// --- freshness + display primitives ---

test("isFreshStat: within the window, at the boundary, beyond, and undated", () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const at = (daysAgo: number) => new Date(NOW - daysAgo * dayMs).toISOString();
  assert.equal(isFreshStat(stat({ lastUpdated: at(1) }), NOW), true);
  assert.equal(isFreshStat(stat({ lastUpdated: at(SOLD_FRESHNESS_MAX_DAYS) }), NOW), true, "boundary inclusive");
  assert.equal(isFreshStat(stat({ lastUpdated: at(SOLD_FRESHNESS_MAX_DAYS + 1) }), NOW), false);
  assert.equal(isFreshStat(stat({ lastUpdated: null }), NOW), false, "undated is never provably fresh");
  assert.equal(isFreshStat(stat({ lastUpdated: "not-a-date" }), NOW), false);
});

test("windowedValue: avg30d first, median30d fallback, NEVER the last-sale avg", () => {
  assert.equal(windowedValue(stat({ avg30d: 260.81, median30d: 250, avg: 321.62 })), 260.81);
  assert.equal(windowedValue(stat({ median30d: 564.73, avg: 564.73 })), 564.73);
  assert.equal(windowedValue(stat({ avg: 128.02 })), null, "avg alone is a single sale, not a window");
});

test("displayFor: fresh windowed → 30-day figure; stale → dated last sale; undated → nothing", () => {
  assert.deepEqual(displayFor(stat({ avg30d: 100 }), NOW), { kind: "windowed", value: 100 });
  assert.deepEqual(displayFor(stat({ avg30d: 100, avg: 90, lastUpdated: STALE }), NOW), {
    kind: "last-sale",
    value: 90,
    atIso: STALE,
  });
  assert.equal(displayFor(stat({ avg: 90, lastUpdated: null }), NOW), null);
});

test("freshWindowedValue: the only basis a computation may use", () => {
  assert.equal(freshWindowedValue(stat({ avg30d: 100 }), NOW), 100);
  assert.equal(freshWindowedValue(stat({ avg30d: 100, lastUpdated: STALE }), NOW), null);
  assert.equal(freshWindowedValue(null, NOW), null);
});

// --- coherence checks: positive + negative each ---

test("ladderViolations: a worse condition above tolerance over a better one flags", () => {
  const h = ebayHistory({
    NEAR_MINT: stat({ avg30d: 100, saleCount: 10 }),
    DAMAGED: stat({ avg30d: 100 * LADDER_TOLERANCE + 1, saleCount: 5 }),
  });
  const v = ladderViolations(h, NOW);
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "ladder");
  assert.match(describeViolations(v), /ladder: DAMAGED/);
});

test("ladderViolations: inversion within tolerance (thin-window noise) does NOT flag", () => {
  const h = ebayHistory({
    NEAR_MINT: stat({ avg30d: 100, saleCount: 10 }),
    DAMAGED: stat({ avg30d: 100 * LADDER_TOLERANCE - 1, saleCount: 5 }),
  });
  assert.equal(ladderViolations(h, NOW).length, 0);
});

test("ladderViolations: STALE tiers do not participate (they render as dated last sales)", () => {
  // The raw xy4-122 shape: DMG fresh $261 vs HP stale $128 — pre-fix this
  // rendered as a non-monotonic ladder; post-fix HP makes no windowed claim.
  const h = ebayHistory({
    HEAVILY_PLAYED: stat({ avg30d: 128, saleCount: 1, lastUpdated: STALE }),
    DAMAGED: stat({ avg30d: 261, saleCount: 6 }),
  });
  assert.equal(ladderViolations(h, NOW).length, 0);
});

test("crossSourceViolations: two fresh sources disagreeing wildly on the SAME tier flags", () => {
  const h: SoldHistory = {
    uuid: "x",
    fetchedAt: 0,
    bySource: {
      ebay: { NEAR_MINT: stat({ avg30d: 100 }) },
      tcgplayer: { NEAR_MINT: stat({ avg30d: 100 * CROSS_SOURCE_RATIO_MAX + 5 }) },
    },
  };
  const v = crossSourceViolations(h, NOW);
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "cross-source");
  assert.match(describeViolations(v), /cross-source NEAR_MINT/);
});

test("crossSourceViolations: marketplace-level gaps within tolerance do NOT flag; stale side excluded", () => {
  const within: SoldHistory = {
    uuid: "x",
    fetchedAt: 0,
    bySource: {
      ebay: { NEAR_MINT: stat({ avg30d: 565 }) },
      tcgplayer: { NEAR_MINT: stat({ avg30d: 975 }) }, // 1.7x — eBay runs cheaper; legitimate
    },
  };
  assert.equal(crossSourceViolations(within, NOW).length, 0);
  const oneStale: SoldHistory = {
    uuid: "x",
    fetchedAt: 0,
    bySource: {
      ebay: { NEAR_MINT: stat({ avg30d: 100 }) },
      tcgplayer: { NEAR_MINT: stat({ avg30d: 900, lastUpdated: STALE }) },
    },
  };
  assert.equal(crossSourceViolations(oneStale, NOW).length, 0, "a stale source makes no current claim");
});

test("resolveSoldPanel: a ladder inversion suppresses ALL figures (the render-time honesty gate)", () => {
  const h = ebayHistory({
    NEAR_MINT: stat({ avg30d: 100, saleCount: 10 }),
    DAMAGED: stat({ avg30d: 400, saleCount: 5 }),
  });
  const model = resolveSoldPanel(h, { kind: "raw-agg" }, NOW);
  assert.equal(model.suppressed, true);
  assert.ok(model.violations.length >= 1);
});

test("resolveSoldPanel: a cross-source dispute drops THAT tier only — the rest of the panel stands", () => {
  // The Umbreon-ex class from the scan: eBay NM $1,196 vs a nonsense
  // TCGplayer $1. We can't arbitrate which source is wrong → the NM tier is
  // never rendered (not even as a last sale), but LP still is.
  const h: SoldHistory = {
    uuid: "x",
    fetchedAt: 0,
    bySource: {
      ebay: { NEAR_MINT: stat({ avg30d: 1196, saleCount: 40 }), LIGHTLY_PLAYED: stat({ avg30d: 900, saleCount: 12 }) },
      tcgplayer: { NEAR_MINT: stat({ avg30d: 1, saleCount: 3 }) },
    },
  };
  const model = resolveSoldPanel(h, { kind: "raw-agg" }, NOW);
  assert.equal(model.suppressed, false, "tier-granular, not panel-granular");
  assert.deepEqual(model.disputedTiers, ["NEAR_MINT"]);
  assert.ok(!model.rows.some((r) => r.tier === "NEAR_MINT"), "the disputed tier never renders");
  assert.equal(model.headline?.tierKey, "LIGHTLY_PLAYED", "headline falls to the next clean tier");
  // Selecting the disputed condition directly gets no figure either.
  const nm = resolveSoldPanel(h, { kind: "tier", tier: "NEAR_MINT" }, NOW);
  assert.equal(nm.headline, null);
  assert.equal(nm.lastSale, null);
});

test("resolveSoldPanel: a disputed tier does not create phantom ladder violations", () => {
  // NM disputed (dropped); the surviving LP > MP ladder is clean → no suppression.
  const h: SoldHistory = {
    uuid: "x",
    fetchedAt: 0,
    bySource: {
      ebay: {
        NEAR_MINT: stat({ avg30d: 10, saleCount: 5 }), // absurdly low vs tcgplayer
        LIGHTLY_PLAYED: stat({ avg30d: 90, saleCount: 12 }),
        MODERATELY_PLAYED: stat({ avg30d: 70, saleCount: 9 }),
      },
      tcgplayer: { NEAR_MINT: stat({ avg30d: 120, saleCount: 8 }) },
    },
  };
  const model = resolveSoldPanel(h, { kind: "raw-agg" }, NOW);
  assert.deepEqual(model.disputedTiers, ["NEAR_MINT"]);
  assert.equal(model.suppressed, false, "LP/MP inversion vs the DROPPED NM must not fire the ladder gate");
});

// --- headline resolution ---

test("resolveSoldPanel: 'any raw' resolves to the best fresh tier, LABELED — never a pooled blend", () => {
  const h = ebayHistory({
    // NM stale → the headline falls through to LP, and says so.
    NEAR_MINT: stat({ avg30d: 500, saleCount: 12, lastUpdated: STALE }),
    LIGHTLY_PLAYED: stat({ avg30d: 420, saleCount: 19 }),
  });
  const model = resolveSoldPanel(h, { kind: "raw-agg" }, NOW);
  assert.equal(model.suppressed, false);
  assert.equal(model.headline?.tierKey, "LIGHTLY_PLAYED");
  assert.equal(model.headline?.value, 420);
});

test("resolveSoldPanel: no fresh raw tier → no headline, honest last-sale info instead", () => {
  const h = ebayHistory({
    NEAR_MINT: stat({ avg30d: 500, avg: 480, saleCount: 12, lastUpdated: "2026-05-01T00:00:00.000Z" }),
  });
  const model = resolveSoldPanel(h, { kind: "raw-agg" }, NOW);
  assert.equal(model.headline, null);
  assert.equal(model.lastSale?.value, 480);
  assert.equal(model.lastSale?.tierKey, "NEAR_MINT");
});

test("resolveSoldPanel: EU cardmarket-only card falls back to the AGGREGATED row + headline", () => {
  const h: SoldHistory = {
    uuid: "eu",
    fetchedAt: 0,
    bySource: { cardmarket: { AGGREGATED: stat({ avg30d: 61.25, saleCount: null }) } },
  };
  const model = resolveSoldPanel(h, { kind: "raw-agg" }, NOW);
  assert.equal(model.rows.length, 0);
  assert.equal(model.aggregatedRow?.display.kind, "windowed");
  assert.equal(model.headline?.tierKey, "AGGREGATED");
});

// --- the xy4-122 end-to-end pin (real incident payload) ---

function loadIncident(): SoldHistory {
  const raw = JSON.parse(readFileSync(join(ROOT, "lib/__fixtures__/poketrace/xy4-122-dialga-ex.json"), "utf8"));
  return parseSoldHistory("019bff85-545c-706c-953b-21b6ca3e68f9", raw);
}

test("xy4-122: the $391 pooled mixed-condition headline can never render again", () => {
  const model = resolveSoldPanel(loadIncident(), { kind: "raw-agg" }, NOW);
  assert.equal(model.suppressed, false, "post-fix figures are coherent — honest, not blanked");
  // The honest headline: the NM tier's windowed median (its avg30d is null —
  // one sale in the window), labeled NEAR_MINT.
  assert.equal(model.headline?.tierKey, "NEAR_MINT");
  assert.equal(model.headline?.value, 564.73);
  // The incident render was $391 (saleCount-weighted avg30d over LP/MP/DMG
  // with NM excluded from the average but counted in n). Nothing the resolver
  // returns is anywhere near it.
  assert.ok(Math.abs((model.headline?.value ?? 0) - 390.91) > 50, "the pooled blend is dead");
  // n=63 was the sum of ALL-TIME tier counts sold as a 30-day n. The headline
  // count is the shown tier's own count, approx-marked.
  assert.equal(model.headline?.saleCount, 12);
  assert.equal(model.headline?.approxSaleCount, true);
});

test("xy4-122: stale tiers render as dated last sales, never as current 30-day figures", () => {
  const model = resolveSoldPanel(loadIncident(), { kind: "raw-agg" }, NOW);
  const byTier = new Map(model.rows.map((r) => [r.tier, r]));
  // HEAVILY_PLAYED: one sale, 2026-01-30 — the pre-fix ladder rendered it as
  // a live $128 rung (below fresher DMG = the non-monotonic signature).
  const hp = byTier.get("HEAVILY_PLAYED");
  assert.equal(hp?.display.kind, "last-sale");
  assert.match((hp?.display as { atIso: string }).atIso, /^2026-01-30/);
  // LIGHTLY_PLAYED: last sale 2026-05-27 — its avg30d described a window that
  // ended in May; not a current figure.
  assert.equal(byTier.get("LIGHTLY_PLAYED")?.display.kind, "last-sale");
  // NEAR_MINT + DAMAGED are actually fresh → true windowed figures.
  assert.equal(byTier.get("NEAR_MINT")?.display.kind, "windowed");
  assert.equal(byTier.get("DAMAGED")?.display.kind, "windowed");
  // And the FRESH ladder is monotonic: NM 564.73 > MP 352.88 > DMG 260.81.
  assert.equal(ladderViolations(loadIncident(), NOW).length, 0);
});

test("xy4-122: the graded row is the freshest preferred grade (PSA 9), not April's lone $24,500 PSA 10", () => {
  const model = resolveSoldPanel(loadIncident(), { kind: "raw-agg" }, NOW);
  assert.equal(model.gradedRow?.tier, "PSA_9");
  assert.equal(model.gradedRow?.display.kind, "windowed");
  assert.equal((model.gradedRow?.display as { value: number }).value, 2530);
  // 'Any (Graded)' headline resolves the same way.
  const graded = resolveSoldPanel(loadIncident(), { kind: "graded-agg" }, NOW);
  assert.equal(graded.headline?.tierKey, "PSA_9");
});

test("xy4-122: a directly selected stale condition gets last-sale honesty, not a number", () => {
  // ?c=hp — the January single sale.
  const model = resolveSoldPanel(loadIncident(), { kind: "tier", tier: "HEAVILY_PLAYED" }, NOW);
  assert.equal(model.headline, null);
  assert.equal(model.lastSale?.value, 128.02);
  assert.match(model.lastSale?.atIso ?? "", /^2026-01-30/);
});

test("by-uuid parse carries the honesty fields (lastUpdated / approxSaleCount / medians)", () => {
  const h = loadIncident();
  const nm = h.bySource.ebay?.NEAR_MINT;
  assert.equal(nm?.lastUpdated, "2026-06-30T00:00:00.000Z");
  assert.equal(nm?.approxSaleCount, true);
  assert.equal(nm?.median30d, 564.73);
  const tcgNm = h.bySource.tcgplayer?.NEAR_MINT;
  assert.equal(tcgNm?.approxSaleCount, false);
});
