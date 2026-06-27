// Pure presentation helpers for the card-hero image (ADR-072 follow-up). Kept
// out of post-image.tsx so they're testable without loading next/og (which can't
// run under node --strip-types). The render template consumes HeroFields.

import type { DealData, SpotlightData } from "./post-text.ts";

export type HeroFields = {
  /** The giant focal number, e.g. "17%" (deal) or "$120" (spotlight). */
  bigNumber: string;
  /** The line under the number, e.g. "below its 30-day sold average". */
  subline: string;
  /** Whether to stack the red ▼ above the number (deals only — a spotlight is
   *  a price, not a drop). */
  showArrow: boolean;
  /** "Name · Set · Condition · $avg avg · N sales". */
  supportLine: string;
};

function usd(n: number): string {
  return `$${n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(2)}`;
}

function humanTier(t: string | null): string {
  if (!t) return "";
  const raw: Record<string, string> = {
    NEAR_MINT: "Near Mint",
    LIGHTLY_PLAYED: "Lightly Played",
    MODERATELY_PLAYED: "Moderately Played",
    HEAVILY_PLAYED: "Heavily Played",
    DAMAGED: "Damaged",
  };
  return raw[t] ?? t.replace(/_/g, " ");
}

/** Deal hero: a card trading below its own 30-day average. Red ▼ + "% below". */
export function heroFieldsForDeal(d: DealData): HeroFields {
  const tier = humanTier(d.matchedTier) || "Near Mint";
  return {
    bigNumber: `${Math.round(Math.abs(d.deltaPct))}%`,
    subline: "below its 30-day sold average",
    showArrow: true,
    supportLine: `${d.cardName} · ${d.setName} · ${tier} · ${usd(d.soldReference)} avg · ${d.saleCount} sales`,
  };
}

/** Spotlight hero: a popular card's recent price. No ▼ (it's a price, not a drop). */
export function heroFieldsForSpotlight(s: SpotlightData): HeroFields {
  return {
    bigNumber: usd(s.soldReference),
    subline: "recent sold average",
    showArrow: false,
    supportLine: `${s.cardName} · ${s.setName} · ${usd(s.soldReference)} avg · ${s.sampleSize} sales`,
  };
}

/** Constrain a card name so it can't collide with the % column on the board. */
export function clampName(name: string, max = 19): string {
  return name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name;
}
