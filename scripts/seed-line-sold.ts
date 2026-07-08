// Seed the committed sold-data snapshot for the line-tracker pages
// (eve-line-tracker, ADR-095). The /lines/[pokemon] page renders every printing
// with "sold for ~$X recently" — but calling PokeTrace live per card (~44
// cards) on every page view would be slow + rate-limited, and the page must
// feel instant. So we bake a point-in-time sold snapshot ONCE here (real
// PokeTrace figures via the same getSoldHistory path the card page uses),
// commit it, and the page reads it statically. NULL-OVER-GUESS: a card with no
// PokeTrace sold data gets no entry → the page renders "sold data pending",
// never a fabricated or SDK-guessed figure.
//
// Regenerate (needs POKETRACE_API_KEY + baked PokeTrace variants):
//   node --experimental-strip-types --no-warnings scripts/seed-line-sold.ts
//
// Honesty: the snapshot carries an `asOf` timestamp; the page labels the data
// "sold recently (as of <date>)" so a stale snapshot never overclaims currency.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import { getSoldHistory } from "../lib/poketrace/by-uuid.ts";
import type { PoketraceVariant } from "../lib/poketrace/variant.ts";
import { resolveLineSoldEntry } from "../lib/lines/sold-select.ts";
import { LINE_POKEMON } from "../lib/lines/config.ts";

const OUTPUT_PATH = "lib/lines/sold-snapshot.generated.json";
const SNAPSHOT_PATH = "lib/cards/baked-metadata.json";
// Freshness anchor for the whole run — every tier's fresh-windowed check keys
// off this. Selection + suppression logic lives in lib/lines/sold-select.ts
// (shared with the render + the unit tests); this script only orchestrates the
// live PokeTrace reads and writes the committed snapshot.
const NOW_MS = Date.now();

function loadKey(): string {
  if (process.env.POKETRACE_API_KEY) return process.env.POKETRACE_API_KEY;
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    return (env.match(/^POKETRACE_API_KEY=(.*)$/m)?.[1] ?? "").trim();
  } catch {
    return "";
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const key = loadKey();
  if (!key) {
    console.error("POKETRACE_API_KEY not set. Aborting.");
    process.exit(1);
  }
  process.env.POKETRACE_API_KEY = key;

  const snapshot = JSON.parse(readFileSync(join(process.cwd(), SNAPSHOT_PATH), "utf8")) as {
    cards: Record<
      string,
      { variants?: PoketraceVariant[]; tcgplayerPrices?: Record<string, { low: number | null; high: number | null; market: number | null }> }
    >;
  };

  const tcgBounds = (id: string): { low: number | null; high: number | null } => {
    const prices = snapshot.cards[id]?.tcgplayerPrices ?? {};
    const lows: number[] = [];
    const highs: number[] = [];
    for (const p of Object.values(prices)) {
      if (typeof p.low === "number" && p.low > 0) lows.push(p.low);
      if (typeof p.high === "number" && p.high > 0) highs.push(p.high);
      if (typeof p.market === "number" && p.market > 0) highs.push(p.market);
    }
    return {
      low: lows.length ? Math.round(Math.min(...lows) * 100) : null,
      high: highs.length ? Math.round(Math.max(...highs) * 100) : null,
    };
  };

  // Every catalog slug for the launch lines (name-matched, same as the page).
  const lineSlugs = CARD_CATALOG.filter((e) =>
    LINE_POKEMON.some((p) => new RegExp(p, "i").test(e.slug)),
  ).map((e) => ({ slug: e.slug, id: e.pokemonTcgId }));

  type Entry = { soldCents: number; saleCount: number; tierLabel: string; source: string; soldAsOf: string | null };
  const out: Record<string, Entry> = {};
  let withData = 0;
  let i = 0;

  for (const { slug, id } of lineSlugs) {
    i++;
    const variants = snapshot.cards[id]?.variants ?? [];
    if (variants.length === 0) {
      console.log(`  [${i}/${lineSlugs.length}] ${slug} -> no baked variants (pending)`);
      continue;
    }
    const { low: tcgLow, high: tcgHigh } = tcgBounds(id);
    // Read every variant's sold history; keep the best-traded ACCEPTED headline
    // (a figure with a suppression `note` — low sales / market outlier / not a
    // fresh windowed value — is dropped to the pending state; never shown).
    let best: Entry | null = null;
    let lastReject = "";
    for (const v of variants) {
      await sleep(180); // under the 30 req/10s PokeTrace burst
      const h = await getSoldHistory(v.poketraceId);
      const head = resolveLineSoldEntry(h, { tcgLowCents: tcgLow, tcgHighCents: tcgHigh, nowMs: NOW_MS });
      if (!head) continue;
      if (head.note) {
        lastReject = head.note;
        continue;
      }
      if (!best || head.saleCount > best.saleCount)
        best = { soldCents: head.cents, saleCount: head.saleCount, tierLabel: head.tierLabel, source: head.source, soldAsOf: head.soldAsOf };
    }
    if (best) {
      out[slug] = best;
      withData++;
      console.log(`  [${i}/${lineSlugs.length}] ${slug} -> $${(best.soldCents / 100).toFixed(0)} (${best.saleCount} sales, ${best.tierLabel}, asOf ${best.soldAsOf ?? "?"})`);
    } else {
      console.log(`  [${i}/${lineSlugs.length}] ${slug} -> pending${lastReject ? ` (suppressed: ${lastReject})` : " (no data)"}`);
    }
  }

  const doc = { asOf: new Date().toISOString(), cards: out };
  writeFileSync(join(process.cwd(), OUTPUT_PATH), JSON.stringify(doc, null, 2), "utf8");
  const pct = lineSlugs.length ? Math.round((withData / lineSlugs.length) * 100) : 0;
  console.log(`\nWrote ${OUTPUT_PATH}: ${withData}/${lineSlugs.length} cards with sold data (${pct}% coverage).`);
}

main().catch((err) => {
  console.error("seed-line-sold failed:", err);
  process.exit(1);
});
