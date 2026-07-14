// Bake Pokemon TCG SDK catalog metadata to a repo-committed JSON snapshot
// (Session 40 amendment).
//
// Why: pokemontcg.io is intermittently 5xx/4xx-ing under load (verified
// across multiple Session-40 deploys). When the upstream is broken
// during a build, /cards/sets/[set-id] bakes with fallback records and
// stays broken for the full ISR window. Even runtime calls like
// /api/cards/search can return empty hits during outages.
//
// This script grabs a snapshot of every catalog card + set's metadata
// when upstream IS healthy, writes it to lib/cards/baked-metadata.json,
// and the SDK uses it as a fallback when upstream fails. Re-run this
// script whenever the catalog grows or whenever you want to refresh
// the snapshot.
//
// Usage: `npm run bake:cards`
//
// The script:
//   1. Loads CARD_CATALOG (200 entries today).
//   2. Fetches each card from api.pokemontcg.io with retry-on-5xx/4xx
//      and a generous per-card budget (~10s).
//   3. Fetches the full /v2/sets?pageSize=250 collection in one call.
//   4. Writes lib/cards/baked-metadata.json with shape:
//        { bakedAt: ISO, cards: Record<id, CardMetadata>, sets: Record<id, SetMetadata> }
//   5. Reports coverage: N cards baked, M failed (logged inline; not fatal).
//
// Soft-fail: if upstream is broken for an ID, we log and skip — the
// existing JSON's prior entry is preserved (no destructive overwrite of
// previously-baked data when the new bake hits an outage).

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
// parseCard comes from the SDK — the ONE card parser (perf-and-data-foundation,
// 2026-07-01). This script previously carried a stale 8-field duplicate that
// silently dropped tcgplayerPrices + every reference-data field from every
// snapshot ever committed (tsconfig excluded scripts/, so tsc never saw the
// shape mismatch). Do not re-inline a parser here.
import { parseCard, type CardMetadata, type RawCard, type SetMetadata } from "../lib/cards/sdk.ts";
import { overlayFreshMetadata, overlayListedPrices } from "../lib/cards/bake-merge.ts";
import { createBakeCheckpoint } from "./bake-checkpoint.ts";

const STATE_PATH = ".bake-cards-state.json";
const RESUME = process.argv.includes("--resume");
// --only-missing: skip cards already present in the loaded snapshot (their SDK
// metadata is stable + already baked, and their PokeTrace `variants` are
// preserved untouched). Bakes ONLY net-new catalog entries — the fast path for
// an incremental catalog expansion (avoids re-fetching ~1.2k already-baked cards
// when the SDK is slow). Existing entries keep their full baked record.
const ONLY_MISSING = process.argv.includes("--only-missing");
// --refresh-prices: re-fetch already-baked cards and overlay ONLY their
// TCGplayer listed-price fields (ADR-118 — those prices are now the card
// page's fallback when the sold spine is dark, so they must not rot). Composes
// with --only-missing: net-new cards bake fully, existing cards refresh prices.
const REFRESH_PRICES = process.argv.includes("--refresh-prices");
// --limit N: process only the first N catalog entries. A testing/debugging
// affordance — the snapshot is seeded from the existing one, so a limited run
// refreshes N cards and preserves every other entry untouched. Used to prove
// the --refresh-prices path live without hammering pokemontcg.io with 3.2k
// requests; also how you debug the weekly cron on one card.
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  if (i < 0) return Infinity;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
})();

const POKEMON_TCG_API_BASE = "https://api.pokemontcg.io/v2/cards";
const POKEMON_TCG_SETS_BASE = "https://api.pokemontcg.io/v2/sets";

const OUTPUT_PATH = "lib/cards/baked-metadata.json";

// Per-card retry budget: 4 attempts, ~2.7s on a sustained outage.
// Tighter than the SDK runtime retry (which has more budget) because
// this is a one-shot — if a card fails to bake, the next run will pick
// it up. Better to bake 90% in 3 minutes than 100% in 30 minutes.
const RETRY_DELAYS_MS = [150, 600, 1800];

// Concurrent in-flight requests. Higher = faster bake; too high = upstream
// rate-limits and we get more 429/504s. 8 is a balance — at ~1s per card
// good-case, ~25s for the full 200-card catalog.
const CONCURRENCY = 8;

// Save the snapshot every N cards so an interrupted bake doesn't lose
// progress. Cheap — the file is ~150KB by the end.
const SAVE_EVERY = 25;

type BakedSnapshot = {
  bakedAt: string;
  cards: Record<string, CardMetadata>;
  sets: Record<string, SetMetadata>;
};

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

type RawSet = {
  id?: string;
  name?: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string | null;
  images?: { symbol?: string; logo?: string };
};

function parseSet(raw: RawSet): SetMetadata | null {
  if (typeof raw.id !== "string" || !raw.id) return null;
  return {
    id: raw.id,
    name: typeof raw.name === "string" ? raw.name : raw.id,
    series: typeof raw.series === "string" ? raw.series : "",
    releaseDate: typeof raw.releaseDate === "string" ? raw.releaseDate : null,
    total: typeof raw.total === "number" ? raw.total : typeof raw.printedTotal === "number" ? raw.printedTotal : 0,
    logoUrl:
      (typeof raw.images?.logo === "string" && raw.images.logo) ||
      (typeof raw.images?.symbol === "string" && raw.images.symbol) ||
      "",
  };
}

// Per-request timeout so a stalled connection (pokemontcg.io flaps between
// healthy + timing-out under load) aborts and retries instead of hanging on
// undici's ~300s default — which, at CONCURRENCY, would stall the whole bake.
const FETCH_TIMEOUT_MS = 15_000;

async function fetchOne(url: string): Promise<Response | null> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) return r;
      // Retry on 4xx + 5xx — for catalog IDs we control, 4xx is upstream flake.
      if ((r.status >= 400) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return r;
    } catch {
      clearTimeout(timer);
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function bakeCard(id: string): Promise<CardMetadata | null> {
  const r = await fetchOne(`${POKEMON_TCG_API_BASE}/${encodeURIComponent(id)}`);
  if (!r || !r.ok) return null;
  try {
    const body = (await r.json()) as { data?: RawCard };
    if (!body?.data) return null;
    return parseCard(body.data, id);
  } catch {
    return null;
  }
}

async function bakeAllSets(): Promise<Record<string, SetMetadata>> {
  const r = await fetchOne(`${POKEMON_TCG_SETS_BASE}?pageSize=250`);
  if (!r || !r.ok) return {};
  try {
    const body = (await r.json()) as { data?: RawSet[] };
    if (!Array.isArray(body?.data)) return {};
    const out: Record<string, SetMetadata> = {};
    for (const raw of body.data) {
      const parsed = parseSet(raw);
      if (parsed) out[parsed.id] = parsed;
    }
    return out;
  } catch {
    return {};
  }
}

function loadExisting(): BakedSnapshot {
  const path = join(process.cwd(), OUTPUT_PATH);
  if (!existsSync(path)) {
    return { bakedAt: new Date(0).toISOString(), cards: {}, sets: {} };
  }
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as BakedSnapshot;
    return {
      bakedAt: parsed.bakedAt ?? new Date(0).toISOString(),
      cards: parsed.cards ?? {},
      sets: parsed.sets ?? {},
    };
  } catch {
    return { bakedAt: new Date(0).toISOString(), cards: {}, sets: {} };
  }
}

async function main(): Promise<void> {
  console.log(`Loading existing snapshot from ${OUTPUT_PATH}...`);
  const existing = loadExisting();
  const previousCount = Object.keys(existing.cards).length;
  const previousSetCount = Object.keys(existing.sets).length;
  console.log(`  loaded ${previousCount} previously-baked cards, ${previousSetCount} sets.`);

  console.log(`Catalog has ${CARD_CATALOG.length} entries to bake.`);
  console.log("Fetching sets (one request, pageSize=250)...");
  const freshSets = await bakeAllSets();
  // Merge: keep prior sets unless we have a fresh one.
  const mergedSets = { ...existing.sets, ...freshSets };
  console.log(`  fresh: ${Object.keys(freshSets).length} sets; merged total: ${Object.keys(mergedSets).length}.`);

  console.log(`Fetching cards (concurrency=${CONCURRENCY}, ~4 attempts per card on outage)...`);
  const mergedCards: Record<string, CardMetadata> = { ...existing.cards };
  let baked = 0;
  let preserved = 0;
  let stillMissing = 0;
  let completed = 0;
  let pricesRefreshed = 0;
  // IDs whose fresh fetch failed in the concurrent pass — retried
  // sequentially afterwards (same self-heal discipline as
  // scripts/expand-top5-per-set.ts; pokemontcg.io flaps under load).
  const failedIds: string[] = [];

  function saveSnapshot(): void {
    const snapshot: BakedSnapshot = {
      bakedAt: new Date().toISOString(),
      cards: mergedCards,
      sets: mergedSets,
    };
    const outputJson = JSON.stringify(snapshot, null, 2);
    writeFileSync(join(process.cwd(), OUTPUT_PATH), outputJson, "utf8");
  }

  // Resumable checkpoint (ADR-047): --resume skips cards already baked in a
  // prior interrupted run. Flushes snapshot + state every SAVE_EVERY cards.
  const checkpoint = createBakeCheckpoint({
    statePath: STATE_PATH,
    resume: RESUME,
    flushEvery: SAVE_EVERY,
    persistSnapshot: saveSnapshot,
  });
  let resumeSkipped = 0;

  async function processOne(entry: typeof CARD_CATALOG[number]): Promise<void> {
    const id = entry.pokemonTcgId;
    if (checkpoint.shouldSkip(id)) {
      completed++;
      resumeSkipped++;
      return;
    }
    // --refresh-prices: an already-baked card gets its TCGplayer LISTED prices
    // re-fetched and overlaid (price fields ONLY — see overlayListedPrices).
    // ADR-118 promoted those prices from decoration to the card page's fallback
    // when the sold spine is dark, and --only-missing would otherwise freeze
    // them at first-bake forever until they aged out of the freshness window.
    // Ordered BEFORE the --only-missing skip so the two compose: net-new cards
    // bake fully, existing cards refresh prices.
    if (REFRESH_PRICES && existing.cards[id]) {
      const fresh = await bakeCard(id);
      completed++;
      if (fresh) {
        mergedCards[id] = overlayListedPrices(existing.cards[id], fresh);
        pricesRefreshed++;
        console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> prices refreshed (${fresh.tcgplayerUpdatedAt || "no stamp"})`);
      } else {
        // Upstream failed: keep the prior entry untouched. A stale price that
        // ages out renders as nothing (honest), never as a wrong number.
        preserved++;
        failedIds.push(id);
        console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> price refresh failed, preserving prior`);
      }
      return;
    }
    // --only-missing: leave already-baked cards exactly as they are (metadata +
    // preserved PokeTrace variants) and bake only net-new entries.
    if (ONLY_MISSING && existing.cards[id]) {
      completed++;
      preserved++;
      return;
    }
    const card = await bakeCard(id);
    completed++;
    if (card) {
      // Preserve the baked-ONLY PokeTrace `variants` (Session 49 / ADR-042).
      // The fresh SDK record has no PokeTrace UUIDs (parseCard sets
      // `variants: []`), so a naive `{...prior, ...card}` overlay would DROP
      // the variants that `bake:poketrace-uuids` layered on — silently
      // regressing every card's sold-history panel to "not yet available".
      // overlayFreshMetadata strips the baked-only fields from the fresh
      // record before merging; the invariant is unit-tested in
      // lib/__tests__/bake-snapshot-invariants.test.ts.
      mergedCards[id] = overlayFreshMetadata(existing.cards[id], card);
      baked++;
      console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> baked: ${card.name}`);
    } else if (existing.cards[id]) {
      preserved++;
      failedIds.push(id);
      console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> upstream failed, preserving prior bake (${existing.cards[id].name})`);
    } else {
      stillMissing++;
      failedIds.push(id);
      console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> NO COVERAGE`);
    }
    // mark AFTER mergedCards[id] is set, so a flush here always includes this
    // card's data (state never claims a card the snapshot lacks). Flushes
    // snapshot + state every SAVE_EVERY (ADR-047).
    checkpoint.mark(id);
  }

  // Concurrency-limited fan-out — pool of workers each pulling from a
  // shared queue. Faster than sequential, slower than full parallel
  // (which gets rate-limited by upstream).
  let nextIdx = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = nextIdx++;
      if (idx >= Math.min(CARD_CATALOG.length, LIMIT)) return;
      await processOne(CARD_CATALOG[idx]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  // Sequential retry-failed pass (perf-and-data-foundation, 2026-07-01):
  // pokemontcg.io flaps under concurrent load; a slow one-at-a-time second
  // pass recovers most transient failures within the same run (the same
  // discipline that let expand-top5-per-set.ts self-heal to 173/173 sets).
  if (failedIds.length > 0) {
    console.log("");
    console.log(`Retrying ${failedIds.length} failed card(s) sequentially...`);
    for (const id of failedIds.splice(0)) {
      const card = await bakeCard(id);
      if (card) {
        const hadPrior = Boolean(existing.cards[id]);
        // The retry must honor the SAME overlay contract as the pass it's
        // retrying. Under --refresh-prices an existing card gets the surgical
        // price-only overlay here too — otherwise a card that merely failed
        // once and recovered would silently receive a full metadata rewrite,
        // which is wider than the "prices only" contract this mode promises.
        if (REFRESH_PRICES && hadPrior) {
          mergedCards[id] = overlayListedPrices(existing.cards[id], card);
          pricesRefreshed++;
          preserved--;
          console.log(`  retry ${id} -> prices refreshed (${card.tcgplayerUpdatedAt || "no stamp"})`);
          continue;
        }
        mergedCards[id] = overlayFreshMetadata(existing.cards[id], card);
        baked++;
        if (hadPrior) preserved--;
        else stillMissing--;
        console.log(`  retry ${id} -> baked: ${card.name}`);
      } else {
        failedIds.push(id);
        console.log(`  retry ${id} -> still failing`);
      }
    }
    saveSnapshot();
  }

  checkpoint.finalize();
  if (RESUME && resumeSkipped > 0) console.log(`  resumed: skipped ${resumeSkipped} already-baked cards`);
  const outputJson = JSON.stringify({ bakedAt: new Date().toISOString(), cards: mergedCards, sets: mergedSets }, null, 2);

  const pricedCount = Object.values(mergedCards).filter(
    (c) => c.tcgplayerPrices && Object.keys(c.tcgplayerPrices).length > 0,
  ).length;
  console.log("");
  console.log(`Wrote ${OUTPUT_PATH} (${outputJson.length.toLocaleString()} bytes).`);
  console.log(`  fresh bakes this run:   ${baked}`);
  if (REFRESH_PRICES) console.log(`  listed prices refreshed:${pricesRefreshed}`);
  console.log(`  preserved prior bakes:  ${preserved}`);
  console.log(`  still uncovered:        ${stillMissing}`);
  console.log(`  total card coverage:    ${Object.keys(mergedCards).length}/${CARD_CATALOG.length}`);
  console.log(`  cards with tcgplayerPrices: ${pricedCount}/${Object.keys(mergedCards).length}`);
  console.log(`  total set coverage:     ${Object.keys(mergedSets).length}`);
  if (stillMissing > 0) {
    console.log("");
    console.log(`  ${stillMissing} card(s) still uncovered. Re-run when upstream is healthier`);
    console.log("  to fill those in. The SDK will continue to soft-fail to a minimal record");
    console.log("  for any uncovered ID — same behavior as before this script existed.");
  }
  // Full-bake abort-guard: on a full re-bake (not --only-missing / --resume),
  // any card that never got a FRESH record this run means the snapshot on
  // disk still carries its stale prior entry. The file itself stays safe
  // (prior entries preserved), but a partial refresh must not be committed
  // as if complete — exit non-zero so the operator (or goal-runner) sees it.
  if (!ONLY_MISSING && !RESUME && failedIds.length > 0) {
    console.error("");
    console.error(`FULL BAKE INCOMPLETE: ${failedIds.length} card(s) failed both passes:`);
    console.error(`  ${failedIds.join(", ")}`);
    console.error("  Do NOT commit this snapshot as a completed full re-bake. Re-run to fill in.");
    process.exitCode = 3;
  }
}

main().catch((err) => {
  console.error("bake-card-metadata failed:", err);
  process.exit(1);
});
