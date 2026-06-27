// Card-derived background generator (ADR-072 follow-up — the card-hero X image).
//
// Satori (next/og) CANNOT Gaussian-blur, so the card's "own world" background is
// pre-rendered here with sharp (already a dependency, see lib/crop.ts), then
// Satori composes the sharp card + text over it. This ports the validated
// `derived_bg` algorithm from docs/social/ref/card-hero-prototype.py:
//   cover-fill the card art -> heavy blur -> darken -> blend a navy undertone
//   (brand cohesion) -> a dominant-color glow halo behind the card -> vignette.
// So a blue card yields a blue world, a Charizard a warm one, always carrying
// Foil's navy/gold identity. Server-only (sharp is native).

import sharp from "sharp";

export const HERO_W = 1080;
export const HERO_H = 1350;

/** Brand navy undertone blended into every derived background (DESIGN.md). */
const NAVY = { r: 15, g: 30, b: 58 };
/** Heavy blur so no card detail survives (the prototype used PIL GaussianBlur(85)). */
export const BG_BLUR_SIGMA = 50;
/** Navy undertone strength (prototype: 28%). */
const NAVY_OPACITY = 0.28;
/** Dominant-color glow strength behind the card (prototype halo ~0.32-0.42). */
const HALO_OPACITY = 0.42;
/** Edge darkening (prototype vignette dropped edges to ~0.42 brightness). */
const VIGNETTE_OPACITY = 0.58;

export type Rgb = { r: number; g: number; b: number };

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** The card art's mean color — its "world" tint (port of prototype `dominant`). */
export async function dominantColor(art: Buffer): Promise<Rgb> {
  const stats = await sharp(art).removeAlpha().stats();
  const [r, g, b] = stats.channels;
  return { r: clampByte(r.mean), g: clampByte(g.mean), b: clampByte(b.mean) };
}

/**
 * Render the card's world as a finished 1080x1350 PNG background. Pre-blurred +
 * composited entirely with sharp (Satori can't blur). Returns the PNG buffer.
 */
export async function deriveCardBackground(art: Buffer, dom: Rgb): Promise<Buffer> {
  // 1. cover-fill the frame, heavy blur, darken to ~0.5.
  const base = await sharp(art)
    .resize(HERO_W, HERO_H, { fit: "cover" })
    .removeAlpha()
    .blur(BG_BLUR_SIGMA)
    .linear(0.5, 0) // darken: out = 0.5*in
    .png()
    .toBuffer();

  // 2. overlays: navy undertone (over), dominant-color glow (screen = additive
  //    lightening, the glow), vignette (over = edge darkening).
  const navy = `<svg width="${HERO_W}" height="${HERO_H}"><rect width="100%" height="100%" fill="rgb(${NAVY.r},${NAVY.g},${NAVY.b})" opacity="${NAVY_OPACITY}"/></svg>`;
  const halo = `<svg width="${HERO_W}" height="${HERO_H}"><defs><radialGradient id="h" cx="50%" cy="34%" r="55%"><stop offset="0%" stop-color="rgb(${dom.r},${dom.g},${dom.b})" stop-opacity="${HALO_OPACITY}"/><stop offset="100%" stop-color="rgb(${dom.r},${dom.g},${dom.b})" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#h)"/></svg>`;
  const vignette = `<svg width="${HERO_W}" height="${HERO_H}"><defs><radialGradient id="v" cx="50%" cy="42%" r="78%"><stop offset="38%" stop-color="rgb(0,0,0)" stop-opacity="0"/><stop offset="100%" stop-color="rgb(0,0,0)" stop-opacity="${VIGNETTE_OPACITY}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;

  return sharp(base)
    .composite([
      { input: Buffer.from(navy), blend: "over" },
      { input: Buffer.from(halo), blend: "screen" },
      { input: Buffer.from(vignette), blend: "over" },
    ])
    .png()
    .toBuffer();
}

/**
 * Full pipeline for a card: derive its world background AND its dominant color
 * (the Satori template uses the dominant for the card's glow halo). Returns null
 * inputs untouched — callers handle a null art buffer by falling back.
 */
export async function buildCardWorld(art: Buffer): Promise<{ background: Buffer; dominant: Rgb }> {
  const dominant = await dominantColor(art);
  const background = await deriveCardBackground(art, dominant);
  return { background, dominant };
}
