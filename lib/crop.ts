import sharp from "sharp";
import type { BoundingBox } from "./vision";

export type CroppedImage = {
  base64: string;
  mediaType: "image/jpeg";
  width: number;
  height: number;
};

const PADDING_FRACTION = 0.04;
const MIN_CROP_PX = 64;
const MAX_LONG_EDGE_PX = 1600;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export async function cropFromBuffer(
  source: Buffer,
  box: BoundingBox,
  opts: { padding?: number } = {},
): Promise<CroppedImage> {
  const padding = opts.padding ?? PADDING_FRACTION;

  const meta = await sharp(source).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("Could not determine source image dimensions.");

  const x0 = clamp(box.x - padding, 0, 1);
  const y0 = clamp(box.y - padding, 0, 1);
  const x1 = clamp(box.x + box.width + padding, 0, 1);
  const y1 = clamp(box.y + box.height + padding, 0, 1);

  const left = Math.round(x0 * W);
  const top = Math.round(y0 * H);
  const width = Math.max(MIN_CROP_PX, Math.round((x1 - x0) * W));
  const height = Math.max(MIN_CROP_PX, Math.round((y1 - y0) * H));

  const safeLeft = clamp(left, 0, Math.max(0, W - MIN_CROP_PX));
  const safeTop = clamp(top, 0, Math.max(0, H - MIN_CROP_PX));
  const safeWidth = clamp(width, MIN_CROP_PX, W - safeLeft);
  const safeHeight = clamp(height, MIN_CROP_PX, H - safeTop);

  const cropped = sharp(source).extract({
    left: safeLeft,
    top: safeTop,
    width: safeWidth,
    height: safeHeight,
  });

  const longest = Math.max(safeWidth, safeHeight);
  const resized =
    longest > MAX_LONG_EDGE_PX
      ? cropped.resize({
          width: safeWidth >= safeHeight ? MAX_LONG_EDGE_PX : undefined,
          height: safeHeight > safeWidth ? MAX_LONG_EDGE_PX : undefined,
          fit: "inside",
        })
      : cropped;

  const out = await resized.jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });

  return {
    base64: out.data.toString("base64"),
    mediaType: "image/jpeg",
    width: out.info.width,
    height: out.info.height,
  };
}
