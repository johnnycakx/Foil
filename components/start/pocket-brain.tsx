"use client";

// The market brain, on screen the instant a card seats (quality-bar-fixes
// item 5 — the Collectr answer, 2026-07-13).
//
// The audit's biggest finding: Foil's brain only ever manifested as a future
// email. "Your binder, with a market brain" is the homepage's exact promise,
// so the moment a card seats the desk shows the brain working:
//   1. what it really sells for (the SAME soldCents/saleCount the alert
//      engine reads — soldLine, never restated math; honest absence when
//      the read is thin)
//   2. today's best live listing, fetched FRESH per seat from
//      /api/listing/[slug] (R-008: that endpoint is force-dynamic +
//      no-store; nothing is persisted; eBay spend happens only on seat
//      actions, and only curated-tier cards resolve a live ask — longtail
//      gets the honest affiliate browse link)
//   3. distance from your number, when a number is armed
//
// Currency discipline (ADR-069, the GBP Moonbreon lesson): a non-USD
// verified ask is never compared against the USD sold basis — it degrades
// to the browse link.
//
// Register rule: card-shop words, third-person Foil, no em dashes.

import { useEffect, useState } from "react";
import { soldLine, distanceLine, pctUnderUsual, type BinderCard } from "@/lib/start/binder";

type ListingState =
  | { kind: "loading" }
  | { kind: "none"; fallbackUrl: string | null }
  | { kind: "live"; priceCents: number; affiliateUrl: string; condition: string };

export type PocketBrainProps = {
  card: BinderCard;
  /** The armed number (collector's or Foil's written tag), cents, or null. */
  targetCents: number | null;
};

export function PocketBrain({ card, targetCents }: PocketBrainProps) {
  const [listing, setListing] = useState<ListingState>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    setListing({ kind: "loading" });
    if (!card.slug) {
      setListing({ kind: "none", fallbackUrl: null });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/listing/${encodeURIComponent(card.slug)}?src=start`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          verified: { price: number; currency: string; affiliateUrl: string; condition: string } | null;
          fallbackUrl: string;
        };
        if (!alive) return;
        // USD-only comparison (ADR-069): anything else degrades honestly.
        if (body.verified && body.verified.currency === "USD") {
          setListing({
            kind: "live",
            priceCents: Math.round(body.verified.price * 100),
            affiliateUrl: body.verified.affiliateUrl,
            condition: body.verified.condition,
          });
        } else {
          setListing({ kind: "none", fallbackUrl: body.fallbackUrl ?? null });
        }
      } catch {
        if (alive) setListing({ kind: "none", fallbackUrl: null });
      }
    })();
    return () => {
      alive = false;
    };
  }, [card.slug, card.id]);

  const pct = listing.kind === "live" ? pctUnderUsual(listing.priceCents, card.soldCents) : null;

  return (
    <div
      role="status"
      aria-label={`Market read for ${card.name}`}
      className="mt-4 rounded-xl border border-foil-cream/12 bg-foil-night-2/80 px-3 py-2.5"
    >
      <p className="text-xs text-foil-cream/75">
        <span className="font-medium text-foil-cream">{card.name}</span>{" "}
        <span className="text-foil-cream/60">· {soldLine(card)}</span>
      </p>
      <p className="mt-1 text-xs text-foil-cream/70">
        {listing.kind === "loading" && "Foil is checking the live market…"}
        {listing.kind === "live" && (
          <>
            Best live one right now:{" "}
            <span className="font-semibold tabular-nums text-foil-cream">
              {(listing.priceCents / 100).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 2,
              })}
            </span>{" "}
            <span className="text-foil-cream/55">({listing.condition.toLowerCase().replace(/_/g, " ")})</span>
            {pct != null && pct > 0 && (
              <span className="text-foil-accent"> · {pct}% under usual</span>
            )}{" "}
            <a
              href={listing.affiliateUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="whitespace-nowrap underline decoration-foil-cream/30 underline-offset-2 hover:text-foil-cream"
            >
              See it →
            </a>
          </>
        )}
        {listing.kind === "none" &&
          (listing.fallbackUrl ? (
            <a
              href={listing.fallbackUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="underline decoration-foil-cream/30 underline-offset-2 hover:text-foil-cream"
            >
              See live listings on eBay →
            </a>
          ) : (
            "Foil checks the live market on its next pass."
          ))}
      </p>
      {listing.kind === "live" && targetCents != null && (
        <p className="mt-1 text-xs text-foil-cream/55">
          {distanceLine(listing.priceCents, targetCents)}
        </p>
      )}
    </div>
  );
}
