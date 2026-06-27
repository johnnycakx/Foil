// MP4 (H.264) encode boundary for the card-hero motion path (ADR-074 Phase 1).
//
// THE ONLY module that touches the video encoder dependency. Like x-client.ts is
// the single X boundary and card-bg.ts the single sharp-derived-world boundary,
// this isolates `h264-mp4-encoder` (a self-contained WASM H.264 encoder, ~1.7MB,
// no native build) so the rest of the codebase depends on the abstract
// `Mp4Encoder` type, never the package.
//
// SOFT-FAIL CONTRACT: every path returns null on any failure (missing/broken
// dep, bad dimensions, OOM, encoder throw). A null bubbles up to
// renderCardHeroMotion → the cron, which then posts the Phase 0 STILL instead —
// the guaranteed fallback. Motion can never crash the cron or block a post.
//
// The dep is imported DYNAMICALLY (await import) so (a) a missing package can't
// break `next build` / `tsc`, (b) the WASM only loads when motion actually
// renders (the daily cron), not on every cold start. The package is also listed
// in next.config.ts `serverExternalPackages` so Next leaves it as a runtime
// require rather than bundling the embedded WASM.

/** A single RGBA frame: exactly width*height*4 bytes (alpha ignored by H.264). */
export type RgbaFrame = Uint8Array;

export type Mp4EncodeRequest = {
  /** Output width — MUST be even (H.264 macroblock constraint). */
  width: number;
  /** Output height — MUST be even. */
  height: number;
  /** Output frame rate. */
  fps: number;
  /** Total frames to pull. */
  frameCount: number;
  /** Produce frame `i` as packed RGBA bytes (width*height*4). Pulled one at a
   *  time so peak memory is ~one frame, not the whole clip. */
  frameAt: (i: number) => Promise<RgbaFrame>;
  /** H.264 quality [10..51], lower = better/bigger. Default 28 (premium-but-small). */
  quantizationParameter?: number;
  /** Keyframe period; default = fps (one keyframe/second → clean autoplay loop). */
  groupOfPictures?: number;
};

/** Encode RGBA frames → an MP4 (H.264) buffer, or null on any failure. */
export type Mp4Encoder = (req: Mp4EncodeRequest) => Promise<Buffer | null>;

type EncoderModule = {
  createH264MP4Encoder?: () => Promise<H264Encoder>;
  default?: { createH264MP4Encoder?: () => Promise<H264Encoder> };
};

type H264Encoder = {
  outputFilename: string;
  width: number;
  height: number;
  frameRate: number;
  quantizationParameter: number;
  groupOfPictures: number;
  speed: number;
  initialize(): void;
  addFrameRgba(buffer: Uint8Array): void;
  finalize(): void;
  delete(): void;
  FS: { readFile(path: string): Uint8Array };
};

/**
 * The production encoder. Dynamically imports `h264-mp4-encoder`, streams frames
 * in one at a time, and returns the finished MP4. Returns null on ANY error so
 * the caller falls back to the still. Never throws.
 */
export const encodeFramesToMp4: Mp4Encoder = async (req) => {
  if (req.width % 2 !== 0 || req.height % 2 !== 0) return null; // H.264 needs even dims
  if (req.frameCount <= 0) return null;

  let encoder: H264Encoder | null = null;
  try {
    const mod = (await import("h264-mp4-encoder")) as unknown as EncoderModule;
    const create = mod.createH264MP4Encoder ?? mod.default?.createH264MP4Encoder;
    if (!create) return null;

    encoder = await create();
    encoder.width = req.width;
    encoder.height = req.height;
    encoder.frameRate = req.fps;
    encoder.quantizationParameter = req.quantizationParameter ?? 28;
    encoder.groupOfPictures = req.groupOfPictures ?? req.fps;
    encoder.initialize();

    const expected = req.width * req.height * 4;
    for (let i = 0; i < req.frameCount; i++) {
      const frame = await req.frameAt(i);
      if (!frame || frame.length !== expected) return null; // malformed frame → fall back
      encoder.addFrameRgba(frame);
    }

    encoder.finalize();
    const out = encoder.FS.readFile(encoder.outputFilename);
    // Copy out of the WASM heap before delete() frees it.
    return Buffer.from(out.slice());
  } catch (err) {
    console.warn("[mp4-encoder] encode failed:", (err as Error).message);
    return null;
  } finally {
    try {
      encoder?.delete();
    } catch {
      /* already freed / never created */
    }
  }
};
