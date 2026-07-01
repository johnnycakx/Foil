// Catalog breadth expansion — every English set's top-5-most-valuable cards
// (Session — catalog-expansion-top5-per-set goal; extends ADR-046).
//
// WHY: the wave-1 long-tail (scripts/rank-candidate-cards.ts + expand-catalog.ts,
// ADR-046) added DEPTH — ~980 cards, but only across the 29 sets already in
// CARD_CATALOG. The root cause of the content engine surfacing obscure movers
// was that whole sets are MISSING from the catalog (John, 2026-06-30). This
// script adds BREADTH: for EVERY English set the Pokemon TCG SDK knows about
// (~173), it takes that set's top-5 cards by market value and adds the ones not
// already in the catalog. The most-valuable cards in a set ARE its chase cards
// (alt arts, special-illustration rares, gold/rainbow secrets), so ranking by
// value is a clean, automatable proxy for "desirable".
//
// RANKING SOURCE: the SDK's own inline TCGplayer price (max market/high across a
// card's variants) — same choice as ADR-046. Cheap (one query per set), no
// PokeTrace hammering (which is rate-limited + on a renewal clock). Every ranked
// card therefore has a TCGplayer price by construction, so its /cards/[slug]
// page renders real pricing (AggregateOffer + variants) even before any
// PokeTrace sold-history is baked.
//
// LAZY POKETRACE (goal boundary): this script does NOT call PokeTrace. New cards
// enter the catalog with SDK price only (tier "longtail" → SoldHistoryPanel shows
// "not yet available" until a card is actually surfaced, at which point the
// market-card engine resolves PokeTrace on-demand). No bulk PokeTrace by design.
//
// OUTPUT (idempotent — a clean overwrite each run, like expand-catalog.ts):
//   - lib/cards/catalog-top5-per-set.generated.ts (TOP5_PER_SET_CATALOG, spread
//     into CARD_CATALOG in catalog.ts, tier "longtail")
//   - docs/top5-per-set-ranked-YYYY-MM-DD.json (audit trail + measurement source)
//
// Usage: npm run expand:top5-per-set  [-- --per-set 5] [--sets a,b,c] [--dry-run]

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import { slugifyName } from "../lib/poketrace/variant.ts";

const SDK_CARDS = "https://api.pokemontcg.io/v2/cards";
const SDK_SETS = "https://api.pokemontcg.io/v2/sets";
const REQ_INTERVAL_MS = 250;
const PAGE_SIZE = 250;
// Concurrent set fetches. ~200 total requests for the full run stays well under
// the keyless pokemontcg.io rate limit; 8 overlaps the flaky-API timeouts.
const FETCH_CONCURRENCY = 8;

const OUT_TS = "lib/cards/catalog-top5-per-set.generated.ts";

const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}
const PER_SET = Number(arg("per-set") ?? 5);
const ONLY_SETS = arg("sets")?.split(",").map((s) => s.trim()).filter(Boolean);
const DRY_RUN = argv.includes("--dry-run");

// The catalog's own structural pins (lib/__tests__/catalog.test.ts). We validate
// against them here so a malformed SDK id/number can never enter the catalog —
// we SKIP it (null-over-guess), never rewrite it.
const ID_RE = /^[a-z0-9]+(?:pt[0-9]+)?-[a-zA-Z0-9]+$/;
const SLUG_RE = /^[a-z0-9]+(?:pt[0-9]+)?-[a-z0-9]+-[a-z0-9-]+$/;

type SdkCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  tcgplayer?: { prices?: Record<string, { market?: number | null; high?: number | null }> };
};

type Candidate = {
  pokemonTcgId: string;
  slug: string;
  name: string;
  setId: string;
  number: string;
  rarity: string;
  score: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Best (max) TCGplayer market/high across a card's variants. 0 when absent. */
function priceScore(card: SdkCard): number {
  let best = 0;
  for (const p of Object.values(card.tcgplayer?.prices ?? {})) {
    const v =
      (typeof p.market === "number" ? p.market : null) ??
      (typeof p.high === "number" ? p.high : null);
    if (typeof v === "number" && v > best) best = v;
  }
  return best;
}

const REQ_TIMEOUT_MS = 15_000;
// Generous budget: pokemontcg.io flaps between healthy + timing-out under load.
// 7 attempts spanning ~1min of backoff lets each set's fetch ride out a degraded
// patch and catch a healthy window rather than tripping the coverage abort-guard.
const RETRY_DELAYS_MS = [500, 1500, 4000, 8000, 12_000, 20_000];

/** Fetch JSON with a per-request timeout + retry-on-failure. pokemontcg.io is
 *  intermittently slow/5xx under load; retrying a set's fetch (rather than
 *  letting it silently contribute 0 cards) keeps the "every set gets its top-5"
 *  coverage honest. Returns null only after all attempts fail. */
async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) {
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        console.warn(`  SDK ${res.status} on ${url} (gave up after ${attempt + 1} tries)`);
        return null;
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      clearTimeout(timer);
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      console.warn(`  SDK fetch failed on ${url}: ${(err as Error).message} (gave up after ${attempt + 1} tries)`);
      return null;
    }
  }
  return null;
}

async function fetchAllSetIds(): Promise<string[]> {
  const json = await fetchJson(`${SDK_SETS}?pageSize=${PAGE_SIZE}&select=id,name,series`);
  const data = (json?.data as Array<{ id?: string }> | undefined) ?? [];
  return data.map((s) => s.id).filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Fetch a set's cards. `failed` is true when the FIRST page's fetch fails
 *  after all retries — a genuine API failure (distinct from a real empty set),
 *  so main() can flag incomplete coverage instead of silently treating the set
 *  as "0 priced cards" and dropping its top-5. */
async function fetchSetCards(setId: string): Promise<{ cards: SdkCard[]; failed: boolean }> {
  const out: SdkCard[] = [];
  for (let page = 1; ; page++) {
    const url =
      `${SDK_CARDS}?q=${encodeURIComponent(`set.id:${setId}`)}` +
      `&pageSize=${PAGE_SIZE}&page=${page}&select=id,name,number,rarity,tcgplayer`;
    const json = await fetchJson(url);
    if (!json) {
      // Page-1 failure = the whole set is unreadable; later-page failure means
      // we have a partial set. Either way, flag it so coverage isn't over-claimed.
      return { cards: out, failed: true };
    }
    const data = (json.data as SdkCard[] | undefined) ?? [];
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    await sleep(REQ_INTERVAL_MS);
  }
  return { cards: out, failed: false };
}

/** Build a catalog candidate from an SDK card, or null if it can't be
 *  represented without fabricating (bad id/number/name shape). */
function toCandidate(card: SdkCard, setId: string, score: number): Candidate | null {
  if (!ID_RE.test(card.id)) return null;
  const numSlug = String(card.number ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const nameSlug = slugifyName(card.name);
  if (!numSlug || !nameSlug) return null;
  const slug = `${setId}-${numSlug}-${nameSlug}`;
  if (!SLUG_RE.test(slug)) return null;
  return {
    pokemonTcgId: card.id,
    slug,
    name: card.name,
    setId,
    number: card.number,
    rarity: card.rarity ?? "",
    score: Math.round(score * 100) / 100,
  };
}

async function main(): Promise<void> {
  // Dedup against the ENTIRE existing catalog (curated + wave-1 long-tail). We
  // never drop a live /cards/[slug] URL — this expansion is purely additive.
  const existingIds = new Set(CARD_CATALOG.map((c) => c.pokemonTcgId));
  const existingSlugs = new Set(CARD_CATALOG.map((c) => c.slug));

  const allSetIds = ONLY_SETS ?? (await fetchAllSetIds());
  if (allSetIds.length === 0) throw new Error("No sets returned from the SDK — aborting (no fabrication).");
  console.log(`Scanning ${allSetIds.length} English sets for top-${PER_SET}-by-value…`);
  console.log(`Deduping against ${existingIds.size} cards already in CARD_CATALOG.\n`);

  const picked: Candidate[] = [];
  const seenSlug = new Set<string>();
  const seenId = new Set<string>();

  let setsWithFive = 0;
  let setsUnderFive = 0;
  let setsZero = 0;
  const perSetAdded: Record<string, number> = {};
  const failedSets: string[] = [];

  // --- Fetch phase (CONCURRENT) --------------------------------------------
  // pokemontcg.io flaps between healthy + timing-out under load; sequential
  // fetching serializes every 15s timeout, which is punishingly slow on a bad
  // day. A worker pool overlaps the waits (and lets a healthy blip drain many
  // sets at once) while staying well under the keyless rate limit (~200 total
  // requests). Fetch results are keyed by setId; the PROCESS phase below runs
  // sequentially in the original set order so dedup stays deterministic.
  const fetched = new Map<string, { cards: SdkCard[]; failed: boolean }>();
  let nextIdx = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = nextIdx++;
      if (idx >= allSetIds.length) return;
      const setId = allSetIds[idx];
      const res = await fetchSetCards(setId);
      fetched.set(setId, res);
      done++;
      console.log(`  fetched [${done}/${allSetIds.length}] ${setId} — ${res.cards.length} cards${res.failed ? " (FETCH FAILED)" : ""}`);
    }
  }
  await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, () => worker()));

  // --- Retry-failed-sets pass ----------------------------------------------
  // A flaky API can transiently fail a set even after the per-request retries.
  // Re-fetch failed sets SEQUENTIALLY (gentler on a struggling API), up to a few
  // rounds, before giving up — so one bad-window blip doesn't trip the coverage
  // abort-guard on an otherwise-complete run. Only sets that fail EVERY round
  // remain failed and abort the write.
  const RETRY_ROUNDS = 4;
  for (let round = 1; round <= RETRY_ROUNDS; round++) {
    const stillFailed = [...fetched.entries()].filter(([, r]) => r.failed).map(([id]) => id);
    if (stillFailed.length === 0) break;
    console.log(`  retry round ${round}/${RETRY_ROUNDS}: ${stillFailed.length} failed set(s): ${stillFailed.join(", ")}`);
    await sleep(5000); // let the API breathe between rounds
    for (const setId of stillFailed) {
      const res = await fetchSetCards(setId);
      fetched.set(setId, res);
      if (!res.failed) console.log(`    recovered ${setId} — ${res.cards.length} cards`);
      await sleep(REQ_INTERVAL_MS);
    }
  }

  // --- Process phase (SEQUENTIAL, original order — deterministic dedup) -----
  for (const setId of allSetIds) {
    const { cards, failed } = fetched.get(setId) ?? { cards: [], failed: true };
    if (failed) failedSets.push(setId);
    // Rank the WHOLE set by value, then take the top-N. Dedup against the
    // existing catalog happens AFTER the top-N slice, so a set whose top cards
    // are already curated contributes only its net-new top-N tail (≤ PER_SET).
    const ranked = cards
      .map((c) => ({ c, score: priceScore(c) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, PER_SET);

    let addedThisSet = 0;
    for (const { c, score } of ranked) {
      if (existingIds.has(c.id) || existingSlugs.has(c.slug ?? "")) continue;
      const cand = toCandidate(c, setId, score);
      if (!cand) continue;
      if (existingSlugs.has(cand.slug) || existingIds.has(cand.pokemonTcgId)) continue;
      if (seenSlug.has(cand.slug) || seenId.has(cand.pokemonTcgId)) continue;
      seenSlug.add(cand.slug);
      seenId.add(cand.pokemonTcgId);
      picked.push(cand);
      addedThisSet++;
    }
    perSetAdded[setId] = addedThisSet;

    // Coverage classification is about the set's own top-N by value (does the
    // SDK price ≥5 cards in this set), independent of prior catalog overlap.
    const pricedTopN = ranked.length;
    if (pricedTopN >= PER_SET) setsWithFive++;
    else if (pricedTopN > 0) setsUnderFive++;
    else setsZero++;
  }

  picked.sort((a, b) => b.score - a.score);

  const date = new Date().toISOString().slice(0, 10);
  const auditPath = join("docs", `top5-per-set-ranked-${date}.json`);

  const setsContributing = Object.values(perSetAdded).filter((n) => n > 0).length;

  // Refuse to ship an incomplete result: if any set's fetch failed (API
  // degradation), the "every set gets its top-5" coverage claim would be false.
  // Abort WITHOUT writing so a partial file never overwrites a good one — re-run
  // when the API is healthy (idempotent), or fill just the gaps with
  // `--sets ${failedSets.join(",")}`. Coverage integrity over partial progress.
  if (failedSets.length > 0 && !ONLY_SETS) {
    console.error("");
    console.error(`ABORT — ${failedSets.length} set(s) failed to fetch (API degraded): ${failedSets.join(", ")}`);
    console.error("No files written. Re-run when the SDK is healthy (idempotent overwrite).");
    process.exit(2);
  }

  if (!DRY_RUN) {
    writeFileSync(join(process.cwd(), auditPath), JSON.stringify(picked, null, 2), "utf8");

    const body =
      `// GENERATED FILE — do not edit by hand.\n` +
      `// Written by scripts/expand-top5-per-set.ts (catalog breadth expansion,\n` +
      `// extends ADR-046). Holds every English set's top-${PER_SET}-by-value cards not\n` +
      `// already in the curated catalog or the wave-1 long-tail — tier "longtail",\n` +
      `// spread into CARD_CATALOG in catalog.ts. SDK TCGplayer price is the rank\n` +
      `// source; PokeTrace stays LAZY (no bulk baking). Regenerate with:\n` +
      `//   npm run expand:top5-per-set\n` +
      `// Source: pokemontcg.io — ${picked.length} entries across ${setsContributing} sets, generated ${new Date().toISOString()}.\n\n` +
      `import type { CatalogEntry } from "./catalog.ts";\n\n` +
      `export const TOP5_PER_SET_CATALOG: readonly CatalogEntry[] = [\n` +
      picked
        .map(
          (c) =>
            `  { pokemonTcgId: ${JSON.stringify(c.pokemonTcgId)}, slug: ${JSON.stringify(c.slug)}, tier: "longtail" },`,
        )
        .join("\n") +
      `\n];\n`;

    writeFileSync(join(process.cwd(), OUT_TS), body, "utf8");
  }

  console.log("");
  console.log(DRY_RUN ? "[dry-run — no files written]" : `Wrote ${OUT_TS}`);
  if (!DRY_RUN) console.log(`Wrote ${auditPath}`);
  console.log(`  sets scanned:            ${allSetIds.length}`);
  console.log(`  sets w/ ≥${PER_SET} priced cards:  ${setsWithFive}`);
  console.log(`  sets w/ 1–${PER_SET - 1} priced cards: ${setsUnderFive}`);
  console.log(`  sets w/ 0 priced cards:  ${setsZero}`);
  if (failedSets.length > 0) console.log(`  sets FAILED to fetch:    ${failedSets.length} (${failedSets.join(", ")})`);
  console.log(`  sets contributing net-new: ${setsContributing}`);
  console.log(`  net-new cards added:     ${picked.length}`);
  console.log(`  score range:             $${picked[picked.length - 1]?.score ?? 0} … $${picked[0]?.score ?? 0}`);
}

main().catch((err) => {
  console.error("expand-top5-per-set failed:", err);
  process.exit(1);
});
