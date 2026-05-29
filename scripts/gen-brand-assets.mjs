// Session 47.3 (ADR-040) — regenerate the raster brand assets from the
// classic red/white pixel Pokeball mark so /public stays in sync with
// components/brand/logo.tsx (PokeballMark tone="classic").
//
//   node scripts/gen-brand-assets.mjs
//
// Writes public/apple-touch-icon.png (180×180) and public/og-image.png
// (1200×630). favicon.svg + icon.svg are authored by hand (vector); this
// script only rasterizes the PNGs. The mark is on a cream field; red dome
// + navy ("black") outline/band + white button + light bottom read as a
// classic Pokeball. Text in the OG card uses the system serif.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// Classic Pokeball on a 0 0 16 16 grid (matches logo.tsx, tone="classic"):
// navy disc (outline + band), red top interior, white bottom interior,
// white center button.
const pokeball = `
  <g fill="#0f1e3a">
    <rect x="6" y="0" width="4" height="1"/><rect x="4" y="1" width="8" height="1"/><rect x="3" y="2" width="10" height="1"/><rect x="2" y="3" width="12" height="1"/><rect x="2" y="4" width="12" height="1"/><rect x="1" y="5" width="14" height="1"/><rect x="1" y="6" width="14" height="1"/><rect x="0" y="7" width="16" height="1"/><rect x="0" y="8" width="16" height="1"/><rect x="1" y="9" width="14" height="1"/><rect x="1" y="10" width="14" height="1"/><rect x="2" y="11" width="12" height="1"/><rect x="2" y="12" width="12" height="1"/><rect x="3" y="13" width="10" height="1"/><rect x="4" y="14" width="8" height="1"/><rect x="6" y="15" width="4" height="1"/>
  </g>
  <g fill="#e63946">
    <rect x="5" y="1" width="6" height="1"/><rect x="4" y="2" width="8" height="1"/><rect x="3" y="3" width="10" height="1"/><rect x="3" y="4" width="10" height="1"/><rect x="2" y="5" width="12" height="1"/><rect x="2" y="6" width="12" height="1"/>
  </g>
  <g fill="#ffffff">
    <rect x="3" y="11" width="10" height="1"/><rect x="3" y="12" width="10" height="1"/><rect x="4" y="13" width="8" height="1"/><rect x="5" y="14" width="6" height="1"/><rect x="7" y="15" width="2" height="1"/>
  </g>
  <rect x="7" y="8" width="2" height="2" fill="#ffffff"/>`;

// 180×180 app icon: rounded cream field + centred classic Pokeball.
const appleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" shape-rendering="crispEdges">
  <rect width="180" height="180" rx="40" fill="#f8f5f0"/>
  <g transform="translate(18 18) scale(9)">${pokeball}</g>
</svg>`;

// 1200×630 share card: cream field, classic Pokeball, serif wordmark + tagline.
const ogCard = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8f5f0"/>
  <g transform="translate(112 150) scale(5.25)" shape-rendering="crispEdges">${pokeball}</g>
  <text x="108" y="395" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-weight="700" font-size="150" fill="#0f1e3a" letter-spacing="-3">Foil</text>
  <text x="112" y="470" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#4a5568">The best price on any Pokémon card.</text>
  <text x="112" y="525" font-family="-apple-system, 'Segoe UI', Arial, sans-serif" font-size="30" fill="#4a5568">Free wishlist alerts when a card you want drops in price.</text>
</svg>`;

await sharp(Buffer.from(appleIcon)).png().toFile(join(PUBLIC, "apple-touch-icon.png"));
await sharp(Buffer.from(ogCard)).png().toFile(join(PUBLIC, "og-image.png"));

console.log("Wrote public/apple-touch-icon.png (180×180) + public/og-image.png (1200×630)");
