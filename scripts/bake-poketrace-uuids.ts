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
import type { PoketraceVariant } from "../lib/poketrace/variant.ts";
// The ONE PokeTrace resolution path (ADR-092) — shared with the runtime
// hydration worker. Search + market ladder + match + overrides live there.
import { resolveVariantsForCard, getManualOverride, HYDRATE_REQ_INTERVAL_MS } from "../lib/poketrace/hydrate-core.ts";
import { createBakeCheckpoint } from "./bake-checkpoint.ts";

const OUTPUT_PATH = "lib/cards/baked-metadata.json";
const MISSES_PATH = "docs/poketrace-bake-misses.md";
const STATE_PATH = ".bake-poketrace-state.json";
const REQ_INTERVAL_MS = HYDRATE_REQ_INTERVAL_MS; // shared pacing (hydrate-core)

const REFRESH = process.argv.includes("--refresh");
const RESUME = process.argv.includes("--resume");

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

// Manual overrides now live inside hydrate-core (the shared path consults
// them before searching). Vendor gaps stay here — they're bake-report copy.

// Cards PokeTrace genuinely has no usable catalog entry for (vendor data
// gap, not a matching-logic failure). Tagged in the misses doc; the panel
// degrades gracefully. Keyed by catalog slug.
const KNOWN_VENDOR_GAPS: Record<string, string> = {
  "base6-16-muk": "PokeTrace has no Legendary Collection Muk in its catalog (set-scoped search returns 0).",
  "cel25-11-mew": "PokeTrace's Celebrations set only carries Mew at #025/025 (secret), not the #11 base printing — number mismatch, not the same card.",
};

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
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

  console.log(
    `Baking PokeTrace UUIDs for ${CARD_CATALOG.length} catalog cards${REFRESH ? " (--refresh)" : ""}${RESUME ? " (--resume)" : ""}…`,
  );

  // Resumable checkpoint (ADR-047): persists snapshot + state every 25 cards
  // so a killed run can --resume instead of restarting the whole catalog.
  const checkpoint = createBakeCheckpoint({
    statePath: STATE_PATH,
    resume: RESUME,
    persistSnapshot: () => {
      snap.bakedAt = new Date().toISOString();
      writeFileSync(join(process.cwd(), OUTPUT_PATH), JSON.stringify(snap, null, 2), "utf8");
    },
  });

  const misses: string[] = [];
  let matched = 0;
  let skipped = 0;
  let missed = 0;
  let totalVariants = 0;
  let i = 0;

  for (const entry of CARD_CATALOG) {
    i++;
    const id = entry.pokemonTcgId;
    if (checkpoint.shouldSkip(id)) {
      skipped++;
      continue;
    }
    // mark() runs on every exit path (incl. the early `continue`s below) so
    // each processed card is recorded for --resume.
    try {
    const card = cards[id];
    if (!card) {
      misses.push(`- \`${id}\` (${entry.slug}) — no baked card metadata; run \`bake:cards\` first.`);
      missed++;
      continue;
    }

    // Manual override wins unconditionally (Session 49.1), even over an
    // existing search-baked value and regardless of --refresh.
    const override = getManualOverride(entry.slug);
    if (override) {
      card.variants = override;
      matched++;
      totalVariants += override.length;
      console.log(`  [${i}/${CARD_CATALOG.length}] ${id} -> OVERRIDE ${override.length} variant(s): ${override.map((v) => v.variantKey).join(", ")}`);
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

    // The ONE resolution path (hydrate-core, ADR-092) — overrides + search +
    // market ladder + match. Shared byte-for-byte with the runtime worker.
    const outcome = await resolveVariantsForCard(
      { slug: entry.slug, name, setName, number, setTotal },
      { apiKey: KEY },
    );

    if (outcome.status === "error") {
      misses.push(`- \`${id}\` (${name} / ${setName}) — ${outcome.note}`);
      missed++;
    } else if (outcome.status === "no_match") {
      const gap = KNOWN_VENDOR_GAPS[entry.slug];
      misses.push(
        gap
          ? `- \`${id}\` (${name} / ${setName} #${number}) — **PokeTrace catalog gap**: ${gap} Graceful degradation accepted.`
          : `- \`${id}\` (${name} / ${setName} #${number}, total ${setTotal}) — ${outcome.note}`,
      );
      missed++;
    } else {
      card.variants = outcome.variants;
      matched++;
      totalVariants += outcome.variants.length;
      const keys = outcome.variants.map((v) => v.variantKey).join(", ");
      if (outcome.status === "ambiguous") {
        misses.push(`- \`${id}\` (${name} / ${setName}) — AMBIGUOUS: ${outcome.note}; kept [${keys}]`);
      }
      console.log(`  [${i}/${CARD_CATALOG.length}] ${id} -> ${outcome.variants.length} variant(s): ${keys}`);
    }

    await sleep(REQ_INTERVAL_MS);
    } finally {
      checkpoint.mark(id);
    }
  }

  // Final flush of snapshot + checkpoint state (ADR-047).
  checkpoint.finalize();

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
