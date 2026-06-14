"use client";

// /host venue-funnel lead form (vending Phase V-1, strategy §5b field list).
// ~6 required fields, rest optional; posts to the createHostLead Server
// Action (honeypot + validation + per-email rate limit + Discord ping).
//
// COPY FIREWALL (strategy §4 rule 1 + §5b FTC hard NOs): vending surface.
// The finder side's trust vocabulary is banned here, as are income
// projections and recurring-income-without-work vocabulary. Token lists live
// in lib/__tests__/vending-surfaces.test.ts, which scans this file's source.

import { useActionState } from "react";
import { createHostLead, type HostLeadFormState } from "@/app/actions/host-lead";
import {
  VENUE_TYPES,
  FOOT_TRAFFIC_BUCKETS,
  OUTLET_ANSWERS,
  HOST_PRIORITIES,
  type VenueType,
  type FootTrafficBucket,
  type OutletAnswer,
  type HostPriority,
} from "@/lib/vending/validate";

const INITIAL: HostLeadFormState = { status: "idle" };

const VENUE_LABELS: Record<VenueType, string> = {
  card_shop: "Card / hobby shop",
  barbershop: "Barbershop / salon",
  bowling_fec: "Bowling alley / family entertainment",
  mall: "Mall / retail center",
  grocery: "Grocery / convenience",
  other: "Other",
};

const TRAFFIC_LABELS: Record<FootTrafficBucket, string> = {
  under_50: "Under 50 people a day",
  "50_200": "50 to 200 a day",
  "200_500": "200 to 500 a day",
  over_500: "Over 500 a day",
  unsure: "Not sure",
};

const OUTLET_LABELS: Record<OutletAnswer, string> = {
  yes: "Yes",
  no: "No",
  unsure: "Not sure",
};

const PRIORITY_LABELS: Record<HostPriority, string> = {
  reliability: "Reliability and service",
  appearance: "How it looks in my space",
  revenue: "The revenue share",
  amenity: "Something extra for my customers",
};

const ERROR_COPY: Record<string, string> = {
  missing_name: "Add your name so we know who to ask for.",
  missing_business_name: "Add your business name.",
  missing_venue_type: "Pick the option closest to your venue.",
  missing_city: "Add your city.",
  invalid_email: "That email doesn't look right. Check it and try again.",
  missing_foot_traffic: "Pick a foot-traffic range, or choose Not sure.",
  rate_limited: "We already have your submissions from today. We'll be in touch.",
  unavailable: "The form is briefly unavailable. Try again in a minute.",
  save_failed: "Could not save your details. Try again.",
  send_failed: "Something went wrong sending that. Try again in a moment.",
};

const inputClass =
  "w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/70 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30 disabled:opacity-60";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-widest text-foil-slate";

export function HostLeadForm({ compact = false }: { compact?: boolean } = {}) {
  // `compact` (homepage) renders only the required fields; the full form with
  // the optional venue details lives on /host. The Server Action validates the
  // same required set either way, so the compact path stays valid.
  const [state, formAction, isPending] = useActionState(createHostLead, INITIAL);

  if (state.status === "success") {
    return (
      <div
        className="rounded-2xl border border-foil-gold/40 bg-foil-gold/10 p-7 text-foil-navy sm:p-8"
        aria-live="polite"
      >
        <p className="font-display text-xl font-bold tracking-[-0.02em]">Got it. John will reach out.</p>
        <p className="mt-2 text-sm leading-relaxed text-foil-slate">
          Expect a personal email within a few days, not a sequence. If your venue is a
          fit, the next step is a short call and a walk-through of the terms in writing.
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
        Tell us about your space.
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foil-slate">
        {compact ? "Six quick fields." : "Six quick fields, the rest optional."} No
        commitment on either side until terms are agreed in writing.
      </p>

      {/* Honeypot — hidden from real users, bots fill it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="host-website">Website</label>
        <input id="host-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="host-name" className={labelClass}>
            Your name *
          </label>
          <input id="host-name" name="name" type="text" required maxLength={120} autoComplete="name" disabled={isPending} className={inputClass} />
        </div>
        <div>
          <label htmlFor="host-business" className={labelClass}>
            Business name *
          </label>
          <input id="host-business" name="business_name" type="text" required maxLength={160} autoComplete="organization" disabled={isPending} className={inputClass} />
        </div>
        <div>
          <label htmlFor="host-venue-type" className={labelClass}>
            Venue type *
          </label>
          <select id="host-venue-type" name="venue_type" required defaultValue="" disabled={isPending} className={inputClass}>
            <option value="" disabled>
              Pick the closest fit
            </option>
            {VENUE_TYPES.map((v) => (
              <option key={v} value={v}>
                {VENUE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="host-city" className={labelClass}>
            City *
          </label>
          <input id="host-city" name="city" type="text" required maxLength={120} autoComplete="address-level2" disabled={isPending} className={inputClass} />
        </div>
        <div>
          <label htmlFor="host-email" className={labelClass}>
            Email *
          </label>
          <input id="host-email" name="email" type="email" required autoComplete="email" disabled={isPending} className={inputClass} />
        </div>
        {!compact && (
          <div>
            <label htmlFor="host-phone" className={labelClass}>
              Phone (optional)
            </label>
            <input id="host-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" disabled={isPending} className={inputClass} />
          </div>
        )}
        <div>
          <label htmlFor="host-traffic" className={labelClass}>
            Daily foot traffic *
          </label>
          <select id="host-traffic" name="foot_traffic" required defaultValue="" disabled={isPending} className={inputClass}>
            <option value="" disabled>
              Rough range is fine
            </option>
            {FOOT_TRAFFIC_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {TRAFFIC_LABELS[b]}
              </option>
            ))}
          </select>
        </div>
        {!compact && (
          <>
            <div>
              <label htmlFor="host-sells-cards" className={labelClass}>
                Do you already sell trading cards?
              </label>
              <select id="host-sells-cards" name="sells_cards" defaultValue="" disabled={isPending} className={inputClass}>
                <option value="">Prefer not to say</option>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div>
              <label htmlFor="host-outlet" className={labelClass}>
                Space + standard outlet available?
              </label>
              <select id="host-outlet" name="placement_outlet" defaultValue="" disabled={isPending} className={inputClass}>
                <option value="">Not sure yet</option>
                {OUTLET_ANSWERS.map((o) => (
                  <option key={o} value={o}>
                    {OUTLET_LABELS[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="host-priority" className={labelClass}>
                What matters most to you?
              </label>
              <select id="host-priority" name="priority" defaultValue="" disabled={isPending} className={inputClass}>
                <option value="">Pick one (optional)</option>
                {HOST_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="host-hours" className={labelClass}>
                Hours the machine would be reachable (optional)
              </label>
              <input id="host-hours" name="hours_of_access" type="text" maxLength={160} placeholder="e.g. Mon to Sat, 10am to 9pm" disabled={isPending} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="host-notes" className={labelClass}>
                Anything else (optional)
              </label>
              <textarea id="host-notes" name="notes" rows={3} maxLength={2000} placeholder="Anything about your space, your customers, or your questions." disabled={isPending} className={inputClass} />
            </div>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-6 w-full rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy disabled:hover:ring-0 sm:w-auto"
      >
        {isPending ? "Sending…" : "Start the conversation"}
      </button>

      {state.status === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-foil-navy">
          {ERROR_COPY[state.error ?? ""] ?? ERROR_COPY.save_failed}
        </p>
      )}
    </form>
  );
}
