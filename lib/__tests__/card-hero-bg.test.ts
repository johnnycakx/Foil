// Card-derived background pipeline (card-bg.ts). Runs in node (sharp is native).
// v2.1 (ADR-074 amendment): the background is a CLEAN navy -> dominant-tinted-navy
// gradient + the dominant glow halo (NOT a blurred card cover + vignette). Pins:
// dominant color, the finished bg is 1080x1350 PNG, blue-stays-bluish, and that
// the source uses the gradient path, not blur/vignette.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { dominantColor, deriveCardBackground, buildCardWorld, HERO_W, HERO_H } from "../social/card-bg.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CARD_BG = readFileSync(join(ROOT, "lib/social/card-bg.ts"), "utf8");

async function solidCard(r: number, g: number, b: number, w = 420, h = 588): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

test("dominantColor: a solid card returns ~that color", async () => {
  const dom = await dominantColor(await solidCard(40, 120, 200));
  assert.ok(Math.abs(dom.r - 40) <= 2 && Math.abs(dom.g - 120) <= 2 && Math.abs(dom.b - 200) <= 2, JSON.stringify(dom));
});

test("deriveCardBackground: produces a 1080x1350 PNG (the hero canvas, dims unchanged)", async () => {
  const bg = await deriveCardBackground({ r: 40, g: 120, b: 200 });
  const meta = await sharp(bg).metadata();
  assert.equal(meta.width, HERO_W);
  assert.equal(meta.height, HERO_H);
  assert.equal(meta.format, "png");
});

test("deriveCardBackground: a blue card yields a bluish navy world (never the raw bright card)", async () => {
  const bg = await deriveCardBackground({ r: 40, g: 120, b: 200 });
  const { channels } = await sharp(bg).stats();
  const [r, g, b] = channels.map((c) => c.mean);
  assert.ok(b > r, "blue card world keeps a blue cast");
  assert.ok(r < 120, "stays a dark navy field, not the raw bright card");
});

test("buildCardWorld: returns the background + the dominant color together", async () => {
  const { background, dominant } = await buildCardWorld(await solidCard(200, 60, 50));
  assert.equal((await sharp(background).metadata()).width, HERO_W);
  assert.ok(dominant.r > dominant.b, "a warm card yields a warm dominant");
});

test("card-bg source uses the clean GRADIENT path, not the blurred-card cover (v2.1)", () => {
  // the v2.1 fix: a two-stop linear gradient + the glow halo, built from the
  // dominant color only — NO blur and NO card-image cover.
  assert.match(CARD_BG, /linearGradient/, "two-stop navy -> tinted-navy gradient");
  assert.match(CARD_BG, /radialGradient[\s\S]*halo/, "the dominant-color glow halo is kept");
  assert.doesNotMatch(CARD_BG, /\.blur\(/, "no blurred card cover in v2.1");
  // deriveCardBackground takes only the dominant color now — it can't cover-fill
  // the card art if it never receives the art buffer.
  assert.match(CARD_BG, /deriveCardBackground\(dom: Rgb\)/, "background derives from the dominant color, not the card image");
});
