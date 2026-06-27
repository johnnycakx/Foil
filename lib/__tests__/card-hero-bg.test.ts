// Card-derived background pipeline (card-bg.ts). Runs in node (sharp is native).
// Pins: dominant color, the finished bg is 1080x1350 PNG, soft inputs.

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { dominantColor, deriveCardBackground, buildCardWorld, HERO_W, HERO_H } from "../social/card-bg.ts";

async function solidCard(r: number, g: number, b: number, w = 420, h = 588): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

test("dominantColor: a solid card returns ~that color", async () => {
  const dom = await dominantColor(await solidCard(40, 120, 200));
  assert.ok(Math.abs(dom.r - 40) <= 2 && Math.abs(dom.g - 120) <= 2 && Math.abs(dom.b - 200) <= 2, JSON.stringify(dom));
});

test("deriveCardBackground: produces a 1080x1350 PNG (the hero canvas)", async () => {
  const bg = await deriveCardBackground(await solidCard(40, 120, 200), { r: 40, g: 120, b: 200 });
  const meta = await sharp(bg).metadata();
  assert.equal(meta.width, HERO_W);
  assert.equal(meta.height, HERO_H);
  assert.equal(meta.format, "png");
});

test("deriveCardBackground: blends the navy undertone (a blue card stays bluish, never the raw card)", async () => {
  const bg = await deriveCardBackground(await solidCard(40, 120, 200), { r: 40, g: 120, b: 200 });
  const { channels } = await sharp(bg).stats();
  const [r, g, b] = channels.map((c) => c.mean);
  assert.ok(b > r, "blue card world keeps a blue cast");
  assert.ok(r < 120, "darkened, not the raw bright card");
});

test("buildCardWorld: returns the background + the dominant color together", async () => {
  const { background, dominant } = await buildCardWorld(await solidCard(200, 60, 50));
  assert.equal((await sharp(background).metadata()).width, HERO_W);
  assert.ok(dominant.r > dominant.b, "a warm card yields a warm dominant");
});
