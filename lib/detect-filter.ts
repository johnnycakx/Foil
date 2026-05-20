// Post-detect filter pipeline. The Vision detector over-detects: edge slivers,
// partial cards behind a pile, and duplicate boxes on the same card front all
// show up. The pipeline below drops the obvious noise (area / confidence /
// aspect ratio) and then IoU-merges remaining duplicates, keeping the higher
// detectionConfidence in each merged pair.

import type { DetectedCard } from "./vision.ts";

const MIN_AREA = 0.015; // 1.5% of image area
const MIN_CONFIDENCE = 0.55;
// Pokemon cards are ~63x88 → short/long ≈ 0.716. Strict default window is
// ±0.2 around that.
const ASPECT_MIN_STRICT = 0.55;
const ASPECT_MAX_STRICT = 0.95;
// Binder photos tilt the camera off-axis, which stretches the detected boxes
// and pushes their short/long ratios outside the strict window. When too many
// boxes get dropped by aspect we re-run with this looser window — single-card
// shots stay on the strict path because most of their boxes pass strict.
const ASPECT_MIN_LOOSE = 0.45;
const ASPECT_MAX_LOOSE = 1.0;
const IOU_MERGE = 0.35;

export type FilterStats = {
  raw: number;
  areaDrop: number;
  confDrop: number;
  aspectDrop: number;
  iouMerge: number;
  final: number;
  aspectMode: "strict" | "loose"; // "loose" = binder-mode auto-engaged
};

function area(b: DetectedCard): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

function shortLongAspect(b: DetectedCard): number {
  const w = Math.max(0, b.width);
  const h = Math.max(0, b.height);
  if (w === 0 || h === 0) return 0;
  return Math.min(w, h) / Math.max(w, h);
}

function iou(a: DetectedCard, b: DetectedCard): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const union = area(a) + area(b) - inter;
  return union > 0 ? inter / union : 0;
}

// Trigger binder-mode (loose aspect window) when strict drops more than half
// of the conf-survivors AND there are still enough boxes left to look like a
// binder grid. The combined guard keeps single-card photos (where strict only
// drops a stray box or two) on the strict path.
const BINDER_MODE_TRIGGER_RATIO = 0.5;
const BINDER_MODE_MIN_RAW = 4;

export function filterDetections(boxes: DetectedCard[]): {
  cards: DetectedCard[];
  stats: FilterStats;
} {
  const raw = boxes.length;

  const afterArea = boxes.filter((b) => area(b) >= MIN_AREA);
  const areaDrop = raw - afterArea.length;

  const afterConf = afterArea.filter((b) => b.detectionConfidence >= MIN_CONFIDENCE);
  const confDrop = afterArea.length - afterConf.length;

  // Pass 1: strict aspect window. If it survives most of the conf-survivors,
  // we're done. Otherwise the photo is probably a tilted binder and we re-run
  // pass 1 with the loose window.
  const passStrict = afterConf.filter((b) => {
    const r = shortLongAspect(b);
    return r >= ASPECT_MIN_STRICT && r <= ASPECT_MAX_STRICT;
  });
  const strictAspectDrop = afterConf.length - passStrict.length;

  let aspectSurvivors: DetectedCard[];
  let aspectMode: "strict" | "loose";
  if (
    afterConf.length >= BINDER_MODE_MIN_RAW &&
    strictAspectDrop > afterConf.length * BINDER_MODE_TRIGGER_RATIO
  ) {
    // Binder-mode auto-engage: too many boxes had aspect outside strict.
    // Retry with the loose window. Most binder photos recover all 9-18 cards
    // this way without leaking non-card boxes (single cards never trip this
    // trigger because strict keeps the majority).
    aspectSurvivors = afterConf.filter((b) => {
      const r = shortLongAspect(b);
      return r >= ASPECT_MIN_LOOSE && r <= ASPECT_MAX_LOOSE;
    });
    aspectMode = "loose";
  } else {
    aspectSurvivors = passStrict;
    aspectMode = "strict";
  }
  const aspectDrop = afterConf.length - aspectSurvivors.length;

  // Greedy IoU merge: sort by confidence desc; for each box, drop any later
  // box whose IoU with it exceeds the threshold.
  const sorted = [...aspectSurvivors].sort(
    (a, b) => b.detectionConfidence - a.detectionConfidence,
  );
  const kept: DetectedCard[] = [];
  const dropped = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (dropped.has(i)) continue;
    kept.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (dropped.has(j)) continue;
      if (iou(sorted[i], sorted[j]) > IOU_MERGE) dropped.add(j);
    }
  }
  const iouMerge = aspectSurvivors.length - kept.length;

  return {
    cards: kept,
    stats: {
      raw,
      areaDrop,
      confDrop,
      aspectDrop,
      iouMerge,
      final: kept.length,
      aspectMode,
    },
  };
}
