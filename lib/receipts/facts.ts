// Receipts sold-data resolver (x-reply-desk, ADR-107). Given a resolved card
// slug, produce the honest "sold avg + spread" figures a receipt may cite —
// or null when we have nothing to stand behind (null over guess). One layered
// source, mirroring the codebase's existing movers-then-committed idiom
// (app/(site)/w/[token]/seeded-vault-view.tsx: `soldBySlug.get(slug) ??
// getSnapshotSold(slug)`):
//
//   1. market_movers  — the live daily cache (avg7d + avg30d + sale count +
//      the tier). Present only for cards moving enough to be a mover, and only
//      while PokeTrace is live. The 7d-vs-30d pair IS the honest "spread".
//   2. sold-snapshot  — the committed /lines bake (getSnapshotSold): one
//      outlier-suppressed sold average + sale count. Always available (no
//      network, survives a PokeTrace lapse), but only covers the baked set.
//
// Coverage is deliberately honest, not exhaustive: a resolved chase card with
// no figures in EITHER source yields sold=null, and the draft goes figure-free
// + the card-page link (never a guessed number). Extending this with a live
// PokeTrace sold-history layer (fuller coverage + a per-condition spread) is a
// clean follow-up; it is intentionally NOT a hard dependency here because the
// PokeTrace key lapses ~2026-07-15.

import type { MoverRow } from "../deals/market-movers-read.ts";
import { usd } from "../engagement/draft.ts";

/** What a receipt may say about a card's recent sales, or null. */
export type ReceiptSold = {
  /** Headline sold average, USD (30-day windowed avg / the snapshot avg). */
  avgUsd: number;
  /** Recent (7-day) avg when the source carries one — the movement/"spread".
   *  Null for the single-figure snapshot source. */
  recentUsd: number | null;
  /** All-time sales on record for the tier the avg describes. */
  sampleSize: number | null;
  /** Which source produced these figures (for the draft framing + observability). */
  source: "movers" | "snapshot";
  /** Human tier label the average describes (never a blend). */
  tierLabel: string | null;
};

export type ReceiptFacts = {
  slug: string;
  displayName: string;
  /** Real sold figures, or null (resolved card but no data we stand behind). */
  sold: ReceiptSold | null;
};

/** The committed-snapshot shape (lib/vault-seeds.ts::getSnapshotSold). */
export type SnapshotSoldEntry = {
  soldCents: number;
  saleCount: number;
  tierLabel: string;
  source: string;
};

export type ReceiptFactDeps = {
  /** Live market_movers row for the exact slug (getMoverBySlug), or null. */
  mover: (slug: string) => Promise<MoverRow | null>;
  /** Committed sold snapshot for the slug (getSnapshotSold), or null. */
  snapshot: (slug: string) => SnapshotSoldEntry | null;
};

/**
 * Resolve the sold figures for one already-resolved card. Movers first (richer
 * — carries the 7d/30d spread), snapshot fallback, null when neither stands.
 * Soft-fails the mover read (never throws). Pure over injected deps.
 */
export async function getReceiptFacts(
  slug: string,
  displayName: string,
  deps: ReceiptFactDeps,
): Promise<ReceiptFacts> {
  let mover: MoverRow | null = null;
  try {
    mover = await deps.mover(slug);
  } catch {
    mover = null;
  }
  if (mover && typeof mover.avg30d === "number" && mover.avg30d > 0) {
    return {
      slug,
      displayName,
      sold: {
        avgUsd: mover.avg30d,
        recentUsd: typeof mover.avg7d === "number" && mover.avg7d > 0 ? mover.avg7d : null,
        sampleSize: mover.saleCount || null,
        source: "movers",
        tierLabel: mover.matchedTier ?? null,
      },
    };
  }

  const snap = deps.snapshot(slug);
  if (snap && snap.soldCents > 0) {
    return {
      slug,
      displayName,
      sold: {
        avgUsd: snap.soldCents / 100,
        recentUsd: null,
        sampleSize: snap.saleCount || null,
        source: "snapshot",
        tierLabel: snap.tierLabel ?? null,
      },
    };
  }

  return { slug, displayName, sold: null };
}

/**
 * The EXACT set of dollar strings a receipt draft may cite for these figures —
 * the same gate contract the engagement engine uses (draft.ts::suppliedFigures):
 * every $ in the reply must be one of these, or the draft is rejected.
 */
export function receiptAllowedFigures(sold: ReceiptSold | null): Set<string> {
  const out = new Set<string>();
  if (!sold) return out;
  out.add(usd(sold.avgUsd));
  if (sold.recentUsd != null) out.add(usd(sold.recentUsd));
  return out;
}
