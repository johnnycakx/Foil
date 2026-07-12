"use client";

// Add to vault: the card page's primary action (card-page-vault-first goal).
//
// One recognizable button above the fold; tapping it reveals the existing
// watch form INLINE (no navigation, no modal). This component is an entry
// point only: the write path stays the Server Action inside WatchlistForm,
// so it creates NO second watch-creation path (pinned by the one-write-path
// assertion in lib/__tests__/visual-regression.test.ts).
//
// Honest fallback (null-over-guess extended to CTA copy): on cards without
// sold data (metadata-only tier, hydration pending, or coherence-suppressed)
// the button still works; the existing upsert enqueues demand hydration
// (ADR-092), and the reveal says so in plain words instead of inventing a
// smart-sounding figure.
//
// Motion (emil-design-eng): press feedback via active:scale (150ms ease-out,
// transform-only); the revealed panel enters with a motion-safe rise. The
// reveal swaps the button for the form so the page keeps ONE primary object.

import { useEffect, useRef, useState } from "react";
import { WatchlistForm } from "@/components/cards/watchlist-form";

export function AddToVault({
  cardSlug,
  cardName,
  availableVariantKeys,
  hasSoldData,
}: {
  cardSlug: string;
  cardName: string;
  availableVariantKeys: string[];
  /** False on thin-data cards; drives the honest fallback copy. */
  hasSoldData: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus the email field once the form is revealed, so the tap-to-typing
  // path is two gestures on a phone, not three.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
  }, [open]);

  if (!open) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl bg-foil-cream px-6 py-4 text-base font-semibold text-foil-navy transition-transform duration-150 ease-out hover:ring-2 hover:ring-foil-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foil-accent/60 active:scale-[0.98] sm:max-w-sm"
        >
          Add to vault
        </button>
        <p className="mt-2.5 text-sm text-foil-cream/60">
          Foil watches the listings and emails you when the price is right. No
          account needed.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="mt-6 rounded-2xl border border-foil-accent/30 bg-foil-night-2 p-5 motion-safe:animate-[vault-reveal_200ms_cubic-bezier(0.23,1,0.32,1)] sm:p-6"
    >
      <p className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
        Add to vault
      </p>
      <p className="mt-2 text-sm text-foil-cream/70">
        {hasSoldData
          ? "Set a target price. Foil emails you when a listing meets it, and your vault keeps every card you track on one private page."
          : "Sold data is still pending for this card. Add it and Foil starts watching right away; it tracks the card's sold prices from here on and emails you when a listing meets your target."}
      </p>
      <WatchlistForm
        cardSlug={cardSlug}
        cardName={cardName}
        availableVariantKeys={availableVariantKeys}
      />
      <p className="mt-3 text-[11px] uppercase tracking-wider text-foil-cream/60">
        One email per drop · No spam · Unsubscribe any time from any email Foil sends.
      </p>
    </div>
  );
}
