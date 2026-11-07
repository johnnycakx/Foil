// Seeded gift vaults (eve-vault, ADR-100). A seeded vault is a pre-made,
// claimable vault that exists BEFORE any email: the definition lives here in
// code (reviewed curation — the navigation-promise rule applies: every pocket
// slug must be in CARD_CATALOG and have real sold data, pinned in
// lib/__tests__/vault-seeds.test.ts), and only the CLAIM state lives in the
// DB (seeded_vault_claims — one row per vault, the PK makes double-claim
// impossible).
//
// Pocket order is binder-page curation, evolution/line order per line:
// V → VMAX alt → ex SIR, Umbreon row first with Moonbreon center.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SeededVault = {
  /** Token payload + claims-table PK. Lowercase slug. */
  id: string;
  /** Dedication chip text (the /lines pattern): "Made for {dedication}". */
  dedication: string;
  /** H1 headline for the vault. */
  headline: string;
  /** One line under the headline. */
  tagline: string;
  /** Curated pocket card slugs (CARD_CATALOG slugs), binder order. 6-8. */
  pockets: string[];
  /** watchlists.src tag written on claim. */
  src: string;
  /** Subscriber UTM attribution written on claim (ADR-084). */
  utm: { source: string; medium: string; campaign: string | null };
  /** Newsletter-subscriber source tag. */
  subscriberSource: string;
};

export const SEEDED_VAULTS: Record<string, SeededVault> = {
  eve: {
    id: "eve",
    dedication: "@possiblyeve",
    headline: "Your duo, already watched.",
    tagline:
      "Six grails from your Espeon + Umbreon lines, targets set at what they actually sell for. Add your email and Foil does the rest.",
    pockets: [
      // Umbreon line — V → Moonbreon (center pocket) → ex SIR
      "swsh7-189-umbreon-v",
      "swsh7-215-umbreon-vmax-alt-art",
      "sv8pt5-161-umbreon-ex",
      // Espeon line — V → VMAX alt → ex SIR
      "swsh7-180-espeon-v",
      "swsh8-270-espeon-vmax",
      "sv8pt5-155-espeon-ex",
    ],
    src: "eve-vault",
    utm: { source: "x", medium: "eve", campaign: null },
    subscriberSource: "eve-vault",
  },
  // Throwaway seed for verifying the claim flow END-TO-END with a test email
  // before the real link is ever sent (the goal's live-verification order:
  // claim the demo vault FIRST, never eve's). Same pockets = same code paths.
  demo: {
    id: "demo",
    dedication: "the Foil workshop",
    headline: "A vault, ready to claim.",
    tagline:
      "Six curated grails, targets set from real sold data. Add your email and Foil watches them for you.",
    pockets: [
      "swsh7-189-umbreon-v",
      "swsh7-215-umbreon-vmax-alt-art",
      "sv8pt5-161-umbreon-ex",
      "swsh7-180-espeon-v",
      "swsh8-270-espeon-vmax",
      "sv8pt5-155-espeon-ex",
    ],
    src: "seeded-vault-demo",
    utm: { source: "internal", medium: "demo", campaign: null },
    subscriberSource: "seeded-vault-demo",
  },
};

export function getSeededVault(id: string): SeededVault | null {
  return SEEDED_VAULTS[id.trim().toLowerCase()] ?? null;
}

type SoldSnapshotEntry = {
  soldCents: number;
  saleCount: number;
  tierLabel: string;
  source: string;
  /** The bake ALREADY writes this (scripts/seed-line-sold.ts) — the tier's most
   *  recent recorded sale. The type simply never declared it, so every consumer
   *  silently dropped it and rendered the figure undated (audit 2026-07-14).
   *  Null when upstream had no timestamp: disclose, never imply freshness. */
  soldAsOf: string | null;
};

// Same readFileSync pattern as lib/lines/data.ts (strip-types-safe, no JSON
// import attributes). Missing snapshot → null per slug (honest degradation).
function loadSnapshotCards(): Record<string, SoldSnapshotEntry> {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "lines", "sold-snapshot.generated.json"), "utf8");
    const parsed = JSON.parse(raw) as { cards?: Record<string, SoldSnapshotEntry> };
    return parsed.cards ?? {};
  } catch {
    return {};
  }
}

const SNAPSHOT_CARDS = loadSnapshotCards();

/** Committed sold-data fallback (the /lines bake) for pockets the live
 *  market_movers cache doesn't cover. Null when the slug isn't in the bake. */
export function getSnapshotSold(cardSlug: string): SoldSnapshotEntry | null {
  const entry = SNAPSHOT_CARDS[cardSlug];
  return entry && entry.soldCents > 0 ? entry : null;
}
