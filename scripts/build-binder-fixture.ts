import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const CELL_W = 480;
const CELL_H = 670;
const GAP = 30;
const PADDING = 40;
const COLS = 2;
const ROWS = 2;

const cards = [
  { file: "tmp/charizard.png", name: "Charizard" },
  { file: "tmp/pikachu.png", name: "Pikachu" },
  { file: "tmp/mewtwo.png", name: "Mewtwo" },
  { file: "tmp/blastoise.png", name: "Blastoise" },
];

const W = PADDING * 2 + COLS * CELL_W + (COLS - 1) * GAP;
const H = PADDING * 2 + ROWS * CELL_H + (ROWS - 1) * GAP;

console.log(`Composite size: ${W}x${H}`);

const composites: sharp.OverlayOptions[] = [];
for (let i = 0; i < cards.length; i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const left = PADDING + col * (CELL_W + GAP);
  const top = PADDING + row * (CELL_H + GAP);
  const input = await sharp(cards[i].file)
    .resize({ width: CELL_W, height: CELL_H, fit: "inside" })
    .toBuffer();
  composites.push({ input, left, top });
  console.log(`  ${cards[i].name} @ (${left},${top})`);
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
  .jpeg({ quality: 88 })
  .toBuffer();

const outPath = path.join("tmp", "binder.jpg");
fs.writeFileSync(outPath, out);
console.log(`\nWrote ${outPath} (${out.length} bytes)`);
