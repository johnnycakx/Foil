"use client";

// Pre-placement restock-alert signup rendered on /machines (vending Phase V-1).
// Email required, city optional; writes a machine_restock_alerts row + Beehiiv
// machines-waitlist tag via the createRestockAlert Server Action.
//
// COPY FIREWALL (strategy §4 rule 1): vending surface. The finder side's
// trust vocabulary must not appear here (token list lives in
// lib/__tests__/vending-surfaces.test.ts, which scans this file's source).

import { useActionState } from "react";
import { createRestockAlert, type RestockAlertFormState } from "@/app/actions/restock-alert";

const INITIAL: RestockAlertFormState = { status: "idle" };

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That email doesn't look right. Check it and try again.",
  unavailable: "Signups are briefly unavailable. Try again in a minute.",
  save_failed: "Could not save your signup. Try again.",
};

export function RestockAlertForm() {
  const [state, formAction, isPending] = useActionState(createRestockAlert, INITIAL);

  if (state.status === "success") {
    return (
      <div
        className="rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-6 text-foil-navy"
        aria-live="polite"
      >
        <p className="font-display text-lg font-bold tracking-[-0.02em]">You&apos;re on the list.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-foil-slate">
          The moment the first machine lands, you&apos;ll hear about it. If you told us your
          city, it counts toward where the machines go.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-lg shadow-foil-navy/10 sm:p-8"
    >
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
        Hear about the first machine before anyone else.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foil-slate">
        One email when a machine lands near you. Your city helps decide where the
        machines go.
      </p>

      {/* Honeypot — hidden from real users, bots fill it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="restock-website">Website</label>
        <input id="restock-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label htmlFor="restock-email" className="sr-only">
            Email address
          </label>
          <input
            id="restock-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@gmail.com"
            disabled={isPending}
            className="w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/70 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 disabled:opacity-60"
          />
        </div>
        <div className="min-w-0 sm:w-44">
          <label htmlFor="restock-city" className="sr-only">
            Your city (optional)
          </label>
          <input
            id="restock-city"
            name="city"
            type="text"
            autoComplete="address-level2"
            placeholder="Your city (optional)"
            disabled={isPending}
            className="w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/70 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-foil-navy px-5 py-3 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy disabled:hover:ring-0"
        >
          {isPending ? "Saving…" : "Tell me first"}
        </button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-foil-navy">
          {ERROR_COPY[state.error ?? ""] ?? ERROR_COPY.save_failed}
        </p>
      )}
    </form>
  );
}
