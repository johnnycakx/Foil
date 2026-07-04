// Backfill the hero-belt small (300px) srcset variants (homepage-mobile-perf).
// For each public/belt/<slug>.webp (the crisp 480px base, left UNTOUCHED), emit
// <slug>-sm.webp at 300px so the belt <img srcset> can serve low-DPR phones a
// much smaller face. The base stays q80 (crispness is sacred); the sm variant is
// a downscale (re-encode artifacts are hidden by the downscale). Pool artifact is
// NOT touched — the wheel composition is preserved.
//
// Run: node --experimental-strip-types --no-warnings scripts/optimize-hero-belt.ts
// Idempotent (skips existing -sm files). The generator (generate-hero-belt.ts)
// emits both sizes for future re-bakes; this backfills the already-downloaded set.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = join(process.cwd(), "public", "belt");
const SM_WIDTH = 300;
const SM_QUALITY = 76;

let made = 0;
let skipped = 0;
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".webp") || f.endsWith("-sm.webp")) continue;
  const base = join(DIR, f);
  const sm = base.replace(/\.webp$/, "-sm.webp");
  if (existsSync(sm)) {
    skipped++;
    continue;
  }
  const buf = readFileSync(base);
  await sharp(buf).resize({ width: SM_WIDTH, withoutEnlargement: true }).webp({ quality: SM_QUALITY }).toFile(sm);
  made++;
}
console.log(`hero-belt sm variants: made ${made}, skipped ${skipped}`);
