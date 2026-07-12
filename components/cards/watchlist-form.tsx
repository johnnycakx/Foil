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
  invalid_card_slug: "Something went wrong. Try again.",
  invalid_variant: "That printing isn't available for alerts. Try again.",
  invalid_condition: "That condition isn't available. Try again.",
  unavailable: "Alerts are briefly unavailable. Try again shortly.",
  save_failed: "Couldn't save your alert. Try again.",
  watch_limit_free:
    "Free gets you 3 watches, and you're at the limit. Pro watches every card you're chasing, checked hourly.",
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
  // F2: carry the inbound creator/campaign tag (?src=) into the signup so email
  // captures attribute to the pilot, not just affiliate clicks. Sanitized
  // server-side in create-watchlist; "" omits it.
  const src = params.get("src") ?? "";

  const targeting =
    variant !== DEFAULT_VARIANT_KEY || condition !== DEFAULT_CONDITION
      ? `${variant !== DEFAULT_VARIANT_KEY ? labelForVariantKey(variant) : "Any printing"} · ${conditionLabel(condition)}`
      : null;

  if (state.status === "success") {
    return (
      <div className="mt-4 rounded-xl border border-foil-accent/40 bg-foil-accent/10 p-4 text-sm text-foil-cream">
        <p className="font-medium text-foil-cream">Foil is now watching this card for you.</p>
        <p className="mt-1 text-foil-cream/70">
          You&apos;ll get an email when {cardName}
          {targeting ? ` (${targeting})` : ""} hits your target price.
        </p>
        {state.vaultUrl ? (
          <p className="mt-2">
            <a
              href={state.vaultUrl}
              className="font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:decoration-foil-accent"
            >
              Open your vault →
            </a>{" "}
            <span className="text-foil-cream/70">Every card you track, on one private page.</span>
          </p>
        ) : state.vaultLinkEmailed ? (
          <p className="mt-2 text-foil-cream/70">
            Your private vault link is in your inbox. It&apos;s the one page with everything you track.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="card_slug" value={cardSlug} />
      <input type="hidden" name="variant" value={variant} />
      <input type="hidden" name="condition" value={condition} />
      {src && <input type="hidden" name="src" value={src} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="flex-1 rounded-xl border border-foil-cream/15 bg-foil-night px-4 py-3 text-sm text-foil-cream placeholder-foil-cream/40 outline-none focus:border-foil-accent focus:ring-2 focus:ring-foil-accent/30"
        />
        <input
          type="number"
          name="target_price"
          required
          min={1}
          step={1}
          placeholder="Target ($)"
          className="w-full rounded-xl border border-foil-cream/15 bg-foil-night px-4 py-3 text-sm text-foil-cream placeholder-foil-cream/40 outline-none focus:border-foil-accent focus:ring-2 focus:ring-foil-accent/30 sm:w-32"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 whitespace-nowrap rounded-xl bg-foil-cream px-6 py-3 text-sm font-semibold text-foil-navy transition-all hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60 disabled:opacity-60 disabled:hover:translate-y-0"
        >
          {pending ? "Saving…" : "Add to vault"}
        </button>
      </div>

      {targeting && (
        <p className="text-[11px] uppercase tracking-wider text-foil-cream/60">
          Tracking: <span className="font-medium text-foil-cream">{targeting}</span>
        </p>
      )}

      <label className="flex items-start gap-3 text-xs text-foil-cream/60">
        <input
          type="checkbox"
          name="opt_in_newsletter"
          defaultChecked
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-foil-cream/20 bg-foil-night text-foil-accent focus:ring-foil-accent focus:ring-offset-0"
        />
        <span>Also send me Foil&apos;s weekly deals newsletter (~1 email/week, unsubscribe anytime)</span>
      </label>

      {state.status === "error" && (
        <p className="text-xs text-foil-coral" role="alert">
          {ERROR_COPY[state.error ?? ""] ?? "Something went wrong. Try again."}
          {state.error === "watch_limit_free" && (
            <>
              {" "}
              <a href="/pro" className="font-semibold text-foil-cream underline underline-offset-2">
                Start your 30-day free trial →
              </a>
            </>
          )}
        </p>
      )}
    </form>
  );
}
