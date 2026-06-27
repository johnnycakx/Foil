// Card-derived background generator (ADR-073; v2.1 simplification per the
// ADR-074 amendment).
//
// v2.0 derived a "world" by cover-filling the card art, heavy-blurring it,
// darkening, tinting navy, then vignetting. To the human eye that read as a
// muddy blurred screenshot of the card behind itself. v2.1 replaces the blurred
// CARD-IMAGE background with a CLEAN two-stop gradient: brand navy easing into a
// navy *tinted* by the card's dominant color (so a blue card still gives a
// bluish world, brand-cohesive without the mess). The one part that read as
// premium is KEPT: the soft dominant-color glow halo behind the card. No blurred
// cover, no heavy vignette.
//
// Still built with sharp (not Satori): Satori can't render a radial-gradient
// glow reliably, and keeping background generation in one place lets the same
// dominant color drive both the field tint and the card's box-shadow glow in the
// template. Server-only (sharp is native).

import sharp from "sharp";

export const HERO_W = 1080;
export const HERO_H = 1350;

/** Brand navy — the base of the field (DESIGN.md). */
const NAVY = { r: 15, g: 30, b: 58 };
/** How much the card's dominant color tints the navy at the gradient's far stop.
 *  Low enough that the world stays unmistakably navy/brand, high enough that a
 *  blue card reads bluish and a red card reads warm. */
const TINT_WEIGHT = 0.4;
/** Dominant-color glow strength behind the card (kept from v2.0 — the one part
 *  that read as premium). */
const HALO_OPACITY = 0.45;

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

/** Blend the dominant color into navy by `w` (0 = pure navy, 1 = pure dominant). */
function tintNavy(dom: Rgb, w: number): Rgb {
  return {
    r: clampByte(NAVY.r * (1 - w) + dom.r * w),
    g: clampByte(NAVY.g * (1 - w) + dom.g * w),
    b: clampByte(NAVY.b * (1 - w) + dom.b * w),
  };
}

/**
 * Render the card's world as a finished 1080x1350 PNG background (v2.1). A clean
 * vertical gradient (navy -> navy tinted by `dom`) with the soft dominant-color
 * glow halo behind where the card sits. Composited as a single SVG so sharp
 * rasterizes the gradient + halo in one pass.
 */
export async function deriveCardBackground(dom: Rgb): Promise<Buffer> {
  const tinted = tintNavy(dom, TINT_WEIGHT);
  const svg =
    `<svg width="${HERO_W}" height="${HERO_H}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<linearGradient id="field" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="rgb(${NAVY.r},${NAVY.g},${NAVY.b})"/>` +
    `<stop offset="100%" stop-color="rgb(${tinted.r},${tinted.g},${tinted.b})"/>` +
    `</linearGradient>` +
    `<radialGradient id="halo" cx="50%" cy="34%" r="52%">` +
    `<stop offset="0%" stop-color="rgb(${dom.r},${dom.g},${dom.b})" stop-opacity="${HALO_OPACITY}"/>` +
    `<stop offset="100%" stop-color="rgb(${dom.r},${dom.g},${dom.b})" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#field)"/>` +
    `<rect width="100%" height="100%" fill="url(#halo)"/>` +
    `</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Full pipeline for a card: the dominant color (the template uses it for the
 * card's glow halo box-shadow) + the clean gradient world it drives.
 */
export async function buildCardWorld(art: Buffer): Promise<{ background: Buffer; dominant: Rgb }> {
  const dominant = await dominantColor(art);
  const background = await deriveCardBackground(dominant);
  return { background, dominant };
}
