// Unit tests for aggregateByIdentity. Two failure modes the aggregator must
// distinguish:
//   - Same physical card boxed twice by the detector → IoU > 0.15 → dedup
//     down to one row, quantity = 1.
//   - Two physical copies of the same card (binder duplicates) → IoU < 0.15
//     → collapse to one row, quantity = 2.

import test from "node:test";
import assert from "node:assert/strict";
import { aggregateByIdentity, identityKey } from "../aggregation.ts";
import type { BoundingBox } from "../vision.ts";

function box(x: number, y: number, w: number, h: number): BoundingBox {
  return { x, y, width: w, height: h };
}

const VULPIX_KEY = "MEW|037/165|holofoil";

test("aggregation: two cards with overlapping boxes + same identity → one row × 1 (dedup)", () => {
  // Two boxes that overlap heavily — the detector saw the same physical card
  // twice. Aggregator must drop the lower-confidence box and report × 1.
  const items = [
    { key: VULPIX_KEY, box: box(0.10, 0.10, 0.12, 0.17), detectionConfidence: 0.92 },
    { key: VULPIX_KEY, box: box(0.11, 0.11, 0.12, 0.17), detectionConfidence: 0.65 }, // 90%+ overlap
  ];
  const result = aggregateByIdentity(items);
  assert.deepStrictEqual(result[0], { type: "kept", quantity: 1 });
  assert.deepStrictEqual(result[1], { type: "merged", mergedInto: 0 });
});

test("aggregation: two cards with non-overlapping boxes + same identity → one row × 2 (binder duplicates)", () => {
  // Two separated boxes — same identity but the user really has two copies.
  // Aggregator must collapse to a single row carrying quantity = 2.
  const items = [
    { key: VULPIX_KEY, box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.90 },
    { key: VULPIX_KEY, box: box(0.60, 0.60, 0.12, 0.17), detectionConfidence: 0.85 },
  ];
  const result = aggregateByIdentity(items);
  assert.deepStrictEqual(result[0], { type: "kept", quantity: 2 });
  assert.deepStrictEqual(result[1], { type: "merged", mergedInto: 0 });
});

test("aggregation: representative is the highest-confidence detection", () => {
  // Order of input shouldn't matter — the strongest detection becomes the
  // row anchor, so the UI gets the cleanest crop's reference image.
  const items = [
    { key: VULPIX_KEY, box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.50 },
    { key: VULPIX_KEY, box: box(0.60, 0.60, 0.12, 0.17), detectionConfidence: 0.95 }, // strongest
    { key: VULPIX_KEY, box: box(0.30, 0.30, 0.12, 0.17), detectionConfidence: 0.75 },
  ];
  const result = aggregateByIdentity(items);
  // Index 1 should be the kept anchor with quantity = 3 (all distinct boxes).
  assert.deepStrictEqual(result[1], { type: "kept", quantity: 3 });
  assert.deepStrictEqual(result[0], { type: "merged", mergedInto: 1 });
  assert.deepStrictEqual(result[2], { type: "merged", mergedInto: 1 });
});

test("aggregation: mixed group — 1 IoU duplicate dropped, 2 distinct kept as × 2", () => {
  const items = [
    { key: VULPIX_KEY, box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.92 }, // anchor
    { key: VULPIX_KEY, box: box(0.06, 0.06, 0.12, 0.17), detectionConfidence: 0.70 }, // overlaps #0 → drop
    { key: VULPIX_KEY, box: box(0.60, 0.60, 0.12, 0.17), detectionConfidence: 0.88 }, // distinct → counts
  ];
  const result = aggregateByIdentity(items);
  // Index 0 is the anchor with quantity = 2 (it + index 2 survive dedup).
  // Index 1 is the IoU duplicate, merged into the anchor.
  // Index 2 also merges into the anchor (it's a binder dup).
  assert.deepStrictEqual(result[0], { type: "kept", quantity: 2 });
  assert.deepStrictEqual(result[1], { type: "merged", mergedInto: 0 });
  assert.deepStrictEqual(result[2], { type: "merged", mergedInto: 0 });
});

test("aggregation: different identity keys never merge", () => {
  // Different cards, even if boxes happen to overlap, must stay separate.
  const items = [
    { key: "MEG|037/094|holofoil", box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.9 },
    { key: "MEG|041/094|holofoil", box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.9 }, // identical box
  ];
  const result = aggregateByIdentity(items);
  assert.deepStrictEqual(result[0], { type: "kept", quantity: 1 });
  assert.deepStrictEqual(result[1], { type: "kept", quantity: 1 });
});

test("aggregation: null identity keys never group (review rows stay individual)", () => {
  const items = [
    { key: null, box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.9 },
    { key: null, box: box(0.05, 0.05, 0.12, 0.17), detectionConfidence: 0.9 }, // identical box, null key
  ];
  const result = aggregateByIdentity(items);
  assert.deepStrictEqual(result[0], { type: "kept", quantity: 1 });
  assert.deepStrictEqual(result[1], { type: "kept", quantity: 1 });
});

test("aggregation: singleton groups pass through with quantity 1", () => {
  const items = [
    { key: VULPIX_KEY, box: box(0.1, 0.1, 0.1, 0.1), detectionConfidence: 0.9 },
  ];
  const result = aggregateByIdentity(items);
  assert.deepStrictEqual(result[0], { type: "kept", quantity: 1 });
});

test("identityKey: missing setCode or collectorNumber returns null (ungroupable)", () => {
  assert.strictEqual(identityKey({ setCode: null, collectorNumber: "037", variant: "Holofoil" }), null);
  assert.strictEqual(identityKey({ setCode: "MEG", collectorNumber: null, variant: "Holofoil" }), null);
});

test("identityKey: variant case-insensitive + whitespace tolerant", () => {
  const a = identityKey({ setCode: "MEG", collectorNumber: "037/094", variant: "Holofoil" });
  const b = identityKey({ setCode: "meg", collectorNumber: "037/094", variant: " holofoil " });
  assert.strictEqual(a, b);
});

test("identityKey: null variant collapses to 'unknown'", () => {
  const key = identityKey({ setCode: "MEG", collectorNumber: "037/094", variant: null });
  assert.strictEqual(key, "MEG|037/094|unknown");
});
