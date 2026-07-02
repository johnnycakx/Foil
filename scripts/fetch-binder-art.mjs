// One-shot: self-host the SV-151 starter-line pocket art (binder-aesthetic-pass).
// Same rationale as ADR-056 (hero art): never depend on images.pokemontcg.io
// at render time. 280px-wide webp — pockets render ≤ ~200px.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const IDS = ["166", "167", "198", "168", "169", "199", "170", "171", "200"];
mkdirSync("public/binder", { recursive: true });
for (const n of IDS) {
  const url = `https://images.pokemontcg.io/sv3pt5/${n}_hires.png`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL sv3pt5-${n}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf).resize({ width: 280 }).webp({ quality: 82 }).toFile(`public/binder/sv3pt5-${n}.webp`);
  console.log(`OK public/binder/sv3pt5-${n}.webp`);
}
