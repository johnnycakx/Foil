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
import type { SoldHistory, SoldStat, SoldSource } from "../lib/poketrace/by-uuid.ts";
import { LINE_POKEMON } from "../lib/lines/config.ts";

const OUTPUT_PATH = "lib/lines/sold-snapshot.generated.json";
const SNAPSHOT_PATH = "lib/cards/baked-metadata.json";
const SOURCES: readonly SoldSource[] = ["ebay", "tcgplayer", "cardmarket"];
// Headline tiers ONLY (ADR-095 accuracy moat): the card's canonical value is
// its NM (or LP) sold price. MP/HP/DMG are junk-copy prices — a 2-sale Damaged
// outlier ($500k on a $50 card) is exactly the fabricated-looking figure this
// page cannot show. Never headline below LP.
const HEADLINE_TIERS = ["NEAR_MINT", "LIGHTLY_PLAYED"] as const;
// Confidence floor: a figure from fewer than this many sales isn't reliable
// "sold for ~$X recently" — thin trading + one outlier skews it.
const MIN_SALES = 3;
// Sanity band vs the baked TCGplayer market: a sold figure more than this
// multiple ABOVE the market high (or a fraction BELOW the market low) is a data
// outlier (mis-parse / graded-slab bleed), suppressed to the pending state.
const MAX_OVER_MARKET = 4;
const MIN_UNDER_MARKET = 0.15;

function loadKey(): string {
  if (process.env.POKETRACE_API_KEY) return process.env.POKETRACE_API_KEY;
  try {
    const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    return (env.match(/^POKETRACE_API_KEY=(.*)$/m)?.[1] ?? "").trim();
  } catch {
    return "";
  }
}

/** The single "recent sold" figure for a card's headline: NM first, then LP.
 *  Requires MIN_SALES for confidence and passes a TCGplayer sanity band —
 *  otherwise null (→ the honest pending state). `tcgHighCents`/`tcgLowCents`
 *  are the baked TCGplayer market bounds for the outlier cross-check. */
function headlineSold(
  h: SoldHistory | null,
  tcgLowCents: number | null,
  tcgHighCents: number | null,
): { cents: number; saleCount: number; tierLabel: string; source: string; note?: string } | null {
  for (const tier of HEADLINE_TIERS) {
    const label = tier === "NEAR_MINT" ? "Near Mint" : "Lightly Played";
    for (const src of SOURCES) {
      const s: SoldStat | undefined = h?.bySource[src]?.[tier];
      const v = s?.avg30d ?? s?.avg ?? null;
      const sales = s?.saleCount ?? 0;
      if (typeof v !== "number" || v <= 0) continue;
      const cents = Math.round(v * 100);
      if (sales < MIN_SALES) return { cents, saleCount: sales, tierLabel: label, source: src, note: "low_sales" };
      // TCGplayer sanity band — reject data outliers ($500k on a $50 card).
      if (tcgHighCents != null && cents > tcgHighCents * MAX_OVER_MARKET)
        return { cents, saleCount: sales, tierLabel: label, source: src, note: "over_market" };
      if (tcgLowCents != null && tcgLowCents > 0 && cents < tcgLowCents * MIN_UNDER_MARKET)
        return { cents, saleCount: sales, tierLabel: label, source: src, note: "under_market" };
      return { cents, saleCount: sales, tierLabel: label, source: src };
    }
  }
  return null;
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

  const out: Record<string, { soldCents: number; saleCount: number; tierLabel: string; source: string }> = {};
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
    // (a figure with a suppression `note` — low sales / market outlier — is
    // dropped to the pending state; never shown).
    let best: { cents: number; saleCount: number; tierLabel: string; source: string } | null = null;
    let lastReject = "";
    for (const v of variants) {
      await sleep(180); // under the 30 req/10s PokeTrace burst
      const h = await getSoldHistory(v.poketraceId);
      const head = headlineSold(h, tcgLow, tcgHigh);
      if (!head) continue;
      if (head.note) {
        lastReject = head.note;
        continue;
      }
      if (!best || head.saleCount > best.saleCount) best = { cents: head.cents, saleCount: head.saleCount, tierLabel: head.tierLabel, source: head.source };
    }
    if (best) {
      out[slug] = { soldCents: best.cents, saleCount: best.saleCount, tierLabel: best.tierLabel, source: best.source };
      withData++;
      console.log(`  [${i}/${lineSlugs.length}] ${slug} -> $${(best.cents / 100).toFixed(0)} (${best.saleCount} sales, ${best.tierLabel})`);
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
