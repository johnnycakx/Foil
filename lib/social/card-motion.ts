// Card-hero motion layer (ADR-074 Phase 1). Turns the locked Phase 0 STILL into
// a short, seamless, premium "holo shimmer" loop — a soft diagonal light band
// sweeping across the frame once per loop, like tilting a holofoil under light.
//
// The cost insight from the Phase 0.5 spike: motion is NOT N Satori re-renders.
// It is 1 static base (the Phase 0 PNG) + N cheap sharp shimmer composites
// (~25ms/frame) + 1 encode. The number stays STATIC (the data is the message;
// animating the % reads as gimmicky; the red arrow was removed in v2.1). This
// file owns the sharp side; the encode goes through the injected `Mp4Encoder`
// (mp4-encoder.ts).
//
// FORMAT (spike decision, ADR-074): MP4 (H.264), portrait, `media_category=
// tweet_video`. Dimensions keep the Phase 0 4:5 aspect (no distortion) at
// 864x1080 — both even (H.264), max dim 1080 (≤ X's 1280 cap), aspect 0.8
// (within X's 1:3..3:1). GIF was rejected (X caps GIF at 1280x1080 so portrait
// must downscale; 256-color banding is off-brand; 9-13MB busts Discord's 10MB
// preview cap). See docs.x.com/x-api/media/quickstart/best-practices.
//
// SOFT-FAIL: renderCardHeroMotion returns null on any failure → the caller posts
// the still. Motion is strictly additive; the still is the guaranteed fallback.

import sharp from "sharp";
import { encodeFramesToMp4, type Mp4Encoder } from "./mp4-encoder.ts";

// 0.8x of the Phase 0 1080x1350 still → preserves composition exactly. Both even.
export const MOTION_W = 864;
export const MOTION_H = 1080;
export const MOTION_FPS = 24;
/** 60 frames @ 24fps = a 2.5s loop (spike target: ~2.5-3s, 24fps). */
export const MOTION_FRAMES = 60;

/** Peak shimmer-band opacity. Restrained (soft-skill register, not crypto-flash). */
const SHIMMER_PEAK = 0.3;
/** Half-width of the bright band, in sweep-fraction units (feathered edges). */
const SHIMMER_HALF = 0.14;
/** The band travels from off-frame-left (-PAD) to off-frame-right (1+PAD) so the
 *  first and last frames are both band-free → a seamless autoplay loop. */
const SHIMMER_PAD = 0.18;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** The sweep center for frame `i` of `total`: -PAD → 1+PAD across the loop. */
export function shimmerCenter(i: number, total: number): number {
  if (total <= 1) return 0.5;
  const t = i / (total - 1);
  return -SHIMMER_PAD + t * (1 + 2 * SHIMMER_PAD);
}

/**
 * Build the per-frame shimmer overlay as an SVG. A diagonal linear-gradient with
 * a single feathered bright window centered at the swept position. The window's
 * peak opacity is zero whenever its center is off-frame (center ≤0 or ≥1), which
 * is what makes the loop seamless. Pure + deterministic (no randomness).
 */
export function shimmerOverlaySvg(i: number, total: number, w = MOTION_W, h = MOTION_H): string {
  const p = shimmerCenter(i, total);
  const onFrame = p > 0 && p < 1;
  const peak = onFrame ? SHIMMER_PEAK : 0;
  const lo = clamp01(p - SHIMMER_HALF);
  const mid = clamp01(p);
  const hi = clamp01(p + SHIMMER_HALF);
  // Monotonic-increasing offsets in (0,1); endpoints pinned transparent.
  const a = Math.min(Math.max(lo, 0.0001), 0.9997);
  const b = Math.min(Math.max(mid, a + 0.0001), 0.9998);
  const c = Math.min(Math.max(hi, b + 0.0001), 0.9999);
  return (
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="0.55">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="${a.toFixed(4)}" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="${b.toFixed(4)}" stop-color="#fff8e6" stop-opacity="${peak}"/>` +
    `<stop offset="${c.toFixed(4)}" stop-color="#ffffff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#s)"/></svg>`
  );
}

/**
 * Composite the shimmer band for frame `i` over the prepared base, returning
 * packed RGBA bytes (MOTION_W*MOTION_H*4) for the encoder. The band uses `screen`
 * blend (additive light) so it reads as a highlight sweeping over the art, never
 * a gray wash. `base` is the still already resized to MOTION_W x MOTION_H.
 */
export async function composeShimmerFrame(baseImage: Buffer, i: number, total: number): Promise<Uint8Array> {
  const svg = Buffer.from(shimmerOverlaySvg(i, total));
  const raw = await sharp(baseImage)
    .composite([{ input: svg, blend: "screen" }])
    .ensureAlpha()
    .raw()
    .toBuffer();
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

/**
 * Render the card-hero MOTION clip from the Phase 0 still. Resizes the still to
 * the motion frame size ONCE, then streams N shimmer composites through the
 * injected encoder. Returns the MP4 bytes, or null on ANY failure (the caller
 * then posts the still — the guaranteed fallback).
 *
 * `encode` is injected (default = the real h264 encoder) so the whole path is
 * unit-testable without loading the WASM encoder.
 */
export async function renderCardHeroMotion(input: {
  stillPng: Uint8Array | Buffer;
  encode?: Mp4Encoder;
  frames?: number;
  fps?: number;
}): Promise<Uint8Array | null> {
  const frames = input.frames ?? MOTION_FRAMES;
  const fps = input.fps ?? MOTION_FPS;
  const encode = input.encode ?? encodeFramesToMp4;
  try {
    // Resize the still to the exact motion frame size once (fill = same 4:5
    // aspect, no crop/distortion). Flatten alpha onto the still's own pixels.
    const base = await sharp(Buffer.from(input.stillPng))
      .resize(MOTION_W, MOTION_H, { fit: "fill" })
      .png()
      .toBuffer();

    const mp4 = await encode({
      width: MOTION_W,
      height: MOTION_H,
      fps,
      frameCount: frames,
      frameAt: (i) => composeShimmerFrame(base, i, frames),
    });
    return mp4 ? new Uint8Array(mp4) : null;
  } catch (err) {
    console.warn("[card-motion] render failed:", (err as Error).message);
    return null;
  }
}
