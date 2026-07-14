// Dry-run artifact for alert-digest-batching: renders the batched alert email
// to file so the send-path change is verified on a REAL rendering before any
// live send. The 12:01 PM run's exact events are NOT reconstructable (no
// per-run event log exists; per-row state is overwritten each run — see the
// goal's P0 findings), so the entries below are an honest RECONSTRUCTION of
// John's reported inbox: 7 cards in one run, including the Blastoise
// duplicate (one explicit-target row + one blank-target/market row for the
// same card — which the batcher now merges to one entry, target framing
// winning). Figures are plausible, labeled illustrative.
//
// Usage: node --experimental-strip-types scripts/render-batched-alert-preview.ts

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  batchEmailBody,
  batchSubjectLine,
  type AlertEmailInputs,
} from "../lib/wishlist/alert-email.ts";

const base = {
  unsubscribeUrl: "https://foiltcg.com/api/unsubscribe?token=preview",
  manageUrl: "https://foiltcg.com/w/preview",
} as const;

const entry = (over: Partial<AlertEmailInputs> & Pick<AlertEmailInputs, "cardName" | "setName" | "currentPriceCents">): AlertEmailInputs => ({
  kind: "already_below",
  basis: "market",
  targetPriceCents: null,
  comp: null,
  cardPageUrl: `https://foiltcg.com/cards/preview`,
  variantLabel: undefined,
  conditionLabel: undefined,
  ...base,
  ...over,
});

// The merged Blastoise entry — the target framing won the dedupe; its
// evidence line carries the market comparison, so both original framings
// ("at your $500" AND "51% under its average") are present in ONE section.
const ENTRIES: AlertEmailInputs[] = [
  entry({
    cardName: "Blastoise",
    setName: "Base",
    currentPriceCents: 48900,
    kind: "already_below",
    basis: "target",
    targetPriceCents: 50000,
    comp: { avg30dCents: 99800, saleCount: 53, tierLabel: "Near Mint", computedAt: new Date().toISOString(), soldAsOfIso: new Date(Date.now() - 3 * 86400000).toISOString() },
    cardPageUrl: "https://foiltcg.com/cards/base1-2-blastoise",
  }),
  entry({
    cardName: "Charizard",
    setName: "Base",
    currentPriceCents: 41200,
    basis: "market",
    comp: { avg30dCents: 52100, saleCount: 38, tierLabel: "Near Mint", computedAt: new Date().toISOString(), soldAsOfIso: new Date(Date.now() - 3 * 86400000).toISOString() },
    cardPageUrl: "https://foiltcg.com/cards/base1-4-charizard",
  }),
  entry({
    cardName: "Umbreon VMAX",
    setName: "Evolving Skies",
    currentPriceCents: 184500,
    kind: "dropped",
    basis: "target",
    targetPriceCents: 190000,
    comp: { avg30dCents: 221400, saleCount: 27, tierLabel: "Near Mint", computedAt: new Date().toISOString(), soldAsOfIso: new Date(Date.now() - 3 * 86400000).toISOString() },
    cardPageUrl: "https://foiltcg.com/cards/swsh7-215-umbreon-vmax-alt-art",
    variantLabel: "Alt Art",
  }),
  entry({
    cardName: "Lugia V",
    setName: "Silver Tempest",
    currentPriceCents: 11800,
    basis: "market",
    comp: { avg30dCents: 14900, saleCount: 41, tierLabel: "Near Mint", computedAt: new Date().toISOString(), soldAsOfIso: new Date(Date.now() - 3 * 86400000).toISOString() },
    cardPageUrl: "https://foiltcg.com/cards/swsh12-186-lugia-v-alt-art",
  }),
  entry({
    cardName: "Giratina V",
    setName: "Lost Origin",
    currentPriceCents: 16200,
    kind: "dropped",
    basis: "market",
    comp: { avg30dCents: 18900, saleCount: 33, tierLabel: "Near Mint", computedAt: new Date().toISOString(), soldAsOfIso: new Date(Date.now() - 3 * 86400000).toISOString() },
    cardPageUrl: "https://foiltcg.com/cards/swsh11-186-giratina-v-alt-art",
  }),
  entry({
    cardName: "Mew VMAX",
    setName: "Fusion Strike",
    currentPriceCents: 9100,
    basis: "target",
    targetPriceCents: 9500,
    comp: null,
    cardPageUrl: "https://foiltcg.com/cards/swsh8-269-mew-vmax-alt-art",
  }),
  entry({
    cardName: "Rayquaza VMAX",
    setName: "Evolving Skies",
    currentPriceCents: 39800,
    basis: "market",
    comp: { avg30dCents: 45200, saleCount: 22, tierLabel: "Near Mint", computedAt: new Date().toISOString(), soldAsOfIso: new Date(Date.now() - 3 * 86400000).toISOString() },
    cardPageUrl: "https://foiltcg.com/cards/swsh7-218-rayquaza-vmax-alt-art",
  }),
];

const outDir = join(process.cwd(), "docs", "goals", "_results");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "batched-email-preview.html");
const subject = batchSubjectLine(ENTRIES.length);
writeFileSync(
  out,
  `<!-- SUBJECT: ${subject} -->\n${batchEmailBody(ENTRIES)}`,
  "utf8",
);
console.log(`subject: ${subject}`);
console.log(`written: ${out}`);
