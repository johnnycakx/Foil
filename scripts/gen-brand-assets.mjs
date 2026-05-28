// Session 47.1 (ADR-038) — regenerate the raster brand assets from the
// navy pixel Pokeball mark so /public stays in sync with
// components/brand/logo.tsx.
//
//   node scripts/gen-brand-assets.mjs
//
// Writes public/apple-touch-icon.png (180×180) and public/og-image.png
// (1200×630). favicon.svg + icon.svg are authored by hand (vector); this
// script only rasterizes the PNGs. The mark is navy on a cream field
// (navy-on-cream reads at 16px); the center button is a cream "hole".
//
// Text in the OG card renders via the system serif (Fraunces isn't
// installed system-wide); the mark + cream/navy palette carry the brand.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// The pixel Pokeball on a 0 0 7 7 grid (matches logo.tsx PokeballMark):
// navy top + band, navy/75 bottom, cream button.
const pokeball = `
  <g fill="#0f1e3a">
    <rect x="2" y="0" width="3" height="1"/><rect x="1" y="1" width="5" height="1"/><rect x="0" y="2" width="7" height="1"/><rect x="0" y="3" width="7" height="1"/>
  </g>
  <g fill="#0f1e3a" opacity="0.75">
    <rect x="0" y="4" width="7" height="1"/><rect x="1" y="5" width="5" height="1"/><rect x="2" y="6" width="3" height="1"/>
  </g>
  <rect x="3" y="3" width="1" height="1" fill="#f8f5f0"/>`;

// 180×180 app icon: rounded cream field + centred navy Pokeball.
const appleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" shape-rendering="crispEdges">
  <rect width="180" height="180" rx="40" fill="#f8f5f0"/>
  <g transform="translate(30 30) scale(17)">${pokeball}</g>
</svg>`;

// 1200×630 share card: cream field, navy Pokeball, serif wordmark + tagline.
const ogCard = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8f5f0"/>
  <g transform="translate(112 150) scale(11)" shape-rendering="crispEdges">${pokeball}</g>
  <text x="108" y="395" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-weight="700" font-size="150" fill="#0f1e3a" letter-spacing="-3">Foil</text>
  <text x="112" y="470" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#4a5568">The best price on any Pokémon card.</text>
  <text x="112" y="525" font-family="-apple-system, 'Segoe UI', Arial, sans-serif" font-size="30" fill="#4a5568">Free wishlist alerts when a card you want drops in price.</text>
</svg>`;

await sharp(Buffer.from(appleIcon)).png().toFile(join(PUBLIC, "apple-touch-icon.png"));
await sharp(Buffer.from(ogCard)).png().toFile(join(PUBLIC, "og-image.png"));

console.log("Wrote public/apple-touch-icon.png (180×180) + public/og-image.png (1200×630)");
