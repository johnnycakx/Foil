import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const CELL_W = 420;
const CELL_H = 585;
const GAP = 24;
const PADDING = 30;
const COLS = 3;
const ROWS = 3;

const cardNumbers = [1, 8, 18, 26, 64, 92, 100, 131, 160];

const W = PADDING * 2 + COLS * CELL_W + (COLS - 1) * GAP;
const H = PADDING * 2 + ROWS * CELL_H + (ROWS - 1) * GAP;

console.log(`Composite size: ${W}x${H} for ${cardNumbers.length} cards`);

const composites: sharp.OverlayOptions[] = [];
for (let i = 0; i < cardNumbers.length; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const left = PADDING + col * (CELL_W + GAP);
  const top = PADDING + row * (CELL_H + GAP);
  const filename = `tmp/pe_${cardNumbers[i]}.png`;
  const input = await sharp(filename)
    .resize({ width: CELL_W, height: CELL_H, fit: "inside" })
    .toBuffer();
  composites.push({ input, left, top });
  console.log(`  pe_${cardNumbers[i]} @ (${left},${top})`);
}

const out = await sharp({
  create: {
    width: W,
    height: H,
    channels: 3,
    background: { r: 30, g: 41, b: 59 },
  },
})
  .composite(composites)
  .jpeg({ quality: 80 })
  .toBuffer();

const outPath = path.join("tmp", "prismatic-binder.jpg");
fs.writeFileSync(outPath, out);
console.log(`\nWrote ${outPath} (${out.length} bytes)`);
