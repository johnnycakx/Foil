// Session 46 (ADR-036) — regenerate the raster brand assets from the
// holofoil "spark" mark so /public stays in sync with components/brand/logo.tsx.
//
//   node scripts/gen-brand-assets.mjs
//
// Writes public/apple-touch-icon.png (180×180, navy app-icon) and
// public/og-image.png (1200×630, cream share card). favicon.svg + icon.svg
// are authored by hand (vector); this script only rasterizes the PNGs.
//
// Text in the OG card renders via the system serif (Fraunces isn't
// installed system-wide); the mark + cream/navy palette carry the brand.

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// The spark mark in a 0 0 24 24 coordinate space, reused at every scale.
const sparkGroup = `
  <path d="M12 2 C 12.5 8.5, 15.5 11.5, 22 12 C 15.5 12.5, 12.5 15.5, 12 22 C 11.5 15.5, 8.5 12.5, 2 12 C 8.5 11.5, 11.5 8.5, 12 2 Z" fill="url(#g)"/>
  <path d="M20 2.3 C 20.2 3.8, 20.7 4.3, 22.2 4.5 C 20.7 4.7, 20.2 5.2, 20 6.7 C 19.8 5.2, 19.3 4.7, 17.8 4.5 C 19.3 4.3, 19.8 3.8, 20 2.3 Z" fill="#c9a24b" opacity="0.85"/>
  <path d="M4.7 15.9 C 4.85 17.1, 5.3 17.5, 6.5 17.6 C 5.3 17.7, 4.85 18.1, 4.7 19.3 C 4.55 18.1, 4.1 17.7, 2.9 17.6 C 4.1 17.5, 4.55 17.1, 4.7 15.9 Z" fill="#c9a24b" opacity="0.7"/>`;

const goldGradient = `
  <linearGradient id="g" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="#a07d2c"/>
    <stop offset="50%" stop-color="#e6c170"/>
    <stop offset="100%" stop-color="#c9a24b"/>
  </linearGradient>`;

// 180×180 navy app icon: rounded navy field + centred gold spark.
const appleIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>${goldGradient}</defs>
  <rect width="180" height="180" rx="40" fill="#0f1e3a"/>
  <g transform="translate(30 30) scale(5)">${sparkGroup}</g>
</svg>`;

// 1200×630 share card: cream field, gold spark, Fraunces/serif wordmark + tagline.
const ogCard = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>${goldGradient}</defs>
  <rect width="1200" height="630" fill="#f8f5f0"/>
  <g transform="translate(110 150) scale(3.5)">${sparkGroup}</g>
  <text x="108" y="395" font-family="Fraunces, Georgia, 'Times New Roman', serif" font-weight="700" font-size="150" fill="#0f1e3a" letter-spacing="-3">Foil</text>
  <text x="112" y="470" font-family="Georgia, 'Times New Roman', serif" font-size="48" fill="#4a5568">The best price on any Pokémon card.</text>
  <text x="112" y="525" font-family="-apple-system, 'Segoe UI', Arial, sans-serif" font-size="30" fill="#4a5568">Free wishlist alerts when a card you want drops in price.</text>
</svg>`;

await sharp(Buffer.from(appleIcon)).png().toFile(join(PUBLIC, "apple-touch-icon.png"));
await sharp(Buffer.from(ogCard)).png().toFile(join(PUBLIC, "og-image.png"));

console.log("Wrote public/apple-touch-icon.png (180×180) + public/og-image.png (1200×630)");
