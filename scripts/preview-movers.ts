// Before/after preview of the market-movers board (ADR-070 verification).
//
// Runs the NM-tier momentum computation over the movers universe against LIVE
// PokeTrace (one fetch pass), then reports what the "good buys" board WOULD show
// under the OLD rules (curated-only universe, no materiality filter) vs the NEW
// rules (curated + modern chase, $10 materiality floor). This is the honest
// before/after the goal asks for — it needs the PokeTrace key but NOT the DB.
//
// Reads baked variants directly from baked-metadata.json (no live SDK calls).
//
// Usage: node --experimental-strip-types scripts/preview-movers.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(process.cwd(), ".env.local");
try {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\r$/, "");
  }
} catch {}

if (!process.env.POKETRACE_API_KEY) {
  console.error("[preview] POKETRACE_API_KEY required (env or .env.local)");
  process.exit(1);
}

const { CARD_CATALOG, cardTier } = await import("../lib/cards/catalog.ts");
const { getSoldHistory } = await import("../lib/poketrace/by-uuid.ts");
const {
  computeMomentumPct,
  createRateLimiter,
  isModernMoverCard,
  MOVER_MIN_SALES,
  MOVER_MIN_NM_VALUE,
  MOVER_DOWN_THRESHOLD_PCT,
} = await import("../lib/deals/market-movers.ts");

type Baked = { cards: Record<string, { name?: string; setName?: string; variants?: Array<{ variantKey: string; poketraceId: string }> }> };
const baked = JSON.parse(readFileSync(join(process.cwd(), "lib/cards/baked-metadata.json"), "utf8")) as Baked;

type Row = { slug: string; name: string; setId: string; curated: boolean; avg7d: number; avg30d: number; saleCount: number; momentumPct: number };

const universe = CARD_CATALOG.filter((e) => cardTier(e.slug) === "curated" || isModernMoverCard(e.pokemonTcgId));
console.log(`[preview] movers universe: ${universe.length} cards (${universe.filter((e) => cardTier(e.slug) === "curated").length} curated + ${universe.filter((e) => isModernMoverCard(e.pokemonTcgId)).length} modern)`);

const limiter = createRateLimiter({ maxPerWindow: 28, windowMs: 10_000 });
const rows: Row[] = [];
let calls = 0;

async function processCard(entry: { slug: string; pokemonTcgId: string }): Promise<void> {
  const card = baked.cards[entry.pokemonTcgId];
  const variants = card?.variants ?? [];
  if (variants.length === 0) return;
  let best: { avg7d: number | null; avg30d: number | null; saleCount: number | null } | null = null;
  for (const v of variants) {
    if (!v.poketraceId) continue;
    await limiter.acquire();
    calls++;
    const hist = await getSoldHistory(v.poketraceId);
    const nm = hist?.bySource?.ebay?.NEAR_MINT ?? hist?.bySource?.tcgplayer?.NEAR_MINT ?? hist?.bySource?.cardmarket?.NEAR_MINT ?? null;
    if (!nm) continue;
    const sc = typeof nm.saleCount === "number" ? nm.saleCount : 0;
    if (!best || sc > (best.saleCount ?? 0)) best = { avg7d: nm.avg7d, avg30d: nm.avg30d, saleCount: nm.saleCount };
  }
  if (!best) return;
  const pct = computeMomentumPct(best.avg7d, best.avg30d);
  if (pct === null) return;
  rows.push({
    slug: entry.slug,
    name: card?.name ?? entry.slug,
    setId: entry.pokemonTcgId.split("-")[0],
    curated: cardTier(entry.slug) === "curated",
    avg7d: best.avg7d as number,
    avg30d: best.avg30d as number,
    saleCount: best.saleCount ?? 0,
    momentumPct: pct,
  });
}

// bounded concurrency
let i = 0;
const workers = Array.from({ length: 4 }, async () => {
  while (i < universe.length) {
    const e = universe[i++];
    try { await processCard(e); } catch {}
    if (i % 50 === 0) console.log(`  …${i}/${universe.length} (${calls} PokeTrace calls)`);
  }
});
await Promise.all(workers);

console.log(`\n[preview] fetched NM stats for ${rows.length} cards (${calls} PokeTrace calls)\n`);

function downMovers(rs: Row[]): Row[] {
  return rs.filter((r) => r.saleCount >= MOVER_MIN_SALES && r.momentumPct <= MOVER_DOWN_THRESHOLD_PCT).sort((a, b) => a.momentumPct - b.momentumPct);
}
const fmt = (r: Row) => `  ${r.momentumPct.toFixed(1).padStart(7)}%  $${r.avg30d.toFixed(2).padStart(9)} (NM 30d)  ${String(r.saleCount).padStart(4)} sales  ${r.setId.padEnd(8)} ${r.name}`;

// BEFORE: curated-only universe, NO materiality filter (the old board).
const beforeUniverse = rows.filter((r) => r.curated);
const before = downMovers(beforeUniverse);
console.log(`=== BEFORE (curated-only, no materiality filter) — ${before.length} down movers ===`);
for (const r of before.slice(0, 12)) console.log(fmt(r));
const beforeSub10 = before.filter((r) => r.avg30d < MOVER_MIN_NM_VALUE).length;
console.log(`  (${beforeSub10} of these are sub-$${MOVER_MIN_NM_VALUE} bulk)\n`);

// AFTER: curated + modern universe, $10 materiality floor (the new board).
const after = downMovers(rows).filter((r) => r.avg30d >= MOVER_MIN_NM_VALUE);
const afterModern = after.filter((r) => !r.curated).length;
console.log(`=== AFTER (curated + modern, $${MOVER_MIN_NM_VALUE} materiality floor) — ${after.length} down movers ===`);
for (const r of after.slice(0, 15)) console.log(fmt(r));
console.log(`\n  good buys: ${after.length} (${afterModern} from modern sets); cheapest surfaced NM 30d avg: $${Math.min(...after.map((r) => r.avg30d)).toFixed(2)}`);
