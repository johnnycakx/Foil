// CALIBRATION SWEEP for the verified-listing resolver (Tranche A #1 closure gate).
// Read-only. Runs the resolver live across all eBay-live curated cards, logs
// every gate decision to STDOUT (no DB, no committed listing data — R-008), and
// prints aggregates + a rejects sample for the hand-audit. The committed report
// (docs/calibration-resolver-2026-06.md) carries DERIVED aggregates only.
//
// Run: node --experimental-strip-types --no-warnings --env-file=.env.local scripts/calibrate-resolver.ts
// Optional: LIMIT=50 to sweep a slice; CALL_BUDGET to cap (default 3000).

import { CARD_CATALOG, cardTier, getCatalogEntry } from "../lib/cards/catalog.ts";
import { getCardMetadata, type CardMetadata } from "../lib/cards/sdk.ts";
import { searchItems, getListingDetail } from "../lib/affiliate/ebay-browse.ts";
import { resolveVerifiedListingWith, type ResolveDeps, type ResolveTrace } from "../lib/listing/resolve.ts";

const CALL_BUDGET = Number(process.env.CALL_BUDGET ?? 3000);
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const CONCURRENCY = 5;

let calls = 0;
const eraBySlug = new Map<string, string>();

function eraFor(meta: CardMetadata): string {
  const y = Number((meta.releaseDate ?? "").slice(0, 4));
  if (!y) return "unknown";
  if (y <= 2003) return "vintage";
  if (y <= 2011) return "mid";
  return "modern";
}

const deps: ResolveDeps = {
  getCatalogEntry,
  getCardMetadata: async ({ id }) => getCardMetadata({ id }),
  search: async ({ query, limit, surface }) => { calls++; return searchItems({ query, limit, surface, awaitLog: true }); },
  getListingDetail: async ({ itemId, surface }) => { calls++; return getListingDetail({ itemId, surface, awaitLog: true }); },
};

type Row = { slug: string; era: string; trace: ResolveTrace; verified: boolean };

async function pool<T>(items: T[], n: number, fn: (t: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx], idx); }
  }));
}

async function main() {
  const curated = CARD_CATALOG.filter((e) => cardTier(e.slug) === "curated").slice(0, LIMIT);
  console.log(`Sweeping ${curated.length} curated cards · k=4 · ANY_RAW · budget ${CALL_BUDGET} calls`);
  const rows: Row[] = [];

  await pool(curated, CONCURRENCY, async (entry) => {
    if (calls >= CALL_BUDGET) return;
    // Capture era from metadata (one fetch; the resolver fetches its own too — SDK is 24h-cached).
    try { const m = await getCardMetadata({ id: entry.pokemonTcgId }); eraBySlug.set(entry.slug, eraFor(m)); } catch { eraBySlug.set(entry.slug, "unknown"); }
    const { listing, trace } = await resolveVerifiedListingWith(deps, entry.slug, "ANY_RAW", { surface: "manual" });
    rows.push({ slug: entry.slug, era: eraBySlug.get(entry.slug) ?? "unknown", trace, verified: !!listing });
  });

  // --- Aggregates ---
  const processed = rows.length;
  const verified = rows.filter((r) => r.verified).length;
  const coverage = processed ? ((verified / processed) * 100).toFixed(1) : "0";

  const nullReasons: Record<string, number> = {};
  for (const r of rows) if (!r.verified) nullReasons[r.trace.reason] = (nullReasons[r.trace.reason] ?? 0) + 1;

  // Per-gate: count present / pass / fail across ALL candidate evaluations.
  const gateStats: Record<string, { present: number; pass: number; fail: number; evals: number }> = {};
  // Per-era aspect presence (Set/Number/Finish/Language) across evaluated candidates.
  const eraPresence: Record<string, { n: number; set: number; number: number; finish: number; language: number }> = {};
  const rejects: Array<{ slug: string; era: string; title: string; gate: string; reason: string }> = [];

  for (const r of rows) {
    for (const c of r.trace.candidates) {
      const ep = (eraPresence[r.era] ??= { n: 0, set: 0, number: 0, finish: 0, language: 0 });
      ep.n++;
      for (const g of c.gates) {
        const gs = (gateStats[g.gate] ??= { present: 0, pass: 0, fail: 0, evals: 0 });
        gs.evals++;
        if (g.present) gs.present++;
        if (g.pass) gs.pass++; else gs.fail++;
        if (g.gate === "set" && g.present) ep.set++;
        if (g.gate === "number" && g.present) ep.number++;
        if (g.gate === "finish" && g.present) ep.finish++;
        if (g.gate === "language" && g.present) ep.language++;
      }
      if (c.verdict === "rejected") {
        const failing = c.gates.find((g) => !g.pass && g.hard);
        rejects.push({ slug: r.slug, era: r.era, title: c.itemId, gate: failing?.gate ?? "?", reason: failing?.reason ?? c.reason });
      }
    }
  }

  console.log(`\n=== SWEEP RESULT ===`);
  console.log(`processed ${processed} · verified ${verified} · null ${processed - verified} · COVERAGE ${coverage}% · calls used ${calls}`);
  console.log(`\nNULL reasons:`); for (const [k, v] of Object.entries(nullReasons).sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);
  console.log(`\nPER-GATE (present/pass/fail of evals):`);
  for (const [k, s] of Object.entries(gateStats)) console.log(`  ${k}: present ${s.present}/${s.evals} · pass ${s.pass} · fail ${s.fail}`);
  console.log(`\nPER-ERA aspect presence (of evaluated candidates):`);
  for (const [era, p] of Object.entries(eraPresence)) console.log(`  ${era} (n=${p.n}): Set ${p.set} · Number ${p.number} · Finish ${p.finish} · Language ${p.language}`);

  // Reject reason distribution (derived, for the report).
  const byGate: Record<string, number> = {};
  for (const r of rejects) byGate[r.gate] = (byGate[r.gate] ?? 0) + 1;
  console.log(`\nREJECT distribution by failing gate:`); for (const [k, v] of Object.entries(byGate).sort((a, b) => b[1] - a[1])) console.log(`  ${v}\t${k}`);

  // Rejects sample for the HAND AUDIT (stdout only — ephemeral, not committed).
  console.log(`\n=== REJECTS SAMPLE (audit these for false-rejects) ===`);
  for (const r of rejects.slice(0, 60)) console.log(`  [${r.era}] ${r.gate} | ${r.reason} | "${r.title.slice(0, 70)}" (${r.slug})`);
  console.log(`\nTOTAL rejects: ${rejects.length}`);
}

main().catch((e) => { console.error("SWEEP ERROR:", e.message); process.exit(1); });
