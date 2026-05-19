import fs from "node:fs";
import path from "node:path";
import { priceCard, type CardPricing } from "../lib/poketrace.ts";
import { bestUngraded, gradedLadder, collectionUngradedTotal, SOURCE_LABELS, TIER_LABELS } from "../lib/pricing.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
if (!process.env.POKETRACE_API_KEY) throw new Error("POKETRACE_API_KEY missing");

const fixtures = [
  { name: "Charizard", setCode: "Base Set", collectorNumber: "4/102", rarity: "Holo Rare (1st Edition)" },
  { name: "Pikachu", setCode: "Base Set", collectorNumber: "58/102", rarity: "Common (1st Edition)" },
  { name: "Mewtwo", setCode: "Base Set", collectorNumber: "10/102", rarity: "Holo Rare" },
  // Misidentified — wrong set
  { name: "Charizard", setCode: "Made-Up Set Name", collectorNumber: "999/999", rarity: "Holo Rare" },
  // Null-field regressions (the bug from the field)
  { name: "Charizard", setCode: "Base Set", collectorNumber: null, rarity: "Holo Rare" },
  { name: "Pikachu", setCode: null, collectorNumber: "58/102", rarity: "Common" },
  { name: null, setCode: "Base Set", collectorNumber: "4/102", rarity: "Holo Rare" },
  { name: "Mewtwo", setCode: "Base Set", collectorNumber: null, rarity: null },
];

const results: CardPricing[] = [];
for (const f of fixtures) {
  const start = Date.now();
  const p = await priceCard(f);
  const ms = Date.now() - start;
  console.log(
    `\n[${f.name ?? "(no name)"} | ${f.setCode ?? "(no set)"} #${f.collectorNumber ?? "(no number)"}] (${ms}ms)`,
  );
  if (!p.matched) {
    console.log(`  ✗ ${p.reason}`);
  } else {
    console.log(
      `  ✓ matched: ${p.candidate.name} | ${p.candidate.set} #${p.candidate.cardNumber} | ${p.candidate.variant}`,
    );
    const ungraded = bestUngraded(p.quotes);
    if (ungraded)
      console.log(
        `    ungraded: $${ungraded.amount} (${SOURCE_LABELS[ungraded.source]})${p.lowConfidence ? " [low_confidence]" : ""}`,
      );
    else console.log(`    ungraded: —`);
    const ladder = gradedLadder(p.quotes);
    for (const { tier, best } of ladder) {
      console.log(`    ${TIER_LABELS[tier]}: $${best.amount} (${SOURCE_LABELS[best.source]})`);
    }
  }
  results.push(p);
}

const matched = results.filter((p): p is Extract<CardPricing, { matched: true }> => p.matched);
console.log(`\n[total ungraded] $${collectionUngradedTotal(matched)}`);
