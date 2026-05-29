import test from "node:test";
import assert from "node:assert/strict";
import { parseSoldHistory, getSoldHistory, __clearSoldHistoryCache } from "../poketrace/by-uuid.ts";

const SAMPLE_CARD = {
  prices: {
    ebay: {
      NEAR_MINT: { avg: 313.51, low: 300, high: 330, avg1d: 655, avg7d: 482.28, avg30d: 508.15, saleCount: 34, approxSaleCount: true },
      LIGHTLY_PLAYED: { avg: 435.99, avg30d: 418.66, saleCount: 76 },
      PSA_10: { avg: 30100, avg30d: 30100, saleCount: 3 },
    },
    tcgplayer: {
      NEAR_MINT: { avg: 320, avg30d: 318, saleCount: 12 },
    },
    cardmarket: { NEAR_MINT: { avg: 290 } }, // not in SOURCES → ignored
  },
};

function okFetch(body: unknown): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as Response) as unknown as typeof fetch;
}
function badFetch(status: number): typeof fetch {
  return (async () => ({ ok: false, status, json: async () => ({}) }) as unknown as Response) as unknown as typeof fetch;
}

test("parseSoldHistory builds bySource for ebay + tcgplayer + cardmarket (Session 49.2)", () => {
  const h = parseSoldHistory("uuid-1", SAMPLE_CARD);
  assert.equal(h.uuid, "uuid-1");
  assert.ok(h.bySource.ebay);
  assert.ok(h.bySource.tcgplayer);
  // cardmarket is now a SoldSource (EU-only cards surface only here).
  assert.ok(h.bySource.cardmarket, "cardmarket source must be parsed");
  assert.equal(h.bySource.cardmarket!.NEAR_MINT.avg, 290);
  assert.equal(h.bySource.ebay!.NEAR_MINT.avg30d, 508.15);
  assert.equal(h.bySource.ebay!.NEAR_MINT.saleCount, 34);
  assert.equal(h.bySource.ebay!.PSA_10.avg30d, 30100);
});

test("parseSoldHistory: EU/cardmarket-only card surfaces its AGGREGATED tier", () => {
  const euCard = { prices: { cardmarket: { AGGREGATED: { avg: 82.41, low: 25, high: null, avg1d: 73, avg7d: 86.5, avg30d: 61.25 } } } };
  const h = parseSoldHistory("eu_274781_holo", euCard);
  assert.equal(h.bySource.ebay, undefined);
  assert.equal(h.bySource.tcgplayer, undefined);
  assert.ok(h.bySource.cardmarket);
  assert.equal(h.bySource.cardmarket!.AGGREGATED.avg30d, 61.25);
  assert.equal(h.bySource.cardmarket!.AGGREGATED.saleCount, null);
});

test("parseSoldHistory tolerates missing prices", () => {
  const h = parseSoldHistory("u", { prices: null });
  assert.deepEqual(h.bySource, {});
  const h2 = parseSoldHistory("u", {});
  assert.deepEqual(h2.bySource, {});
});

test("getSoldHistory returns parsed history + caches", async (t) => {
  __clearSoldHistoryCache();
  process.env.POKETRACE_API_KEY = "test-key";
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return { ok: true, status: 200, json: async () => ({ data: SAMPLE_CARD }) } as unknown as Response;
  }) as unknown as typeof fetch;

  const h1 = await getSoldHistory("uuid-cache", { fetchImpl });
  assert.ok(h1);
  assert.equal(h1!.bySource.ebay!.NEAR_MINT.avg30d, 508.15);
  const h2 = await getSoldHistory("uuid-cache", { fetchImpl });
  assert.equal(calls, 1, "second call within TTL must hit cache, not refetch");
  assert.equal(h2!.uuid, "uuid-cache");

  t.after(() => __clearSoldHistoryCache());
});

test("getSoldHistory soft-fails to null on non-200 and on missing uuid", async () => {
  __clearSoldHistoryCache();
  process.env.POKETRACE_API_KEY = "test-key";
  assert.equal(await getSoldHistory(null), null);
  assert.equal(await getSoldHistory("uuid-bad", { fetchImpl: badFetch(500) }), null);
});

test("getSoldHistory returns null when API key absent", async () => {
  __clearSoldHistoryCache();
  const prev = process.env.POKETRACE_API_KEY;
  delete process.env.POKETRACE_API_KEY;
  assert.equal(await getSoldHistory("uuid-x", { fetchImpl: okFetch({ data: SAMPLE_CARD }) }), null);
  if (prev) process.env.POKETRACE_API_KEY = prev;
});
