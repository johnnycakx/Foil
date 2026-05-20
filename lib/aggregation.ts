// Identity-based dedup + quantity aggregation.
//
// After identify + pricing settles, we have N parallel detection→identification
// rows. Two failure modes can leave the same logical card spread across
// multiple rows:
//
//   1. The detector boxed the same physical card twice (IoU > ~0.15). Vision
//      reads the same printed fields on both. These are noise; drop the
//      lower-confidence copy.
//
//   2. The user's photo legitimately contains two copies of one card (binder
//      page with multiples). Identity matches, but boxes don't overlap. The
//      UI should show ONE row with quantity = 2, not two rows.
//
// This module produces a per-index decision: "kept" (with quantity) or
// "merged into row X." Callers fold the input arrays accordingly.

import type { BoundingBox } from "./vision.ts";

export type AggregateInput = {
  key: string | null;          // null = ungroupable (e.g., insufficient_information)
  box: BoundingBox;
  detectionConfidence: number; // higher = preferred representative
};

export type AggregateDecision =
  | { type: "kept"; quantity: number }
  | { type: "merged"; mergedInto: number };

const IOU_DUPLICATE_THRESHOLD = 0.15;

function area(b: BoundingBox): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

function iou(a: BoundingBox, b: BoundingBox): number {
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

/**
 * Group rows by identity key, dedup IoU-overlapping duplicate detections,
 * then collapse the remaining distinct physical cards in each group into a
 * single row with quantity = count.
 *
 * The representative for each group is the row with the highest
 * detectionConfidence — it tends to be the cleanest crop, which yields the
 * best PokeTrace match and the best UI reference image.
 */
export function aggregateByIdentity(items: AggregateInput[]): AggregateDecision[] {
  const decisions: AggregateDecision[] = items.map(() => ({ type: "kept", quantity: 1 }));

  // Bucket by identity key. Items with null key never group (each stays its
  // own row at quantity = 1).
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    const key = items[i].key;
    if (key === null) continue;
    const arr = buckets.get(key) ?? [];
    arr.push(i);
    buckets.set(key, arr);
  }

  for (const indices of buckets.values()) {
    if (indices.length < 2) continue;

    // Within a bucket, sort by confidence desc so the strongest detection
    // becomes the representative for any IoU duplicates that follow.
    const ranked = [...indices].sort(
      (a, b) => items[b].detectionConfidence - items[a].detectionConfidence,
    );

    // Pass 1 — IoU dedup. Greedy: walk ranked; any box that overlaps a
    // previously-kept box at IoU > threshold is a duplicate detection.
    const distinct: number[] = [];
    const droppedAsDup = new Set<number>();
    for (const i of ranked) {
      const isDup = distinct.some((k) => iou(items[i].box, items[k].box) > IOU_DUPLICATE_THRESHOLD);
      if (isDup) {
        droppedAsDup.add(i);
      } else {
        distinct.push(i);
      }
    }

    // Pass 2 — collapse to one row. The first `distinct` index is the
    // representative (highest confidence). Everything else in the bucket —
    // both IoU duplicates and non-overlapping binder duplicates — folds into
    // it. Quantity reflects the count of distinct physical cards.
    const representative = distinct[0];
    decisions[representative] = { type: "kept", quantity: distinct.length };
    for (const i of indices) {
      if (i === representative) continue;
      decisions[i] = { type: "merged", mergedInto: representative };
    }
  }

  return decisions;
}

/**
 * Derive the identity key for an items[]. Two-tier strategy:
 *
 *   1. Strong identity: setCode + collectorNumber + variant. Two cards with
 *      this tuple in common are unambiguously the same printing.
 *   2. Fallback identity: name + setCode + variant. Used when Vision read
 *      enough of the card to know its name and set but couldn't read the
 *      collector number (typical Mega ex review-state failure). Two review
 *      rows of the same name-in-the-same-set safely collapse — there are
 *      occasional sets with two cards of the same name (different printings)
 *      but the user would expect to merge them anyway since neither is
 *      individually identifiable.
 *
 * Returns null only when neither tier yields enough to safely group — a card
 * with no name AND no collectorNumber stays its own row.
 */
export function identityKey(parts: {
  name: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  variant: string | null;
}): string | null {
  const v = parts.variant?.trim().toLowerCase() || "unknown";
  if (parts.setCode && parts.collectorNumber) {
    return `${parts.setCode.toUpperCase()}|${parts.collectorNumber}|${v}`;
  }
  if (parts.name && parts.setCode) {
    return `name:${parts.name.trim().toLowerCase()}|${parts.setCode.toUpperCase()}|${v}`;
  }
  return null;
}
