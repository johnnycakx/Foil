// Invariants for the committed baked snapshot + the bake merge discipline
// (perf-and-data-foundation goal, 2026-07-01).
//
// The incident these pin: scripts/bake-card-metadata.ts carried a stale
// 8-field duplicate of parseCard for ~5 weeks, so EVERY committed snapshot had
// `tcgplayerPrices` empty on all 1,840 cards — the per-card AggregateOffer
// JSON-LD, the variants panel, and the metadata-tier price signal silently
// rendered from nothing. tsconfig excluded scripts/, so tsc never saw it.
// The fix: the script imports the real sdk.ts parser (one parser), scripts/
// is typechecked, and these tests fail the suite if the committed snapshot
// ever regresses to price-empty or variant-wiped.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { overlayFreshMetadata } from "../cards/bake-merge.ts";
import type { CardMetadata } from "../cards/sdk.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

type Snapshot = { bakedAt: string; cards: Record<string, Partial<CardMetadata>> };

function loadSnapshot(): Snapshot {
  const raw = readFileSync(join(ROOT, "lib/cards/baked-metadata.json"), "utf8");
  return JSON.parse(raw) as Snapshot;
}

// Pre-fix baseline, measured 2026-07-01 before the full re-bake: 1,752
// variants across 1,189 cards (bake:poketrace-uuids output). A re-bake must
// never shrink this — the variant-wipe failure mode is a fresh SDK record
// (variants: []) overlaying a prior entry and silently dropping its PokeTrace
// variants. Raise the floor deliberately when PokeTrace coverage grows.
const VARIANT_COUNT_FLOOR = 1_752;

test("committed snapshot: total PokeTrace variant count never shrinks below the pre-bake floor", () => {
  const snapshot = loadSnapshot();
  const total = Object.values(snapshot.cards).reduce(
    (sum, c) => sum + (Array.isArray(c.variants) ? c.variants.length : 0),
    0,
  );
  assert.ok(
    total >= VARIANT_COUNT_FLOOR,
    `snapshot carries ${total} variants — below the ${VARIANT_COUNT_FLOOR} floor; a re-bake wiped baked PokeTrace variants`,
  );
});

test("committed snapshot: a known curated card carries real tcgplayerPrices", () => {
  // base1-4 (Base Set Charizard) always has TCGplayer prices upstream. An
  // empty record here means the bake parser dropped the field again.
  const snapshot = loadSnapshot();
  const charizard = snapshot.cards["base1-4"];
  assert.ok(charizard, "base1-4 must be in the committed snapshot");
  const prices = charizard.tcgplayerPrices ?? {};
  assert.ok(
    Object.keys(prices).length >= 1,
    "base1-4 has no tcgplayerPrices in the committed snapshot — the price-empty bake regression",
  );
  const anyVariant = Object.values(prices)[0]!;
  assert.ok(
    typeof anyVariant.market === "number" || typeof anyVariant.low === "number",
    "base1-4 tcgplayerPrices carries no numeric price",
  );
});

test("committed snapshot: price coverage spans the catalog, not just a lucky few", () => {
  // The catalog was ranked by SDK TCGplayer price (ADR-088), so the vast
  // majority of entries have upstream prices. A large price-empty share means
  // a partial or parser-broken bake. Floor set conservatively below the
  // measured post-fix coverage so upstream churn doesn't flake the suite.
  const snapshot = loadSnapshot();
  const cards = Object.values(snapshot.cards);
  const priced = cards.filter(
    (c) => c.tcgplayerPrices && Object.keys(c.tcgplayerPrices).length > 0,
  ).length;
  assert.ok(
    priced >= 1_500,
    `only ${priced}/${cards.length} snapshot cards carry tcgplayerPrices — bake regression`,
  );
});

test("overlayFreshMetadata: preserves prior baked-only variants against a fresh SDK record", () => {
  const prior = {
    id: "base1-4",
    name: "Charizard",
    setName: "Base",
    setId: "base1",
    series: "Base",
    number: "4",
    image: "https://images.pokemontcg.io/base1/4_hires.png",
    rarity: "Rare Holo",
    releaseDate: "1999/01/09",
    types: ["Fire"],
    subtypes: ["Stage 2"],
    hp: "120",
    artist: "Mitsuhiro Arita",
    attacks: [],
    weaknesses: [],
    tcgplayerPrices: {},
    tcgplayerUpdatedAt: "",
    variants: [
      { uuid: "poketrace-uuid-1", label: "Holofoil", key: "holofoil" },
      { uuid: "poketrace-uuid-2", label: "Shadowless", key: "shadowless" },
    ],
  } as unknown as CardMetadata;
  const fresh: CardMetadata = {
    ...prior,
    tcgplayerPrices: {
      holofoil: { low: 300, mid: 450, high: 900, market: 420.5, directLow: null },
    },
    tcgplayerUpdatedAt: "2026/07/01",
    variants: [], // what sdk.ts::parseCard always emits for a live fetch
  };
  const merged = overlayFreshMetadata(prior, fresh);
  assert.equal(merged.variants?.length, 2, "prior PokeTrace variants must survive the overlay");
  assert.equal(merged.tcgplayerPrices.holofoil.market, 420.5, "fresh prices must land");
});

test("overlayFreshMetadata: net-new card passes through unchanged", () => {
  const fresh = {
    id: "sv1-1",
    name: "Sprigatito",
    variants: [],
    tcgplayerPrices: {},
  } as unknown as CardMetadata;
  const merged = overlayFreshMetadata(undefined, fresh);
  assert.deepEqual(merged, fresh);
});

test("bake script imports the SDK parser — no local duplicate (the 5-week price-empty root cause)", () => {
  const src = readFileSync(join(ROOT, "scripts/bake-card-metadata.ts"), "utf8");
  assert.match(
    src,
    /import \{ parseCard[^}]*\} from "\.\.\/lib\/cards\/sdk\.ts"/,
    "bake script must import parseCard from lib/cards/sdk.ts",
  );
  assert.doesNotMatch(
    src,
    /function parseCard\(/,
    "bake script must not define its own parseCard — the stale-duplicate regression",
  );
  assert.match(
    src,
    /overlayFreshMetadata\(/,
    "bake script must merge via overlayFreshMetadata (variant-wipe guard)",
  );
});
