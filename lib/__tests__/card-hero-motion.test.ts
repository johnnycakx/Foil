// Card-hero v2 Phase 1 MOTION tests (ADR-074). Covers the pure shimmer math, the
// sharp frame compositor, the renderCardHeroMotion soft-fail contract (the still
// is the guaranteed fallback at every layer), the encoder dimension guards, the
// bot.ts renderVideo wiring (additive; absent → still-only), and the bundle-size
// gate the spike promised. The real WASM encode is proven by an out-of-suite
// probe (SESSION-LOG 2026-06-27); here the encoder is injected so tests stay fast.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  shimmerCenter,
  shimmerOverlaySvg,
  composeShimmerFrame,
  renderCardHeroMotion,
  MOTION_W,
  MOTION_H,
  MOTION_FPS,
  MOTION_FRAMES,
} from "../social/card-motion.ts";
import { encodeFramesToMp4, type Mp4EncodeRequest } from "../social/mp4-encoder.ts";
import { runXBot, type XBotDeps } from "../social/bot.ts";
import type { DealData, SpotlightData } from "../social/post-text.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// --- pure shimmer math: seamless loop ---

test("shimmerCenter sweeps off-frame→off-frame so the loop is seamless", () => {
  assert.ok(shimmerCenter(0, MOTION_FRAMES) < 0, "first frame: band off the left edge");
  assert.ok(shimmerCenter(MOTION_FRAMES - 1, MOTION_FRAMES) > 1, "last frame: band off the right edge");
  const mid = shimmerCenter(Math.floor((MOTION_FRAMES - 1) / 2), MOTION_FRAMES);
  assert.ok(mid > 0.4 && mid < 0.6, "mid-loop the band crosses the center");
});

test("shimmerOverlaySvg: no bright band when the center is off-frame (seam = band-free)", () => {
  const first = shimmerOverlaySvg(0, MOTION_FRAMES);
  // off-frame → peak opacity 0 on the middle stop.
  assert.match(first, /stop-opacity="0"\/><stop offset="1"/);
  assert.doesNotMatch(first, /stop-opacity="0\.3"/, "no visible band on the seam frame");
  const mid = shimmerOverlaySvg(Math.floor(MOTION_FRAMES / 2), MOTION_FRAMES);
  assert.match(mid, /stop-opacity="0\.3"/, "a real band mid-loop");
  // additive light, not a gray wash.
  assert.match(mid, /url\(#s\)/);
});

// --- the sharp compositor ---

async function tinyStill(): Promise<Buffer> {
  // a small stand-in for the Phase 0 1080x1350 still.
  return sharp({ create: { width: 216, height: 270, channels: 3, background: { r: 20, g: 35, b: 60 } } }).png().toBuffer();
}

test("composeShimmerFrame returns packed RGBA of exactly MOTION_W*MOTION_H*4", async () => {
  const base = await sharp(await tinyStill()).resize(MOTION_W, MOTION_H, { fit: "fill" }).png().toBuffer();
  const frame = await composeShimmerFrame(base, 30, MOTION_FRAMES);
  assert.equal(frame.length, MOTION_W * MOTION_H * 4);
  // deterministic: same i → same bytes (no randomness, so the loop is stable).
  const again = await composeShimmerFrame(base, 30, MOTION_FRAMES);
  assert.deepEqual(frame, again);
  // a different frame differs (the band moved).
  const other = await composeShimmerFrame(base, 31, MOTION_FRAMES);
  assert.notDeepEqual(frame, other);
});

// --- renderCardHeroMotion: drives the encoder, soft-fails to null ---

test("renderCardHeroMotion drives the encoder with even dims + the right frame budget", async () => {
  const seen: Mp4EncodeRequest[] = [];
  const encode = async (req: Mp4EncodeRequest) => {
    seen.push(req);
    // pull one frame to prove the producer yields valid RGBA.
    const f = await req.frameAt(10);
    assert.equal(f.length, req.width * req.height * 4);
    return Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]); // fake "ftyp" mp4
  };
  const out = await renderCardHeroMotion({ stillPng: await tinyStill(), encode });
  assert.ok(out instanceof Uint8Array && out.length > 0);
  assert.equal(seen.length, 1, "encoder was called once");
  const req = seen[0];
  assert.equal(req.width % 2, 0);
  assert.equal(req.height % 2, 0);
  assert.equal(req.width, MOTION_W);
  assert.equal(req.height, MOTION_H);
  assert.equal(req.fps, MOTION_FPS);
  assert.equal(req.frameCount, MOTION_FRAMES);
});

test("renderCardHeroMotion soft-fails to null when the encoder returns null", async () => {
  const out = await renderCardHeroMotion({ stillPng: await tinyStill(), encode: async () => null });
  assert.equal(out, null, "encode failure → null → caller posts the still");
});

test("renderCardHeroMotion soft-fails to null when the encoder throws (never propagates)", async () => {
  const out = await renderCardHeroMotion({ stillPng: await tinyStill(), encode: async () => { throw new Error("oom"); } });
  assert.equal(out, null);
});

test("renderCardHeroMotion soft-fails on a non-image still buffer (sharp throws)", async () => {
  const out = await renderCardHeroMotion({ stillPng: new Uint8Array([1, 2, 3, 4]), encode: async () => Buffer.from([1]) });
  assert.equal(out, null);
});

// --- encoder dimension guards (no WASM load needed) ---

test("encodeFramesToMp4 rejects odd dimensions and empty clips (returns null)", async () => {
  const frameAt = async () => new Uint8Array(4);
  assert.equal(await encodeFramesToMp4({ width: 721, height: 1080, fps: 24, frameCount: 1, frameAt }), null, "odd width");
  assert.equal(await encodeFramesToMp4({ width: 864, height: 1081, fps: 24, frameCount: 1, frameAt }), null, "odd height");
  assert.equal(await encodeFramesToMp4({ width: 864, height: 1080, fps: 24, frameCount: 0, frameAt }), null, "no frames");
});

// --- bot.ts renderVideo wiring (additive; still is the fallback) ---

const DEAL: DealData = { cardName: "Blastoise", setName: "Base Set", slug: "base1-2-blastoise", deltaPct: -16.8, soldReference: 120, matchedTier: "NEAR_MINT", saleCount: 51, computedAt: "2026-06-27T00:00:00Z", imageUrl: "https://img/x.png" };
const SPOT: SpotlightData = { cardName: "Charizard", setName: "Base Set", slug: "base1-4-charizard", soldReference: 350, sampleSize: 168, imageUrl: "https://img/c.png" };

function liveDeps(over: Partial<XBotDeps> = {}): XBotDeps {
  return {
    mode: "live",
    now: new Date("2026-06-08T14:00:00Z"),
    getDeals: async () => [DEAL],
    getSpotlight: async () => SPOT,
    generateText: async (input) => ({ text: `post ${input.angle} https://foiltcg.com/deals`, angle: input.angle, link: "https://foiltcg.com/deals", attempts: 1 }),
    renderImage: async () => new Uint8Array([1, 1, 1]),
    post: async () => ({ ok: true, postId: "1" }),
    review: async () => {},
    ...over,
  };
}

test("renderVideo result is attached to the draft and posted (motion is the default)", async () => {
  let postedVideo: Uint8Array | null = new Uint8Array();
  let postedImage: Uint8Array | null = null;
  await runXBot(liveDeps({
    renderVideo: async () => new Uint8Array([7, 7, 7]),
    post: async ({ imagePng, videoMp4 }) => { postedImage = imagePng; postedVideo = videoMp4; return { ok: true, postId: "1" }; },
  }));
  assert.deepEqual(postedVideo, new Uint8Array([7, 7, 7]), "the clip is posted when motion rendered");
  assert.deepEqual(postedImage, new Uint8Array([1, 1, 1]), "the still travels alongside as the upload-reject fallback");
});

test("renderVideo soft-fail (null) → the still is posted (videoMp4 null)", async () => {
  let postedVideo: Uint8Array | null = new Uint8Array();
  let postedImage: Uint8Array | null = null;
  await runXBot(liveDeps({
    renderVideo: async () => null,
    post: async ({ imagePng, videoMp4 }) => { postedImage = imagePng; postedVideo = videoMp4; return { ok: true, postId: "1" }; },
  }));
  assert.equal(postedVideo, null);
  assert.deepEqual(postedImage, new Uint8Array([1, 1, 1]));
});

test("renderVideo throwing never blocks the post (still goes out)", async () => {
  let posted = false;
  await runXBot(liveDeps({
    renderVideo: async () => { throw new Error("encode boom"); },
    post: async ({ videoMp4 }) => { posted = videoMp4 === null; return { ok: true, postId: "1" }; },
  }));
  assert.equal(posted, true, "an encode throw → null video → the still posts");
});

test("renderVideo is NOT called when there is no still to animate", async () => {
  let renderVideoCalls = 0;
  await runXBot(liveDeps({
    renderImage: async () => null,
    renderVideo: async () => { renderVideoCalls++; return new Uint8Array([9]); },
    post: async () => ({ ok: true, postId: "1" }),
  }));
  assert.equal(renderVideoCalls, 0, "motion is rendered FROM the still; no still → no motion");
});

// --- structural: motion is restrained + scoped (premium, not gimmicky) ---

test("card-motion keeps the number/arrow STATIC and uses additive light", () => {
  const src = readFileSync(join(ROOT, "lib/social/card-motion.ts"), "utf8");
  assert.match(src, /blend: "screen"/, "shimmer is additive light, not a gray wash");
  assert.doesNotMatch(src, /bigNumber|showArrow/, "the data (number/arrow) is never animated");
});

test("the cron scopes motion to the card-hero angles only (board/educational stay still)", () => {
  const cron = readFileSync(join(ROOT, "app/api/cron/x-post/route.ts"), "utf8");
  assert.match(cron, /renderVideo:/, "the cron wires the motion renderer");
  assert.match(cron, /input\.angle !== "deal_of_day" && input\.angle !== "price_spotlight"\) return null/);
  assert.match(cron, /renderCardHeroMotion/);
});

// --- bundle-size gate (the spike's required Phase 1 guard) ---

test("bundle-size gate: the MP4 encoder dep is declared + small (well under Vercel's function limit)", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { dependencies: Record<string, string> };
  assert.ok(pkg.dependencies["h264-mp4-encoder"], "the encoder is a declared dependency");
  assert.match(pkg.dependencies["h264-mp4-encoder"], /^[\^~]?1\./, "pinned to the validated v1.x");
  // The shipped node build (embedded WASM) must stay small; Next leaves it external.
  const dist = join(ROOT, "node_modules/h264-mp4-encoder/embuild/dist/h264-mp4-encoder.node.js");
  const bytes = readFileSync(dist).length;
  assert.ok(bytes < 4 * 1024 * 1024, `encoder build ${(bytes / 1048576).toFixed(2)}MB must stay < 4MB`);
});
