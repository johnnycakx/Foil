// Tests for the market-movers / "good buys" momentum signal (ADR-069).
//
// Load-bearing assertions: (1) momentum math is the real (avg7d-avg30d)/avg30d;
// (2) the sample-size gate excludes thin/noisy cards (the honesty bar); (3) the
// batch picks the deepest-NM printing, emits a daily snapshot, and soft-fails
// per card; (4) the rate limiter respects the PokeTrace burst ceiling; (5) the
// read layer ranks + freshness-filters movers.

import test from "node:test";
import assert from "node:assert/strict";
import {
  computeMomentumPct,
  classifyMomentum,
  refreshMarketMovers,
  createRateLimiter,
  sortMovers,
  MOVER_MIN_SALES,
  type MomentumEntry,
  type CardMomentum,
} from "../deals/market-movers.ts";
import type { SoldHistory, SoldStat } from "../poketrace/by-uuid.ts";
import type { CardMetadata } from "../cards/sdk.ts";
import { rankMovers, toMoverRow, type MoverRow } from "../deals/market-movers-read.ts";

function nmStat(avg7d: number | null, avg30d: number | null, saleCount: number | null): SoldStat {
  return { avg: avg30d, low: null, high: null, avg1d: null, avg7d, avg30d, saleCount };
}

function history(uuid: string, stat: SoldStat | null): SoldHistory {
  return {
    uuid,
    fetchedAt: 0,
    bySource: stat ? { ebay: { NEAR_MINT: stat } } : {},
  };
}

function meta(id: string, variants: Array<{ variantKey: string; poketraceId: string }>): CardMetadata {
  return {
    id,
    name: `Card ${id}`,
    setName: "Evolving Skies",
    setId: id.split("-")[0],
    number: id.split("-")[1] ?? "1",
    image: `https://img/${id}.png`,
    rarity: null,
    variants: variants.map((v) => ({
      variantKey: v.variantKey,
      poketraceId: v.poketraceId,
      variantLabel: v.variantKey,
      isHolo: true,
      isFirstEdition: false,
      isShadowless: false,
      isUnlimited: false,
    })),
  } as unknown as CardMetadata;
}

// --- pure math ---

test("computeMomentumPct: real ratio, 1 dp", () => {
  assert.equal(computeMomentumPct(88, 100), -12); // 12% down
  assert.equal(computeMomentumPct(110, 100), 10); // 10% up
  assert.equal(computeMomentumPct(105.5, 100), 5.5);
});

test("computeMomentumPct: guards invalid windows", () => {
  assert.equal(computeMomentumPct(null, 100), null);
  assert.equal(computeMomentumPct(100, null), null);
  assert.equal(computeMomentumPct(100, 0), null);
  assert.equal(computeMomentumPct(100, -5), null);
  assert.equal(computeMomentumPct(Number.NaN, 100), null);
});

test("classifyMomentum: sample-size gate excludes thin cards", () => {
  assert.equal(classifyMomentum(nmStat(80, 100, MOVER_MIN_SALES - 1)), null);
  assert.equal(classifyMomentum(nmStat(80, 100, null)), null);
  const ok = classifyMomentum(nmStat(80, 100, MOVER_MIN_SALES));
  assert.ok(ok);
  assert.equal(ok!.direction, "down");
  assert.equal(ok!.momentumPct, -20);
});

test("classifyMomentum: thresholds → down / up / flat", () => {
  assert.equal(classifyMomentum(nmStat(91, 100, 20))!.direction, "down"); // -9% <= -8
  assert.equal(classifyMomentum(nmStat(95, 100, 20))!.direction, "flat"); // -5% in band
  assert.equal(classifyMomentum(nmStat(100, 100, 20))!.direction, "flat");
  assert.equal(classifyMomentum(nmStat(109, 100, 20))!.direction, "up"); // +9% >= 8
});

test("classifyMomentum: null stat / unusable windows → null", () => {
  assert.equal(classifyMomentum(null), null);
  assert.equal(classifyMomentum(nmStat(null, 100, 20)), null);
});

// --- rate limiter ---

test("createRateLimiter: respects the burst ceiling, sleeps when full", async () => {
  let t = 0;
  const sleeps: number[] = [];
  const limiter = createRateLimiter({
    maxPerWindow: 3,
    windowMs: 1000,
    now: () => t,
    sleep: async (ms) => { sleeps.push(ms); t += ms; },
  });
  for (let i = 0; i < 3; i++) await limiter.acquire();
  assert.equal(sleeps.length, 0, "first 3 within the window must not sleep");
  await limiter.acquire(); // 4th must wait for the window to free
  assert.equal(sleeps.length, 1);
  assert.ok(sleeps[0] >= 1000);
});

// --- batch ---

const baseHistories: Record<string, SoldHistory> = {};
function getSoldHistoryFrom(map: Record<string, SoldHistory>) {
  return async (uuid: string): Promise<SoldHistory | null> => map[uuid] ?? null;
}

test("refreshMarketMovers: picks the deepest-NM printing + emits a snapshot", async () => {
  const metaMap: Record<string, CardMetadata> = {
    "swsh7-215": meta("swsh7-215", [
      { variantKey: "holofoil", poketraceId: "uuid-thin" },
      { variantKey: "reverse-holofoil", poketraceId: "uuid-deep" },
    ]),
  };
  const histories: Record<string, SoldHistory> = {
    "uuid-thin": history("uuid-thin", nmStat(50, 60, 6)), // -16.7%, 6 sales
    "uuid-deep": history("uuid-deep", nmStat(880, 1000, 40)), // -12%, 40 sales (deeper)
  };
  const entries: MomentumEntry[] = [{ slug: "es-215-umbreon-vmax", pokemonTcgId: "swsh7-215" }];

  const res = await refreshMarketMovers({
    entries,
    getCardMetadata: async ({ id }) => metaMap[id],
    getSoldHistory: getSoldHistoryFrom(histories),
    now: new Date("2026-06-25T09:00:00Z"),
  });

  assert.equal(res.withMomentum, 1);
  const m = res.results[0];
  assert.equal(m.poketraceId, "uuid-deep", "picks the deepest NM market");
  assert.equal(m.momentumPct, -12);
  assert.equal(m.direction, "down");
  assert.equal(m.saleCount, 40);
  assert.equal(res.soldHistoryCalls, 2);
  // Snapshot mirrors the chosen printing's figures, dated UTC.
  assert.equal(res.snapshots.length, 1);
  assert.equal(res.snapshots[0].snapshotDate, "2026-06-25");
  assert.equal(res.snapshots[0].avg30d, 1000);
  assert.equal(res.snapshots[0].matchedTier, "NEAR_MINT");
});

test("refreshMarketMovers: thin sample → no result, no snapshot", async () => {
  const metaMap: Record<string, CardMetadata> = {
    "a-1": meta("a-1", [{ variantKey: "holofoil", poketraceId: "u1" }]),
  };
  const histories = { u1: history("u1", nmStat(80, 100, MOVER_MIN_SALES - 1)) };
  const res = await refreshMarketMovers({
    entries: [{ slug: "a-1", pokemonTcgId: "a-1" }],
    getCardMetadata: async ({ id }) => metaMap[id],
    getSoldHistory: getSoldHistoryFrom(histories),
  });
  assert.equal(res.withMomentum, 0);
  assert.equal(res.results.length, 0);
  assert.equal(res.snapshots.length, 0);
});

test("refreshMarketMovers: no variants / no NM data → skipped, never throws", async () => {
  const metaMap: Record<string, CardMetadata> = {
    "novars-1": meta("novars-1", []),
    "nonm-1": meta("nonm-1", [{ variantKey: "holofoil", poketraceId: "u-nonm" }]),
  };
  const histories = { "u-nonm": history("u-nonm", null) };
  const res = await refreshMarketMovers({
    entries: [
      { slug: "novars-1", pokemonTcgId: "novars-1" },
      { slug: "nonm-1", pokemonTcgId: "nonm-1" },
    ],
    getCardMetadata: async ({ id }) => metaMap[id],
    getSoldHistory: getSoldHistoryFrom(histories),
  });
  assert.equal(res.withMomentum, 0);
  assert.equal(res.errors.length, 0);
});

test("refreshMarketMovers: soft-fails per card (metadata + history throws)", async () => {
  const metaMap: Record<string, CardMetadata> = {
    "hist-boom": meta("hist-boom", [{ variantKey: "holofoil", poketraceId: "u-boom" }]),
    "good2": meta("good2", [{ variantKey: "holofoil", poketraceId: "u-good" }]),
  };
  const histories: Record<string, SoldHistory> = { "u-good": history("u-good", nmStat(80, 100, 20)) };
  const res = await refreshMarketMovers({
    entries: [
      { slug: "meta-boom", pokemonTcgId: "missing" }, // metadata throws
      { slug: "hist-boom", pokemonTcgId: "hist-boom" }, // its history throws
      { slug: "ok", pokemonTcgId: "good2" }, // succeeds
    ],
    getCardMetadata: async ({ id }) => {
      const m = metaMap[id];
      if (!m) throw new Error("metadata 404");
      return m;
    },
    getSoldHistory: async (uuid) => {
      if (uuid === "u-boom") throw new Error("poketrace 500");
      return histories[uuid] ?? null;
    },
    concurrency: 1,
  });
  // One metadata error + one soldHistory error recorded; the "ok" card produced
  // a result; the batch did not throw.
  assert.ok(res.errors.some((e) => e.stage === "metadata" && e.cardSlug === "meta-boom"));
  assert.ok(res.errors.some((e) => e.stage === "soldHistory" && e.cardSlug === "hist-boom"));
  assert.equal(res.withMomentum, 1);
  assert.equal(res.results[0].slug, "ok");
});

test("refreshMarketMovers: respects maxCards cap", async () => {
  const entries: MomentumEntry[] = Array.from({ length: 10 }, (_, i) => ({ slug: `s-${i}`, pokemonTcgId: `x-${i}` }));
  let metaCalls = 0;
  const res = await refreshMarketMovers({
    entries,
    getCardMetadata: async () => { metaCalls++; return meta("x", []); },
    getSoldHistory: async () => null,
    maxCards: 4,
  });
  assert.equal(res.capHit, true);
  assert.equal(res.cardsConsidered, 4);
  assert.equal(metaCalls, 4);
});

test("refreshMarketMovers: acquire() is called once per getSoldHistory", async () => {
  let acquired = 0;
  const metaMap: Record<string, CardMetadata> = {
    c: meta("c", [
      { variantKey: "holofoil", poketraceId: "u1" },
      { variantKey: "reverse-holofoil", poketraceId: "u2" },
    ]),
  };
  await refreshMarketMovers({
    entries: [{ slug: "c", pokemonTcgId: "c" }],
    getCardMetadata: async () => metaMap.c,
    getSoldHistory: async () => null,
    acquire: async () => { acquired++; },
  });
  assert.equal(acquired, 2);
});

test("sortMovers: down most-negative first, up most-positive first", () => {
  const movers: CardMomentum[] = [
    { slug: "a", cardName: "A", setName: "S", imageUrl: "", poketraceId: "ua", variantKey: "holofoil", avg7d: 90, avg30d: 100, saleCount: 20, momentumPct: -10, direction: "down" },
    { slug: "b", cardName: "B", setName: "S", imageUrl: "", poketraceId: "ub", variantKey: "holofoil", avg7d: 70, avg30d: 100, saleCount: 20, momentumPct: -30, direction: "down" },
    { slug: "c", cardName: "C", setName: "S", imageUrl: "", poketraceId: "uc", variantKey: "holofoil", avg7d: 120, avg30d: 100, saleCount: 20, momentumPct: 20, direction: "up" },
  ];
  const down = sortMovers(movers, "down");
  assert.deepEqual(down.map((m) => m.slug), ["b", "a"]);
  const up = sortMovers(movers, "up");
  assert.deepEqual(up.map((m) => m.slug), ["c"]);
});

// --- read layer ---

function moverRowRaw(over: Partial<Record<string, unknown>>) {
  return {
    card_slug: "s", card_name: "C", set_name: "S", image_url: "",
    direction: "down", momentum_pct: -10, avg7d: 90, avg30d: 100, sale_count: 20,
    matched_tier: "NEAR_MINT", computed_at: new Date().toISOString(), ...over,
  };
}

test("rankMovers: freshness filter drops stale rows", () => {
  const nowMs = Date.parse("2026-06-25T09:00:00Z");
  const fresh = toMoverRow(moverRowRaw({ card_slug: "fresh", computed_at: "2026-06-25T08:00:00Z" }) as never);
  const stale = toMoverRow(moverRowRaw({ card_slug: "stale", computed_at: "2026-06-22T08:00:00Z" }) as never);
  const { down } = rankMovers([fresh, stale], 12, nowMs);
  assert.deepEqual(down.map((m) => m.cardSlug), ["fresh"]);
});

test("rankMovers: splits + ranks down/up, honors limit", () => {
  const nowIso = "2026-06-25T08:00:00Z";
  const nowMs = Date.parse("2026-06-25T09:00:00Z");
  const rows: MoverRow[] = [
    toMoverRow(moverRowRaw({ card_slug: "d1", direction: "down", momentum_pct: -10, computed_at: nowIso }) as never),
    toMoverRow(moverRowRaw({ card_slug: "d2", direction: "down", momentum_pct: -25, computed_at: nowIso }) as never),
    toMoverRow(moverRowRaw({ card_slug: "u1", direction: "up", momentum_pct: 15, computed_at: nowIso }) as never),
  ];
  const { down, up } = rankMovers(rows, 1, nowMs);
  assert.deepEqual(down.map((m) => m.cardSlug), ["d2"]); // most-negative first, limit 1
  assert.deepEqual(up.map((m) => m.cardSlug), ["u1"]);
});
