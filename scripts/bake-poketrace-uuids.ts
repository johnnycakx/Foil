// Bake PokeTrace per-variant UUIDs into lib/cards/baked-metadata.json
// (Session 49 / ADR-042).
//
// PokeTrace identifies cards by UUID, NOT by Pokemon TCG SDK id, and a single
// Foil catalog card can map to several PokeTrace UUIDs (one per print
// edition/finish — Holofoil, Shadowless, 1st Edition, Reverse, …). This
// script does the search-then-cache: for each catalog card it searches
// PokeTrace by name, matches candidates by numerator + (denominator==SDK set
// total OR exact set name), and writes the derived `variants[]` array onto
// the card entry in baked-metadata.json. The match + derivation logic lives
// in lib/poketrace/variant.ts (pure + unit-tested).
//
// Usage:
//   npm run bake:poketrace-uuids            # idempotent — skips cards that
//                                           # already have variants
//   npm run bake:poketrace-uuids -- --refresh   # re-bake every card
//
// Rate limit: PokeTrace Scale tier is 60 req/10s; we pace one request per
// ~200ms (~50/10s) to stay comfortably under. ~42s for the full catalog.
//
// Misses + ambiguous matches are logged to docs/poketrace-bake-misses.md for
// manual follow-up. The bake never throws on a per-card miss — it records and
// moves on, and a card with no match keeps an empty variants array (the panel
// degrades to "data unavailable").

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import { matchCatalogCard, slugifyName, type PtCardLite, type PoketraceVariant } from "../lib/poketrace/variant.ts";

const BASE_URL = "https://api.poketrace.com/v1";
const OUTPUT_PATH = "lib/cards/baked-metadata.json";
const MISSES_PATH = "docs/poketrace-bake-misses.md";
const REQ_INTERVAL_MS = 200; // ~50 req / 10s, under the 60/10s Scale burst.

const REFRESH = process.argv.includes("--refresh");

type BakedCard = {
  name?: string;
  setName?: string;
  setId?: string;
  number?: string;
  variants?: PoketraceVariant[];
  [k: string]: unknown;
};
type BakedSet = { total?: number; [k: string]: unknown };
type Snapshot = {
  bakedAt?: string;
  cards?: Record<string, BakedCard>;
  sets?: Record<string, BakedSet>;
  [k: string]: unknown;
};

function loadKey(): string {
  if (process.env.POKETRACE_API_KEY) return process.env.POKETRACE_API_KEY;
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    return (env.match(/^POKETRACE_API_KEY=(.*)$/m)?.[1] ?? "").trim();
  } catch {
    return "";
  }
}

const KEY = loadKey();

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function searchCards(name: string, setSlug?: string): Promise<PtCardLite[]> {
  let url = `${BASE_URL}/cards?search=${encodeURIComponent(name)}&market=US&limit=50`;
  if (setSlug) url += `&set=${encodeURIComponent(setSlug)}`;
  const res = await fetch(url, { headers: { "X-API-Key": KEY, Accept: "application/json" } });
  if (!res.ok) throw new Error(`PokeTrace ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`);
  const json = (await res.json()) as { data?: PtCardLite[] };
  return Array.isArray(json.data) ? json.data : [];
}

function mergeCandidates(a: PtCardLite[], b: PtCardLite[]): PtCardLite[] {
  const seen = new Set(a.map((c) => c.id));
  return [...a, ...b.filter((c) => !seen.has(c.id))];
}

function loadSnapshot(): Snapshot {
  const path = join(process.cwd(), OUTPUT_PATH);
  if (!existsSync(path)) throw new Error(`${OUTPUT_PATH} not found — run \`npm run bake:cards\` first.`);
  return JSON.parse(readFileSync(path, "utf8")) as Snapshot;
}

async function main(): Promise<void> {
  if (!KEY) {
    console.error("POKETRACE_API_KEY not set (env or .env.local). Aborting.");
    process.exit(1);
  }
  const snap = loadSnapshot();
  const cards = snap.cards ?? {};
  const sets = snap.sets ?? {};

  console.log(`Baking PokeTrace UUIDs for ${CARD_CATALOG.length} catalog cards${REFRESH ? " (--refresh)" : ""}…`);

  const misses: string[] = [];
  let matched = 0;
  let skipped = 0;
  let missed = 0;
  let totalVariants = 0;
  let i = 0;

  for (const entry of CARD_CATALOG) {
    i++;
    const id = entry.pokemonTcgId;
    const card = cards[id];
    if (!card) {
      misses.push(`- \`${id}\` (${entry.slug}) — no baked card metadata; run \`bake:cards\` first.`);
      missed++;
      continue;
    }
    if (!REFRESH && Array.isArray(card.variants) && card.variants.length > 0) {
      skipped++;
      continue;
    }

    const name = String(card.name ?? "");
    const setName = String(card.setName ?? "");
    const number = String(card.number ?? "");
    const setTotal = typeof sets[card.setId ?? ""]?.total === "number" ? (sets[card.setId ?? ""]!.total as number) : 0;

    let candidates: PtCardLite[] = [];
    try {
      candidates = await searchCards(name);
    } catch (err) {
      misses.push(`- \`${id}\` (${name} / ${setName}) — search error: ${err instanceof Error ? err.message : String(err)}`);
      missed++;
      await sleep(REQ_INTERVAL_MS);
      continue;
    }

    let result = matchCatalogCard({ name, setName, setTotal, number }, candidates);

    // Name-only search ranks reprints/reverse-holos first and can bury the
    // target printing past the limit (common for vintage sets). On a miss,
    // retry scoped to the set slug (PokeTrace's vintage slugs match
    // slugify(setName): Jungle→jungle, Neo Genesis→neo-genesis, …) and
    // re-match the merged candidate pool.
    if (result.status === "miss" || result.variants.length === 0) {
      const setSlug = slugifyName(setName);
      if (setSlug) {
        try {
          await sleep(REQ_INTERVAL_MS);
          const setScoped = await searchCards(name, setSlug);
          candidates = mergeCandidates(candidates, setScoped);
          result = matchCatalogCard({ name, setName, setTotal, number }, candidates);
        } catch {
          /* keep the name-only miss */
        }
      }
    }
    if (result.status === "miss" || result.variants.length === 0) {
      misses.push(`- \`${id}\` (${name} / ${setName} #${number}, total ${setTotal}) — ${result.note}`);
      missed++;
    } else {
      card.variants = result.variants;
      matched++;
      totalVariants += result.variants.length;
      const keys = result.variants.map((v) => v.variantKey).join(", ");
      if (result.status === "ambiguous") {
        misses.push(`- \`${id}\` (${name} / ${setName}) — AMBIGUOUS: ${result.note}; kept [${keys}]`);
      }
      console.log(`  [${i}/${CARD_CATALOG.length}] ${id} -> ${result.variants.length} variant(s): ${keys}`);
    }

    await sleep(REQ_INTERVAL_MS);
  }

  snap.bakedAt = new Date().toISOString();
  writeFileSync(join(process.cwd(), OUTPUT_PATH), JSON.stringify(snap, null, 2), "utf8");

  const missesDoc = `# PokeTrace UUID bake — unmatched / ambiguous cards

_Last bake: ${new Date().toISOString()}_

${misses.length === 0 ? "All catalog cards matched cleanly. 🎉" : misses.join("\n")}
`;
  writeFileSync(join(process.cwd(), MISSES_PATH), missesDoc, "utf8");

  console.log("");
  console.log(`Wrote ${OUTPUT_PATH}.`);
  console.log(`  matched:        ${matched} cards (${totalVariants} variants total)`);
  console.log(`  skipped (had):  ${skipped}`);
  console.log(`  missed:         ${missed} (see ${MISSES_PATH})`);
}

main().catch((err) => {
  console.error("bake-poketrace-uuids failed:", err);
  process.exit(1);
});
