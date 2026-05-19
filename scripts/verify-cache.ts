// One-off check: cacheCardImage idempotently caches a PokeTrace image to
// the Supabase Storage bucket and returns the public URL.
//
// Usage:
//   node --experimental-strip-types --no-warnings scripts/verify-cache.ts

import fs from "node:fs";
import path from "node:path";
import { cacheCardImage } from "../lib/poketrace.ts";

const envPath = path.join(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

// Base Set Charizard from PokeTrace, well-known stable URL.
const CARD_ID = "019bff77-befa-771d-bab0-f5909f0a78c9";
const SOURCE = "https://cdn.poketrace.com/cards/d64defcfc64ff4ea.webp";

console.log("[verify-cache] first call (cold cache)");
const t1 = Date.now();
const cached1 = await cacheCardImage(CARD_ID, SOURCE);
console.log(`  ${Date.now() - t1}ms → ${cached1}`);

console.log("[verify-cache] second call (warm cache)");
const t2 = Date.now();
const cached2 = await cacheCardImage(CARD_ID, SOURCE);
console.log(`  ${Date.now() - t2}ms → ${cached2}`);

if (!cached1 || !cached2) {
  console.error("expected non-null cached URL");
  process.exit(1);
}
if (cached1 !== cached2) {
  console.error(`expected same URL on second call. got ${cached1} vs ${cached2}`);
  process.exit(1);
}

// Fetch the cached URL and confirm we get image bytes back.
const r = await fetch(cached1);
const ct = r.headers.get("content-type");
const len = Number(r.headers.get("content-length") ?? "0");
console.log(`[verify-cache] HEAD cached URL: ${r.status} ${ct} ${len}B`);
if (!r.ok || !ct?.startsWith("image/")) {
  console.error("cached URL did not serve an image");
  process.exit(1);
}
console.log("[verify-cache] ✓ cache round-trip works");
