"use client";

// Watchlist form (Session 49b / ADR-043).
//
// Client Component so it can (a) call the createWatchlist Server Action via
// useActionState (per "Server Actions for mutations" — CLAUDE.md) and (b) read
// the selected variant (?v=) + condition (?c=) from the URL, the same state
// the variant selector and ConditionPicker write. Because condition changes are
// a soft navigation, the email the user has typed survives a condition switch.
//
// The form states what it's tracking ("1st Edition Holofoil · PSA 10") so the
// buyer sees exactly what the alert targets — the brand's earned-trust line.

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { createWatchlist, type WatchlistFormState } from "@/app/actions/create-watchlist";
import { isValidConditionToken, conditionLabel, DEFAULT_CONDITION } from "@/lib/cards/conditions";
import { DEFAULT_VARIANT_KEY, labelForVariantKey } from "@/lib/poketrace/variant";

// The action file is "use server" (only async exports allowed), so the initial
// state lives here.
const initialWatchlistState: WatchlistFormState = { status: "idle" };

const ERROR_COPY: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  invalid_target_price: "Enter a target price.",
  invalid_card_slug: "Something went wrong — try again.",
  invalid_variant: "That printing isn't available for alerts — try again.",
  invalid_condition: "That condition isn't available — try again.",
  unavailable: "Alerts are briefly unavailable — try again shortly.",
  save_failed: "Couldn't save your alert — try again.",
};

export function WatchlistForm({
  cardSlug,
  cardName,
  availableVariantKeys,
}: {
  cardSlug: string;
  cardName: string;
  availableVariantKeys: string[];
}) {
  const [state, formAction, pending] = useActionState(createWatchlist, initialWatchlistState);
  const params = useSearchParams();

  const vRaw = params.get("v");
  const variant = vRaw && availableVariantKeys.includes(vRaw) ? vRaw : DEFAULT_VARIANT_KEY;
  const cRaw = params.get("c");
  const condition = cRaw && isValidConditionToken(cRaw) ? cRaw : DEFAULT_CONDITION;

  const targeting =
    variant !== DEFAULT_VARIANT_KEY || condition !== DEFAULT_CONDITION
      ? `${variant !== DEFAULT_VARIANT_KEY ? labelForVariantKey(variant) : "Any printing"} · ${conditionLabel(condition)}`
      : null;

  if (state.status === "success") {
    return (
      <div className="mt-4 rounded-xl border border-foil-gold/40 bg-foil-gold/10 p-4 text-sm text-foil-navy">
        <p className="font-medium text-foil-navy">You&apos;re on the list.</p>
        <p className="mt-1 text-foil-slate">
          We&apos;ll email you the moment {cardName}
          {targeting ? ` (${targeting})` : ""} hits your target price.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="card_slug" value={cardSlug} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="condition" value={condition} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="flex-1 rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-sm text-foil-navy placeholder-foil-slate/60 outline-none focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30"
        />
        <input
          type="number"
          name="target_price"
          required
          min={1}
          step={1}
          placeholder="Target ($)"
          className="w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-sm text-foil-navy placeholder-foil-slate/60 outline-none focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 sm:w-32"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-foil-navy px-6 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy"
        >
          {pending ? "Saving…" : "Notify me"}
        </button>
      </div>

      {targeting && (
        <p className="text-[11px] uppercase tracking-wider text-foil-slate">
          Tracking: <span className="font-medium text-foil-navy">{targeting}</span>
        </p>
      )}

      <label className="flex items-start gap-3 text-xs text-foil-slate">
        <input
          type="checkbox"
          name="opt_in_newsletter"
          defaultChecked
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-foil-navy/20 bg-foil-cream text-foil-gold focus:ring-foil-gold focus:ring-offset-0"
        />
        <span>Also send me Foil&apos;s weekly deals newsletter (~1 email/week, unsubscribe anytime)</span>
      </label>

      {state.status === "error" && (
        <p className="text-xs text-foil-coral" role="alert">
          {ERROR_COPY[state.error ?? ""] ?? "Something went wrong — try again."}
        </p>
      )}
    </form>
  );
}
