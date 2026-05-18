import fs from "node:fs";
import path from "node:path";
import { priceCard, collectionTotalRawNm, type CardPricing } from "../lib/poketrace.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
if (!process.env.POKETRACE_API_KEY) throw new Error("POKETRACE_API_KEY missing");

const fixtures = [
  { name: "Charizard", set: "Base Set", cardNumber: "4/102", rarity: "Holo Rare (1st Edition)" },
  { name: "Pikachu", set: "Base Set", cardNumber: "58/102", rarity: "Common (1st Edition)" },
  { name: "Mewtwo", set: "Base Set", cardNumber: "10/102", rarity: "Holo Rare" },
  // Misidentified — wrong set
  { name: "Charizard", set: "Made-Up Set Name", cardNumber: "999/999", rarity: "Holo Rare" },
];

const results: CardPricing[] = [];
for (const f of fixtures) {
  const start = Date.now();
  const p = await priceCard(f);
  const ms = Date.now() - start;
  console.log(`\n[${f.name} | ${f.set} #${f.cardNumber}] (${ms}ms)`);
  if (!p.matched) {
    console.log(`  ✗ ${p.reason}`);
  } else {
    console.log(
      `  ✓ matched: ${p.candidate.name} | ${p.candidate.set} #${p.candidate.cardNumber} | ${p.candidate.variant}`,
    );
    console.log(
      `    raw: ebay=${p.raw.ebayNearMintAvg ?? "—"} tcg=${p.raw.tcgplayerNearMintAvg ?? "—"} cm=${p.raw.cardmarketNearMintAvg ?? "—"}`,
    );
    if (p.topPrice) console.log(`    top: $${p.topPrice.amount} (${p.topPrice.sourceLabel})`);
    if (p.bestGraded)
      console.log(`    best graded: ${p.bestGraded.tier} @ ${p.bestGraded.source} = $${p.bestGraded.avg}`);
  }
  results.push(p);
}

console.log(`\n[total raw NM] $${collectionTotalRawNm(results)}`);
