// PokeTrace daily price-history client (Session 49c / ADR-044).
//
// Pins the real tier-scoped endpoint integration: URL construction, the
// condition→chart-tier mapping, the parse (same-date dedup preferring eBay,
// oldest→newest, drop no-avg rows), the 1h cache, and soft-fail on 404 /
// missing key. The endpoint shape was verified empirically against
// api.poketrace.com on 2026-05-30.

import test from "node:test";
import assert from "node:assert/strict";
import {
  getPriceHistory,
  parsePriceHistory,
  chartTierForCondition,
  PERIOD_FOR_RANGE,
  __clearPriceHistoryCache,
} from "../poketrace/price-history.ts";

// Newest→oldest, as the API returns; includes a same-date eBay+TCGplayer pair
// and a row with no avg (should be dropped).
const SAMPLE = [
  { date: "2026-05-29", source: "tcgplayer", avg: 572.51, low: 560, high: 600, saleCount: 1, median7d: null, median30d: 555 },
  { date: "2026-05-29", source: "ebay", avg: 540.0, low: 500, high: 560, saleCount: 3, median7d: 538, median30d: 545 },
  { date: "2026-05-20", source: "ebay", avg: 510.0, low: 500, high: 520, saleCount: 2, median7d: 512, median30d: 515 },
  { date: "2026-05-10", source: "ebay", avg: null, low: null, high: null, saleCount: 0, median7d: null, median30d: null },
];

function capturingFetch(body: unknown, captured: { url?: string; headers?: Record<string, string> }): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    captured.url = url;
    captured.headers = (init?.headers ?? {}) as Record<string, string>;
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}
function badFetch(status: number): typeof fetch {
  return (async () => ({ ok: false, status, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch;
}

test("chartTierForCondition: specific tier / raw→NM / graded→preferred", () => {
  assert.equal(chartTierForCondition("psa-10", null), "PSA_10");
  assert.equal(chartTierForCondition("bgs-9-5", null), "BGS_9_5");
  assert.equal(chartTierForCondition("nm", null), "NEAR_MINT");
  assert.equal(chartTierForCondition("any-raw", "PSA_10"), "NEAR_MINT");
  assert.equal(chartTierForCondition(undefined, null), "NEAR_MINT");
  assert.equal(chartTierForCondition("any-graded", "PSA_10"), "PSA_10");
  assert.equal(chartTierForCondition("any-graded", null), null);
});

test("PERIOD_FOR_RANGE maps the 5 UI ranges to PokeTrace periods", () => {
  assert.deepEqual(PERIOD_FOR_RANGE, { "7D": "7d", "1M": "30d", "3M": "90d", "1Y": "1y", MAX: "all" });
});

test("parsePriceHistory: dedup same-date preferring eBay, oldest→newest, drops no-avg", () => {
  const rows = parsePriceHistory(SAMPLE);
  assert.deepEqual(rows.map((r) => r.date), ["2026-05-20", "2026-05-29"]); // sorted, no-avg dropped
  const may29 = rows.find((r) => r.date === "2026-05-29")!;
  assert.equal(may29.source, "ebay", "eBay wins the same-date tie");
  assert.equal(may29.avg, 540.0);
  assert.equal(may29.median7d, 538);
  // Non-array / junk → empty.
  assert.deepEqual(parsePriceHistory(null), []);
  assert.deepEqual(parsePriceHistory({}), []);
});

test("getPriceHistory: builds the tier-scoped URL with period + limit + key header", async () => {
  __clearPriceHistoryCache();
  process.env.POKETRACE_API_KEY = "test-key";
  const cap: { url?: string; headers?: Record<string, string> } = {};
  const rows = await getPriceHistory({
    uuid: "abc-123",
    tier: "NEAR_MINT",
    period: "30d",
    fetchImpl: capturingFetch({ data: SAMPLE }, cap),
  });
  assert.equal(
    cap.url,
    "https://api.poketrace.com/v1/cards/abc-123/prices/NEAR_MINT/history?period=30d&limit=365",
  );
  assert.equal(cap.headers?.["X-API-Key"], "test-key");
  assert.ok(rows && rows.length === 2);
});

test("getPriceHistory: 1h cache — second call within TTL doesn't refetch", async () => {
  __clearPriceHistoryCache();
  process.env.POKETRACE_API_KEY = "test-key";
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ data: SAMPLE }) } as unknown as Response;
  }) as unknown as typeof fetch;
  await getPriceHistory({ uuid: "u", tier: "PSA_10", period: "all", fetchImpl });
  await getPriceHistory({ uuid: "u", tier: "PSA_10", period: "all", fetchImpl });
  assert.equal(calls, 1);
});

test("getPriceHistory: soft-fails to null on 404 / missing uuid / missing key", async () => {
  __clearPriceHistoryCache();
  process.env.POKETRACE_API_KEY = "test-key";
  assert.equal(await getPriceHistory({ uuid: null, tier: "NEAR_MINT", fetchImpl: badFetch(404) }), null);
  assert.equal(await getPriceHistory({ uuid: "u", tier: "BGS_10", period: "all", fetchImpl: badFetch(404) }), null);

  const prev = process.env.POKETRACE_API_KEY;
  delete process.env.POKETRACE_API_KEY;
  __clearPriceHistoryCache();
  assert.equal(
    await getPriceHistory({ uuid: "u", tier: "NEAR_MINT", fetchImpl: capturingFetch({ data: SAMPLE }, {}) }),
    null,
  );
  if (prev) process.env.POKETRACE_API_KEY = prev;
});
