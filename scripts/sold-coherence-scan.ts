// Sold-data coherence scan (sold-data-integrity goal, 2026-07-03).
//
// Measures the RATE of the xy4-122 failure classes across the cards traffic
// actually lands on: the hero-belt pool (200) ∪ the curated catalog set. For
// each card's default variant it computes:
//
//   BEFORE (what the pre-fix panel rendered):
//     (a) pooled "any-raw" headline (saleCount-weighted avg30d??avg across
//         mixed tiers/sources) vs the baked TCGplayer market anchor — ratio
//     (b) non-monotonic displayed ladder (avg30d ?? avg, mixed-source)
//     (c) fabricated-window fraction: share of the pooled "n sales" coming
//         from tiers with NO fresh windowed data (the "63 sales" lie)
//     (d) cross-source same-tier divergence on displayed values
//
//   AFTER (what lib/cards/sold-coherence.ts now allows):
//     suppression verdict + reasons, and the post-fix headline.
//
// Output: docs/goals/_results/sold-coherence-scan.md (+ .json). Raw PokeTrace
// payloads are cached under the scratch dir passed via --cache so re-runs
// (threshold calibration) cost zero quota.
//
// Run: node --env-file=.env.local --experimental-strip-types scripts/sold-coherence-scan.ts [--from-cache] [--cache <dir>]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSoldHistory, type SoldHistory, type SoldStat, type SoldSource } from "../lib/poketrace/by-uuid.ts";
import { CARD_CATALOG, cardTier } from "../lib/cards/catalog.ts";
import {
  resolveSoldPanel,
  ladderViolations,
  crossSourceViolations,
  freshWindowedValue,
  describeViolations,
  SOLD_SOURCES,
} from "../lib/cards/sold-coherence.ts";
import { RAW_POKETRACE_TIERS } from "../lib/cards/conditions.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = "https://api.poketrace.com/v1";

type BakedVariant = { variantKey: string; poketraceId: string };
type BakedCard = {
  id: string;
  name: string;
  variants?: BakedVariant[];
  tcgplayerPrices?: Record<string, { market: number | null } | undefined>;
};

function loadUniverse(): { slugToCard: Map<string, BakedCard>; slugs: string[] } {
  const baked = JSON.parse(readFileSync(join(ROOT, "lib/cards/baked-metadata.json"), "utf8")) as {
    cards: Record<string, BakedCard>;
  };
  const belt = JSON.parse(readFileSync(join(ROOT, "lib/hero-belt/pool.generated.json"), "utf8")) as {
    cards: Array<{ slug: string }>;
  };
  const slugs = new Set<string>();
  // Belt slugs are catalog slugs ("neo4-113-shining-tyranitar"); baked keys are
  // pokemonTcgIds ("neo4-113"). Map via CARD_CATALOG.
  const catalogBySlug = new Map(CARD_CATALOG.map((e) => [e.slug, e.pokemonTcgId]));
  const slugToCard = new Map<string, BakedCard>();
  for (const b of belt.cards) slugs.add(b.slug);
  for (const e of CARD_CATALOG) {
    if (cardTier(e.slug) === "curated") slugs.add(e.slug);
  }
  for (const slug of slugs) {
    const id = catalogBySlug.get(slug);
    const card = id ? baked.cards[id] : undefined;
    if (card && (card.variants?.length ?? 0) > 0) slugToCard.set(slug, card);
  }
  return { slugToCard, slugs: [...slugs] };
}

// --- BEFORE mirrors (the pre-fix panel logic, kept verbatim for measurement) ---

function statForBefore(history: SoldHistory | null, tier: string): SoldStat | null {
  if (!history) return null;
  for (const src of SOLD_SOURCES) {
    const s = history.bySource[src]?.[tier];
    if (s) return s;
  }
  return null;
}

function pooledBefore(history: SoldHistory | null): { avg: number | null; n: number } {
  const stats = RAW_POKETRACE_TIERS.map((t) => statForBefore(history, t)).filter((s): s is SoldStat => s != null);
  const weight = (s: SoldStat) => (s.saleCount && s.saleCount > 0 ? s.saleCount : 0);
  const totalW = stats.reduce((a, s) => a + weight(s), 0);
  let num = 0;
  let den = 0;
  for (const s of stats) {
    const v = s.avg30d ?? s.avg;
    if (v == null) continue;
    const w = totalW > 0 ? weight(s) : 1;
    num += v * w;
    den += w;
  }
  return { avg: den > 0 ? num / den : null, n: stats.reduce((a, s) => a + (s.saleCount ?? 0), 0) };
}

function tradedScore(history: SoldHistory | null): number {
  if (!history) return 0;
  let score = 0;
  for (const src of SOLD_SOURCES) {
    const tiers = history.bySource[src];
    if (!tiers) continue;
    for (const s of Object.values(tiers)) score += (s.saleCount ?? 0) * (s.avg30d ?? s.avg ?? 0);
  }
  return score;
}

async function fetchHistory(uuid: string, cacheDir: string, fromCache: boolean, apiKey: string): Promise<SoldHistory | null> {
  const cachePath = join(cacheDir, `${uuid}.json`);
  if (existsSync(cachePath)) {
    return parseSoldHistory(uuid, JSON.parse(readFileSync(cachePath, "utf8")));
  }
  if (fromCache) return null;
  const res = await fetch(`${BASE_URL}/cards/${encodeURIComponent(uuid)}?market=US`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: unknown };
  const card = json?.data ?? null;
  writeFileSync(cachePath, JSON.stringify(card));
  return parseSoldHistory(uuid, card);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  const fromCache = args.includes("--from-cache");
  const cacheIdx = args.indexOf("--cache");
  const cacheDir = cacheIdx >= 0 ? args[cacheIdx + 1] : join(ROOT, ".sold-scan-cache");
  mkdirSync(cacheDir, { recursive: true });
  const apiKey = process.env.POKETRACE_API_KEY ?? "";
  if (!apiKey && !fromCache) {
    console.error("POKETRACE_API_KEY missing (use --env-file=.env.local) and not --from-cache");
    process.exit(1);
  }

  const { slugToCard, slugs } = loadUniverse();
  console.log(`universe: ${slugs.length} slugs, ${slugToCard.size} with baked variants`);

  const nowMs = Date.now();
  type Row = {
    slug: string;
    name: string;
    variantKey: string;
    anchor: number | null;
    beforePooledAvg: number | null;
    beforePooledN: number;
    beforeAnchorRatio: number | null;
    beforeLadderViolations: number;
    beforeStaleNFraction: number | null;
    beforeCrossSourceMaxRatio: number | null;
    afterSuppressed: boolean;
    afterDisputedTiers: string[];
    afterReasons: string;
    afterHeadlineTier: string | null;
    afterHeadlineValue: number | null;
  };
  const results: Row[] = [];
  let fetched = 0;
  let noData = 0;

  for (const [slug, card] of slugToCard) {
    const variants = card.variants ?? [];
    const histories: Array<{ variantKey: string; history: SoldHistory | null }> = [];
    for (const v of variants) {
      const h = await fetchHistory(v.poketraceId, cacheDir, fromCache, apiKey);
      if (h && !fromCache) {
        fetched++;
        if (fetched % 25 === 0) console.log(`fetched ${fetched}…`);
        await sleep(400); // 30 req/10s burst ceiling
      }
      histories.push({ variantKey: v.variantKey, history: h });
    }
    const ranked = [...histories].sort((a, b) => tradedScore(b.history) - tradedScore(a.history));
    const sel = ranked[0];
    if (!sel?.history || Object.keys(sel.history.bySource).length === 0) {
      noData++;
      continue;
    }
    const h = sel.history;

    // Anchor: baked TCGplayer market for the selected variant, else max market.
    const prices = card.tcgplayerPrices ?? {};
    const variantMarket = prices[sel.variantKey]?.market ?? null;
    const maxMarket = Math.max(0, ...Object.values(prices).map((p) => p?.market ?? 0));
    const anchor = variantMarket ?? (maxMarket > 0 ? maxMarket : null);

    // BEFORE
    const pooled = pooledBefore(h);
    const displayed: Array<{ tier: string; v: number }> = [];
    for (const t of RAW_POKETRACE_TIERS) {
      const s = statForBefore(h, t);
      const v = s ? (s.avg30d ?? s.avg) : null;
      if (v != null && v > 0) displayed.push({ tier: t, v });
    }
    let beforeLadder = 0;
    for (let i = 0; i < displayed.length; i++)
      for (let j = i + 1; j < displayed.length; j++)
        if (displayed[j].v > displayed[i].v * 1.0) beforeLadder++; // ANY inversion (measurement, no tolerance)
    let staleN = 0;
    for (const t of RAW_POKETRACE_TIERS) {
      const s = statForBefore(h, t);
      if (!s) continue;
      if (freshWindowedValue(s, nowMs) == null) staleN += s.saleCount ?? 0;
    }
    let crossMax: number | null = null;
    for (const t of RAW_POKETRACE_TIERS) {
      const vals: number[] = [];
      for (const src of SOLD_SOURCES) {
        const s = h.bySource[src]?.[t];
        const v = s ? (s.avg30d ?? s.avg) : null;
        if (v != null && v > 0) vals.push(v);
      }
      if (vals.length >= 2) {
        const r = Math.max(...vals) / Math.min(...vals);
        crossMax = crossMax == null ? r : Math.max(crossMax, r);
      }
    }

    // AFTER
    const model = resolveSoldPanel(h, { kind: "raw-agg" }, nowMs);

    results.push({
      slug,
      name: card.name,
      variantKey: sel.variantKey,
      anchor,
      beforePooledAvg: pooled.avg,
      beforePooledN: pooled.n,
      beforeAnchorRatio: pooled.avg != null && anchor ? pooled.avg / anchor : null,
      beforeLadderViolations: beforeLadder,
      beforeStaleNFraction: pooled.n > 0 ? staleN / pooled.n : null,
      beforeCrossSourceMaxRatio: crossMax,
      afterSuppressed: model.suppressed,
      afterDisputedTiers: model.disputedTiers,
      afterReasons: describeViolations(model.violations),
      afterHeadlineTier: model.headline?.tierKey ?? null,
      afterHeadlineValue: model.headline?.value ?? null,
    });
  }

  // --- summarize ---
  const n = results.length;
  const pct = (k: number) => `${k}/${n} (${((100 * k) / Math.max(1, n)).toFixed(1)}%)`;
  const divergent = results.filter((r) => r.beforeAnchorRatio != null && (r.beforeAnchorRatio < 0.5 || r.beforeAnchorRatio > 2));
  const ladder = results.filter((r) => r.beforeLadderViolations > 0);
  const fabricated = results.filter((r) => (r.beforeStaleNFraction ?? 0) >= 0.5);
  const cross = results.filter((r) => (r.beforeCrossSourceMaxRatio ?? 1) > 2);
  const suppressed = results.filter((r) => r.afterSuppressed);
  const disputed = results.filter((r) => r.afterDisputedTiers.length > 0);
  const headlined = results.filter((r) => !r.afterSuppressed && r.afterHeadlineValue != null);

  const dist = (vals: number[]) => {
    if (vals.length === 0) return "n/a";
    const s = [...vals].sort((a, b) => a - b);
    const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return `p50=${q(0.5).toFixed(2)} p90=${q(0.9).toFixed(2)} p99=${q(0.99).toFixed(2)} max=${s[s.length - 1].toFixed(2)}`;
  };

  const lines: string[] = [];
  lines.push(`# Sold-data coherence scan — ${new Date(nowMs).toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`Universe: belt pool ∪ curated catalog = ${slugs.length} slugs; ${slugToCard.size} with baked variants; ${n} with sold data (${noData} no-data).`);
  lines.push("");
  lines.push("## BEFORE (pre-fix render) failure rates");
  lines.push(`- (a) pooled raw avg diverges >2x from TCGplayer market anchor: ${pct(divergent.length)}`);
  lines.push(`- (b) non-monotonic displayed ladder (any inversion): ${pct(ladder.length)}`);
  lines.push(`- (c) fabricated-window n (≥50% of "n sales" from tiers with no fresh window): ${pct(fabricated.length)}`);
  lines.push(`- (d) cross-source same-tier displayed divergence >2x: ${pct(cross.length)}`);
  lines.push("");
  lines.push("## Distributions (for threshold calibration)");
  lines.push(`- anchor ratio (pooled/market): ${dist(results.map((r) => r.beforeAnchorRatio).filter((v): v is number => v != null))}`);
  lines.push(`- stale-n fraction: ${dist(results.map((r) => r.beforeStaleNFraction).filter((v): v is number => v != null))}`);
  lines.push(`- cross-source max ratio: ${dist(results.map((r) => r.beforeCrossSourceMaxRatio).filter((v): v is number => v != null))}`);
  lines.push("");
  lines.push("## AFTER (post-fix resolver)");
  lines.push(`- fully suppressed by the ladder gate: ${pct(suppressed.length)}`);
  lines.push(`- cross-source disputed tier(s) dropped (panel otherwise stands): ${pct(disputed.length)}`);
  lines.push(`- renders a fresh windowed headline: ${pct(headlined.length)}`);
  lines.push(`- degrades to last-sale/no-headline (honest): ${pct(n - headlined.length - suppressed.length)}`);
  lines.push("");
  if (suppressed.length > 0) {
    lines.push("### Fully suppressed cards (ladder incoherence)");
    for (const r of suppressed) lines.push(`- ${r.slug}: ${r.afterReasons}`);
    lines.push("");
  }
  if (disputed.length > 0) {
    lines.push("### Tier-dropped cards (cross-source dispute)");
    for (const r of disputed) lines.push(`- ${r.slug}: dropped ${r.afterDisputedTiers.join(", ")}`);
    lines.push("");
  }
  lines.push("### Worst BEFORE offenders (anchor ratio)");
  for (const r of [...divergent].sort((a, b) => Math.abs(Math.log((a.beforeAnchorRatio ?? 1))) < Math.abs(Math.log((b.beforeAnchorRatio ?? 1))) ? 1 : -1).slice(0, 15)) {
    lines.push(`- ${r.slug}: pooled $${r.beforePooledAvg?.toFixed(0)} vs market $${r.anchor?.toFixed(0)} (${r.beforeAnchorRatio?.toFixed(2)}x), n=${r.beforePooledN}, staleN=${((r.beforeStaleNFraction ?? 0) * 100).toFixed(0)}%`);
  }

  const outDir = join(ROOT, "docs/goals/_results");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "sold-coherence-scan.md"), lines.join("\n") + "\n");
  writeFileSync(join(outDir, "sold-coherence-scan.json"), JSON.stringify(results, null, 1));
  console.log(lines.join("\n"));
  console.log(`\nwrote docs/goals/_results/sold-coherence-scan.{md,json}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
