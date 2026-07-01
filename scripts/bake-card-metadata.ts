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
import type { CardMetadata, SetMetadata } from "../lib/cards/sdk.ts";
import { createBakeCheckpoint } from "./bake-checkpoint.ts";

const STATE_PATH = ".bake-cards-state.json";
const RESUME = process.argv.includes("--resume");
// --only-missing: skip cards already present in the loaded snapshot (their SDK
// metadata is stable + already baked, and their PokeTrace `variants` are
// preserved untouched). Bakes ONLY net-new catalog entries — the fast path for
// an incremental catalog expansion (avoids re-fetching ~1.2k already-baked cards
// when the SDK is slow). Existing entries keep their full baked record.
const ONLY_MISSING = process.argv.includes("--only-missing");

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

type RawCard = {
  id?: string;
  name?: string;
  number?: string;
  rarity?: string | null;
  set?: { id?: string; name?: string; releaseDate?: string | null };
  images?: { small?: string; large?: string };
};

type RawSet = {
  id?: string;
  name?: string;
  series?: string;
  printedTotal?: number;
  total?: number;
  releaseDate?: string | null;
  images?: { symbol?: string; logo?: string };
};

function parseCard(raw: RawCard): CardMetadata | null {
  if (typeof raw.id !== "string" || !raw.id) return null;
  const id = raw.id;
  const setId = typeof raw.set?.id === "string" ? raw.set.id : id.split("-")[0];
  const image =
    (typeof raw.images?.large === "string" && raw.images.large) ||
    (typeof raw.images?.small === "string" && raw.images.small) ||
    "";
  return {
    id,
    name: typeof raw.name === "string" ? raw.name : id,
    setName: typeof raw.set?.name === "string" ? raw.set.name : setId,
    setId,
    number: typeof raw.number === "string" ? raw.number : id.split("-").slice(1).join("-"),
    image,
    rarity: typeof raw.rarity === "string" ? raw.rarity : null,
    releaseDate: typeof raw.set?.releaseDate === "string" ? raw.set.releaseDate : null,
  };
}

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
    return parseCard(body.data);
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
      // This script fetches SDK metadata, which has no PokeTrace UUIDs, so a
      // naive overwrite would DROP the variants that `bake:poketrace-uuids`
      // layered on — silently regressing every card's sold-history panel to
      // "not yet available" and forcing a full (rate-limited) PokeTrace re-bake
      // to restore. Overlay the fresh metadata onto the prior entry instead so
      // `variants` survives; net-new cards (no prior entry) get none, which is
      // correct — PokeTrace enrichment stays lazy.
      const prior = existing.cards[id];
      mergedCards[id] = prior ? { ...prior, ...card } : card;
      baked++;
      console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> baked: ${card.name}`);
    } else if (existing.cards[id]) {
      preserved++;
      console.log(`  [${completed}/${CARD_CATALOG.length}] ${id} -> upstream failed, preserving prior bake (${existing.cards[id].name})`);
    } else {
      stillMissing++;
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
      if (idx >= CARD_CATALOG.length) return;
      await processOne(CARD_CATALOG[idx]);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  checkpoint.finalize();
  if (RESUME && resumeSkipped > 0) console.log(`  resumed: skipped ${resumeSkipped} already-baked cards`);
  const outputJson = JSON.stringify({ bakedAt: new Date().toISOString(), cards: mergedCards, sets: mergedSets }, null, 2);

  console.log("");
  console.log(`Wrote ${OUTPUT_PATH} (${outputJson.length.toLocaleString()} bytes).`);
  console.log(`  fresh bakes this run:   ${baked}`);
  console.log(`  preserved prior bakes:  ${preserved}`);
  console.log(`  still uncovered:        ${stillMissing}`);
  console.log(`  total card coverage:    ${Object.keys(mergedCards).length}/${CARD_CATALOG.length}`);
  console.log(`  total set coverage:     ${Object.keys(mergedSets).length}`);
  if (stillMissing > 0) {
    console.log("");
    console.log(`  ${stillMissing} card(s) still uncovered. Re-run when upstream is healthier`);
    console.log("  to fill those in. The SDK will continue to soft-fail to a minimal record");
    console.log("  for any uncovered ID — same behavior as before this script existed.");
  }
}

main().catch((err) => {
  console.error("bake-card-metadata failed:", err);
  process.exit(1);
});
