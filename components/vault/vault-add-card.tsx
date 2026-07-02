"use client";

// Add-in-place for the vault (ADR-093): the SAME shared type-ahead as /start
// (components/cards/card-typeahead.tsx — never a fork), submitting straight to
// the vaultAddCard server action. Pick a card → optional target → it lands in
// the vault on the server re-render.

import { useState, useTransition } from "react";
import { CardTypeahead, type CardSearchHit } from "@/components/cards/card-typeahead";
import { vaultAddCard } from "@/app/actions/vault";

export function VaultAddCard({
  token,
  cataloguedIds,
  trackedIds,
}: {
  token: string;
  cataloguedIds: string[];
  trackedIds: string[];
}) {
  const [picked, setPicked] = useState<CardSearchHit | null>(null);
  const [targetUsd, setTargetUsd] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(hit: CardSearchHit, target: string) {
    const form = new FormData();
    form.set("token", token);
    form.set("pokemon_tcg_id", hit.id);
    form.set("target_usd", target.trim());
    startTransition(async () => {
      const res = await vaultAddCard(form);
      if (res.ok) {
        setPicked(null);
        setTargetUsd("");
        setMessage(`${hit.name} added to your vault.`);
      } else {
        setMessage("Couldn't add that card. Try again.");
      }
    });
  }

  return (
    <div>
      <CardTypeahead
        cataloguedIds={cataloguedIds}
        pickedIds={trackedIds}
        onPick={(hit) => {
          setMessage(null);
          setPicked(hit);
        }}
        label="Search a card you're hunting"
        pickedBadge="In your vault ✓"
        pickCta="+ Add"
      />

      {picked && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-foil-gold/40 bg-foil-gold/5 px-4 py-3">
          <p className="text-sm font-medium text-foil-navy">
            {picked.name} <span className="text-foil-slate">({picked.setName})</span>
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-foil-slate">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              value={targetUsd}
              onChange={(e) => setTargetUsd(e.target.value)}
              placeholder="any"
              aria-label={`Target price for ${picked.name}`}
              className="w-20 rounded-lg border border-foil-navy/15 bg-foil-cream px-2 py-1.5 text-right text-sm text-foil-navy placeholder:text-foil-slate/60 outline-none focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30"
            />
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={() => submit(picked, targetUsd)}
            className="rounded-xl bg-foil-navy px-4 py-2 text-sm font-semibold text-foil-cream transition hover:bg-foil-coral disabled:opacity-60"
          >
            {isPending ? "Adding…" : "Add to vault"}
          </button>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="text-sm text-foil-slate underline decoration-foil-navy/20 underline-offset-2 hover:text-foil-navy"
          >
            Cancel
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="mt-3 text-sm text-foil-navy">
          {message}
        </p>
      )}
    </div>
  );
}
