// End-to-end verify for the PriceCharting integration. Exercises the same
// production path the upload pipeline takes (priceCard → lookupPriceCharting →
// merged PriceQuote[]) against three cards from poketestimage.jpg, then prints
// the merged ladder per card. This is the machine-checkable equivalent of the
// browser eyeball test — no UI, but proves real graded numbers are flowing.
//
// Run: node --experimental-strip-types --no-warnings scripts/verify-pricecharting.ts

import fs from "node:fs";
import path from "node:path";
import { priceCard } from "../lib/poketrace.ts";
import { lookupPriceCharting } from "../lib/pricecharting.ts";
import {
  SOURCE_LABELS,
  TIER_LABELS,
  bestUngraded,
  gradedLadder,
  quotesAtTier,
  type PriceQuote,
} from "../lib/pricing.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
for (const k of ["POKETRACE_API_KEY", "PRICECHARTING_API_KEY"] as const) {
  if (!process.env[k]) throw new Error(`${k} missing`);
}

const FIXTURES = [
  {
    label: "Charizard Base Set #4/102 (vintage holo)",
    name: "Charizard",
    setCode: "BS1",                  // PokeTrace's Base Set code
    setName: "Base Set",             // human-friendly for PriceCharting search
    collectorNumber: "4/102",
    rarity: "Holo Rare",
  },
  {
    label: "Pikachu Base Set #58/102 (vintage common)",
    name: "Pikachu",
    setCode: "BS1",
    setName: "Base Set",
    collectorNumber: "58/102",
    rarity: "Common",
  },
  {
    label: "Oricorio ex (recent)",
    name: "Oricorio ex",
    setCode: null,                   // let PokeTrace fuzz it
    setName: "Promo",
    collectorNumber: null,
    rarity: "Double Rare",
  },
  // Modern-set bulk to exercise the AGGREGATED fallback that was the
  // ba35a63 regression. SSP / MEG / PRE / PAL eras are where PokeTrace tends
  // to lack explicit per-source NEAR_MINT and falls back to AGGREGATED.
  {
    label: "Iono PAL #185 (modern common — AGGREGATED-path candidate)",
    name: "Iono",
    setCode: "PAL",
    setName: "Paldea Evolved",
    collectorNumber: "185/193",
    rarity: "Ultra Rare",
  },
];

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

console.log("\n==== Foil pricing end-to-end verify ====\n");

let pcHits = 0;
let pcMisses = 0;
const allMergedQuotes: Array<{ label: string; quotes: PriceQuote[] }> = [];

for (const f of FIXTURES) {
  console.log(`\n--- ${f.label} ---`);

  // 1) PokeTrace half (identification + ungraded + any graded PokeTrace has).
  const poke = await priceCard({
    name: f.name,
    setCode: f.setCode,
    collectorNumber: f.collectorNumber,
    rarity: f.rarity,
  });

  if (!poke.matched) {
    console.log(`  PokeTrace: ✗ ${poke.reason}`);
    continue;
  }
  console.log(
    `  PokeTrace: ✓ ${poke.candidate.name} | ${poke.candidate.set} #${poke.candidate.cardNumber} | ${poke.candidate.variant}`,
  );
  console.log(`             quotes from PokeTrace: ${poke.quotes.length}`);

  // 2) PriceCharting half (parallel call would happen in the real pipeline;
  // serialized here for clearer output).
  const pcStart = Date.now();
  const pc = await lookupPriceCharting({
    poketraceId: poke.candidate.id,
    name: poke.candidate.name,
    setName: poke.candidate.set,
    collectorNumber: poke.candidate.cardNumber,
  });
  const pcMs = Date.now() - pcStart;

  if (!pc) {
    console.log(`  PriceCharting: ✗ no match (${pcMs}ms)`);
    pcMisses++;
  } else {
    console.log(
      `  PriceCharting: ✓ ${pc.productName} | console="${pc.consoleName}" (${pcMs}ms · ${pc.quotes.length} quotes)`,
    );
    pcHits++;
  }

  // 3) Merge (same shape the UI receives).
  const merged: PriceQuote[] = [...poke.quotes, ...(pc?.quotes ?? [])];
  allMergedQuotes.push({ label: f.label, quotes: merged });

  // 4) Print the UI-derived view.
  const ungraded = bestUngraded(merged);
  const allUngraded = quotesAtTier(merged, "RAW_UNGRADED");
  const ladder = gradedLadder(merged);

  console.log(`  --- UI view ---`);
  if (ungraded) {
    console.log(
      `  Ungraded headline: ${USD.format(ungraded.amount)} (best of ${allUngraded.length} ${
        allUngraded.length === 1 ? "source" : "sources"
      })`,
    );
    if (allUngraded.length > 1) {
      const sorted = [...allUngraded].sort((a, b) => b.amount - a.amount);
      console.log(
        `     per source: ${sorted
          .map((q) => `${SOURCE_LABELS[q.source]}=${USD.format(q.amount)}`)
          .join(" · ")}`,
      );
    }
  } else {
    console.log(`  Ungraded headline: (none)`);
  }
  if (ladder.length > 0) {
    console.log(`  Graded ladder (${ladder.length} tiers):`);
    for (const { tier, best } of ladder) {
      console.log(
        `     ${TIER_LABELS[tier].padEnd(10)} ${USD.format(best.amount).padStart(12)}  (${SOURCE_LABELS[best.source]})`,
      );
    }
  } else {
    console.log(`  Graded ladder: (none)`);
  }
}

console.log(`\n==== summary ====`);
console.log(`  PriceCharting: hits=${pcHits} misses=${pcMisses}`);
console.log(`  Total merged quotes across ${FIXTURES.length} cards: ${allMergedQuotes.reduce((s, x) => s + x.quotes.length, 0)}`);
console.log(`  Per-source quote counts:`);
const bySource: Record<string, number> = {};
for (const { quotes } of allMergedQuotes) for (const q of quotes) bySource[q.source] = (bySource[q.source] ?? 0) + 1;
for (const [src, n] of Object.entries(bySource)) console.log(`    ${SOURCE_LABELS[src as keyof typeof SOURCE_LABELS]}: ${n}`);
