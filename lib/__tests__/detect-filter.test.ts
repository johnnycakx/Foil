// Unit test for the post-detect filter pipeline. The detector's raw output
// includes edge slivers, low-confidence guesses, weird aspect ratios from
// stacks/fans, and duplicate boxes drawn on the same card. The filter must
// drop or merge each of those.

import test from "node:test";
import assert from "node:assert/strict";
import { filterDetections } from "../detect-filter.ts";
import type { DetectedCard } from "../vision.ts";

function box(
  x: number,
  y: number,
  width: number,
  height: number,
  detectionConfidence: number,
): DetectedCard {
  return { x, y, width, height, detectionConfidence };
}

test("filterDetections drops tiny/low-conf/bad-aspect boxes and merges IoU duplicates", () => {
  // A 6-box synthetic input. Cards in a normal photo are roughly 12% wide and
  // 17% tall (short/long ~ 0.7). Construct each box with intent:
  //   #0 — TINY (area < 1.5%): should drop in area pass
  //   #1 — TINY: should drop in area pass
  //   #2 — LOW CONFIDENCE (below 0.55): should drop in conf pass
  //   #3 — NORMAL card top-left
  //   #4 — IoU duplicate of #3 (huge overlap, lower confidence): should merge away
  //   #5 — NORMAL card bottom-right (separate from #3, passes everything)
  const input: DetectedCard[] = [
    box(0.0, 0.0, 0.05, 0.05, 0.95), // 0: area = 0.0025 < 0.015 → drop
    box(0.9, 0.9, 0.04, 0.06, 0.9), // 1: area = 0.0024 < 0.015 → drop
    box(0.2, 0.2, 0.12, 0.17, 0.3), // 2: conf < 0.55 → drop
    box(0.15, 0.15, 0.12, 0.17, 0.9), // 3: keep (normal-aspect, high conf)
    box(0.16, 0.16, 0.12, 0.17, 0.7), // 4: heavy IoU with #3, lower conf → merge away
    box(0.6, 0.6, 0.12, 0.17, 0.85), // 5: keep (clear of #3)
  ];

  const result = filterDetections(input);
  assert.strictEqual(result.stats.raw, 6);
  assert.strictEqual(result.stats.areaDrop, 2, "two tiny boxes should drop in area pass");
  assert.strictEqual(result.stats.confDrop, 1, "one low-conf box should drop in conf pass");
  assert.strictEqual(result.stats.aspectDrop, 0, "all surviving boxes have normal aspect");
  assert.strictEqual(result.stats.iouMerge, 1, "one duplicate should be merged via IoU");
  assert.strictEqual(result.stats.final, 2, "exactly two boxes should survive");
  assert.strictEqual(result.cards.length, 2);
});

test("filterDetections drops boxes with extreme aspect (square slivers, very long rectangles)", () => {
  // Square — short/long = 1.0 > 0.95 → drop
  const square = box(0.1, 0.1, 0.2, 0.2, 0.9);
  // Long thin strip — short/long ≈ 0.1 < 0.55 → drop
  const strip = box(0.4, 0.4, 0.4, 0.04, 0.9);
  // Normal card
  const normal = box(0.1, 0.5, 0.12, 0.17, 0.9);

  const result = filterDetections([square, strip, normal]);
  assert.strictEqual(result.stats.aspectDrop, 2);
  assert.strictEqual(result.stats.final, 1);
});

test("filterDetections keeps higher-confidence box when IoU-merging", () => {
  const high = box(0.1, 0.1, 0.12, 0.17, 0.95);
  const low = box(0.105, 0.105, 0.12, 0.17, 0.6); // nearly identical, lower conf
  const result = filterDetections([high, low]);
  assert.strictEqual(result.stats.final, 1);
  assert.strictEqual(result.cards[0].detectionConfidence, 0.95);
});
