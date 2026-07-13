// Recent-set FULL coverage — every card of every recent English set
// (quality-bar-fixes, 2026-07-13; the data-source-spike's do-or-die fix).
//
// WHY: John's mandate — "We need every card, ESPECIALLY the new ones — new
// sets are always the most popular and get the most searches." The spike
// proved the gap is self-inflicted: pokemontcg.io had every Chaos Rising card
// since release day while foiltcg.com had ZERO cards from the three newest
// sets (541 cards across me2pt5/me3/me4), because catalog generation + the
// bake are manual. Top-5-per-set breadth (expand-top5-per-set.ts) is the
// right economy for a 2019 set; for a set released last quarter it's exactly
// backwards — the whole set is in demand.
//
// WHAT: for every EN set with a releaseDate inside RECENT_WINDOW_DAYS, emit a
// catalog entry for EVERY card in the set that isn't already in the catalog
// (tier "longtail": PokeTrace sold-history + affiliate CTA, no per-render
// eBay Browse call — same quota posture as the other generated tiers).
// Sets age OUT of the window naturally; their chase cards live on via the
// top-5 tier, so the catalog breathes instead of growing unboundedly.
//
// SELF-DEDUP RULE (bootstrapping): this script excludes ids already in
// CARD_CATALOG *minus its own previous output* — otherwise run N+1 would see
// its own run-N entries in the catalog and emit an empty file.
//
// OUTPUT (idempotent clean overwrite, deterministic order):
//   lib/cards/catalog-recent-sets.generated.ts (RECENT_SETS_CATALOG)
//
// Runs daily in .github/workflows/daily-catalog-bake.yml (autonomous commit
// to main; the workflow's guard tests are the review). Live proof contract:
// ME05 Pitch Black cards appear in the catalog automatically once
// pokemontcg.io ingests the set (releases 2026-07-17).
//
// Usage: npm run expand:recent-sets  [-- --window-days 420] [--dry-run]

import { writeFileSync } from "node:fs";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import { RECENT_SETS_CATALOG } from "../lib/cards/catalog-recent-sets.generated.ts";
import { slugifyName } from "../lib/poketrace/variant.ts";

const SDK_CARDS = "https://api.pokemontcg.io/v2/cards";
const SDK_SETS = "https://api.pokemontcg.io/v2/sets";
const PAGE_SIZE = 250;
const REQ_INTERVAL_MS = 250;
const OUT_TS = "lib/cards/catalog-recent-sets.generated.ts";

const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const WINDOW_DAYS = Number(arg("window-days") ?? 420);
const DRY_RUN = argv.includes("--dry-run");

// Same structural pins as expand-top5-per-set.ts (null-over-guess: a
// malformed SDK id/number is SKIPPED, never rewritten).
const ID_RE = /^[a-z0-9]+(?:pt[0-9]+)?-[a-zA-Z0-9]+$/;
const SLUG_RE = /^[a-z0-9]+(?:pt[0-9]+)?-[a-z0-9]+-[a-z0-9-]+$/;

type SdkSet = { id: string; name: string; releaseDate?: string; total?: number };
type SdkCard = { id: string; name: string; number: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, attempts = 4): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "foiltcg-catalog-bake/1.0" } });
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) return null;
    } catch {
      // retry
    }
    await sleep(500 * (i + 1));
  }
  return null;
}

function parseReleaseDate(s: string | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s.replace(/\//g, "-"));
  return Number.isFinite(t) ? t : null;
}

async function main(): Promise<void> {
  // Ids already covered elsewhere in the catalog (curated / longtail / top5 /
  // eeveelutions) — minus this script's own previous output (self-dedup rule).
  const ownIds = new Set(RECENT_SETS_CATALOG.map((e) => e.pokemonTcgId));
  const takenIds = new Set(
    CARD_CATALOG.filter((e) => !ownIds.has(e.pokemonTcgId)).map((e) => e.pokemonTcgId),
  );
  const takenSlugs = new Set(
    CARD_CATALOG.filter((e) => !ownIds.has(e.pokemonTcgId)).map((e) => e.slug),
  );

  const setsRes = await fetchJson<{ data: SdkSet[] }>(`${SDK_SETS}?pageSize=${PAGE_SIZE}`);
  if (!setsRes?.data?.length) {
    console.error("FATAL: could not fetch the set list — keeping the existing generated file.");
    process.exitCode = 1;
    return;
  }

  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
  const recent = setsRes.data
    .filter((s) => {
      const t = parseReleaseDate(s.releaseDate);
      return t !== null && t >= cutoff;
    })
    .sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate)));

  console.log(`recent window: ${WINDOW_DAYS}d → ${recent.length} sets: ${recent.map((s) => s.id).join(", ")}`);

  const entries: Array<{ pokemonTcgId: string; slug: string; setId: string; setName: string }> = [];
  let skippedTaken = 0;
  let skippedMalformed = 0;

  for (const set of recent) {
    let page = 1;
    for (;;) {
      const res = await fetchJson<{ data: SdkCard[]; totalCount: number }>(
        `${SDK_CARDS}?q=${encodeURIComponent(`set.id:${set.id}`)}&page=${page}&pageSize=${PAGE_SIZE}&select=id,name,number`,
      );
      await sleep(REQ_INTERVAL_MS);
      if (!res?.data) break;
      for (const card of res.data) {
        if (!ID_RE.test(card.id)) { skippedMalformed++; continue; }
        // Internal consistency (null-over-guess): the id's number segment
        // must equal the printed number, or the record contradicts itself
        // (live example: zsv10pt5-80 carries number "60" upstream). A card
        // whose identity we can't trust is skipped, never repaired.
        const idNum = card.id.slice(set.id.length + 1);
        if (idNum.toLowerCase() !== String(card.number).toLowerCase()) { skippedMalformed++; continue; }
        if (takenIds.has(card.id)) { skippedTaken++; continue; }
        const numSlug = String(card.number).toLowerCase().replace(/[^a-z0-9]+/g, "");
        const slug = `${set.id}-${numSlug}-${slugifyName(card.name)}`;
        if (!SLUG_RE.test(slug) || takenSlugs.has(slug)) { skippedMalformed++; continue; }
        takenSlugs.add(slug);
        entries.push({ pokemonTcgId: card.id, slug, setId: set.id, setName: set.name });
      }
      if (res.data.length < PAGE_SIZE) break;
      page++;
    }
  }

  // Deterministic order: set release order, then numeric-aware id order —
  // reruns with unchanged upstream produce a byte-identical file (no churn
  // commits from the daily workflow).
  entries.sort((a, b) =>
    a.setId === b.setId
      ? a.pokemonTcgId.localeCompare(b.pokemonTcgId, undefined, { numeric: true })
      : 0,
  );

  const bySet = new Map<string, number>();
  for (const e of entries) bySet.set(e.setName, (bySet.get(e.setName) ?? 0) + 1);
  console.log(`entries: ${entries.length} (skipped: ${skippedTaken} already-cataloged, ${skippedMalformed} malformed)`);
  for (const [name, n] of bySet) console.log(`  ${name}: ${n}`);

  if (DRY_RUN) { console.log("(dry run — nothing written)"); return; }

  // A FAILED or empty fetch must never wipe real coverage: refuse to shrink
  // the file below half its previous size (upstream outages return partial
  // pages; the next daily run heals forward).
  if (entries.length < RECENT_SETS_CATALOG.length / 2 && RECENT_SETS_CATALOG.length > 0) {
    console.error(
      `REFUSING to shrink: previous run had ${RECENT_SETS_CATALOG.length} entries, this run found ${entries.length}. Upstream looks unhealthy.`,
    );
    process.exitCode = 1;
    return;
  }

  const lines = entries.map(
    (e) => `  { pokemonTcgId: ${JSON.stringify(e.pokemonTcgId)}, slug: ${JSON.stringify(e.slug)}, tier: "longtail" },`,
  );
  const body = `// GENERATED by scripts/expand-recent-sets.ts — do not hand-edit.
// Full coverage of every EN set released within the last ${WINDOW_DAYS} days
// (quality-bar-fixes, 2026-07-13). Regenerated daily by
// .github/workflows/daily-catalog-bake.yml; entries age out as sets leave
// the window (their chase cards persist via catalog-top5-per-set).

import type { CatalogEntry } from "./catalog.ts";

export const RECENT_SETS_CATALOG: readonly CatalogEntry[] = [
${lines.join("\n")}
];
`;
  writeFileSync(OUT_TS, body);
  console.log(`wrote ${OUT_TS} (${entries.length} entries)`);
}

await main();
