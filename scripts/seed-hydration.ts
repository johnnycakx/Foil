// One-time proactive hydration seed (demand-driven-data, ADR-092).
//
// The demand-driven doctrine hydrates on WATCH — but the top chase cards the
// ADR-088 expansion added (Gyarados ★ δ class) will be hit by visitors before
// anyone watches them. Seed the top ~100 no-variant cards by baked TCGplayer
// value ONCE, through the same shared resolution path + pacing as everything
// else, and write them into the COMMITTED snapshot (this is a local script —
// unlike the runtime worker it can, so these cards ship baked).
//
// Prioritization doctrine: watched > high-value > everything else. This is
// the "high-value" leg. NEVER bulk-hydrate the full catalog.
//
//   node --experimental-strip-types --no-warnings scripts/seed-hydration.ts
//   ... --limit 100   (default)
//   ... --dry-run     (rank + report only, no PokeTrace calls)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import type { PoketraceVariant } from "../lib/poketrace/variant.ts";
import { resolveVariantsForCard, HYDRATE_REQ_INTERVAL_MS } from "../lib/poketrace/hydrate-core.ts";

const OUTPUT_PATH = "lib/cards/baked-metadata.json";

type BakedCard = {
  name?: string;
  setName?: string;
  setId?: string;
  number?: string;
  variants?: PoketraceVariant[];
  tcgplayerPrices?: Record<string, { market?: number | null; low?: number | null; high?: number | null }>;
  [k: string]: unknown;
};
type Snapshot = {
  bakedAt?: string;
  cards?: Record<string, BakedCard>;
  sets?: Record<string, { total?: number; [k: string]: unknown }>;
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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function cardValue(card: BakedCard): number {
  const prices = Object.values(card.tcgplayerPrices ?? {});
  return Math.max(0, ...prices.map((p) => p.market ?? p.low ?? 0).map((n) => (typeof n === "number" ? n : 0)));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const KEY = loadKey();
  const DRY = process.argv.includes("--dry-run");
  const LIMIT = Number(arg("limit") ?? 100);
  if (!KEY && !DRY) {
    console.error("POKETRACE_API_KEY not set. Aborting.");
    process.exit(1);
  }

  const path = join(process.cwd(), OUTPUT_PATH);
  if (!existsSync(path)) throw new Error(`${OUTPUT_PATH} not found`);
  const snap = JSON.parse(readFileSync(path, "utf8")) as Snapshot;
  const cards = snap.cards ?? {};
  const sets = snap.sets ?? {};
  const slugById = new Map(CARD_CATALOG.map((e) => [e.pokemonTcgId, e.slug]));

  // Rank: no-variant cards by baked TCGplayer value, top LIMIT.
  const targets = Object.entries(cards)
    .filter(([, c]) => !Array.isArray(c.variants) || c.variants.length === 0)
    .map(([id, c]) => ({ id, card: c, value: cardValue(c), slug: slugById.get(id) }))
    .filter((t): t is typeof t & { slug: string } => typeof t.slug === "string")
    .sort((a, b) => b.value - a.value)
    .slice(0, LIMIT);

  console.log(`Seeding hydration for top ${targets.length} unhydrated cards by value (of ${Object.values(cards).filter((c) => !c.variants?.length).length} total unhydrated).`);
  if (DRY) {
    for (const t of targets.slice(0, 20)) console.log(`  ${t.id} (${t.card.name}) $${t.value}`);
    return;
  }

  let matched = 0;
  let noMatch = 0;
  let errored = 0;
  const failures: string[] = [];
  let i = 0;

  for (const t of targets) {
    i++;
    await sleep(HYDRATE_REQ_INTERVAL_MS);
    const setTotal = typeof sets[t.card.setId ?? ""]?.total === "number" ? (sets[t.card.setId ?? ""]!.total as number) : 0;
    const outcome = await resolveVariantsForCard(
      {
        slug: t.slug,
        name: String(t.card.name ?? ""),
        setName: String(t.card.setName ?? ""),
        number: String(t.card.number ?? ""),
        setTotal,
      },
      { apiKey: KEY },
    );
    if (outcome.status === "matched" || outcome.status === "ambiguous") {
      // Fill ONLY the empty variants field — the overlay discipline; nothing
      // else on the record is touched.
      t.card.variants = outcome.variants;
      matched++;
      console.log(`  [${i}/${targets.length}] ${t.id} ($${t.value}) -> ${outcome.variants.length} variant(s)${outcome.status === "ambiguous" ? " (ambiguous)" : ""}`);
    } else if (outcome.status === "no_match") {
      noMatch++;
      failures.push(`${t.id} (${t.card.name}) — no_match: ${outcome.note}`);
      console.log(`  [${i}/${targets.length}] ${t.id} -> NO MATCH (${outcome.note.slice(0, 80)})`);
    } else {
      errored++;
      failures.push(`${t.id} (${t.card.name}) — error: ${outcome.note}`);
      console.log(`  [${i}/${targets.length}] ${t.id} -> ERROR (${outcome.note.slice(0, 80)})`);
    }
    // Persist incrementally every 20 cards so an interrupted run keeps progress.
    if (i % 20 === 0) {
      snap.bakedAt = new Date().toISOString();
      writeFileSync(path, JSON.stringify(snap, null, 2), "utf8");
    }
  }

  snap.bakedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(snap, null, 2), "utf8");

  console.log("");
  console.log(`Seed complete: ${matched} hydrated · ${noMatch} no-match · ${errored} errors (of ${targets.length}).`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) console.log(`  - ${f}`);
  }
}

main().catch((err) => {
  console.error("seed-hydration failed:", err);
  process.exit(1);
});
