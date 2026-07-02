// Buy-signal badge (ROADMAP #32 / ADR-053). Server component. Renders a calm,
// analytical BELOW / AT / ABOVE classification of the current ask vs recent
// sold prices, or nothing (UNKNOWN -> null). No hype: muted tones, no emoji, no
// exclamation marks, no "deal"/"discount" framing. ABOVE is amber, not red, on
// purpose. The whole badge links to /pricing-methodology; a hover/focus tooltip
// shows the sample size + window. Copy says "30-day sold" (the reference is the
// 30-day sold average today, not a literal median) per the methodology page.

import Link from "next/link";
import type { BuySignal } from "@/lib/buy-signal/compute";

const STYLES: Record<"BELOW" | "AT" | "ABOVE", { ring: string; label: string }> = {
  BELOW: { ring: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25", label: "Below 30-day sold" },
  AT: { ring: "bg-foil-night-2 text-foil-cream/70 ring-foil-cream/15", label: "At 30-day sold" },
  ABOVE: { ring: "bg-amber-400/15 text-amber-300 ring-amber-400/25", label: "Above 30-day sold" },
};

export function BuySignalBadge({ signal }: { signal: BuySignal }) {
  if (signal.tier === "UNKNOWN") return null;
  const s = STYLES[signal.tier];

  // Delta suffix: BELOW shows the negative delta, ABOVE a +delta, AT none.
  let suffix = "";
  if (signal.deltaPercent != null) {
    if (signal.tier === "BELOW") suffix = ` (${signal.deltaPercent}%)`;
    else if (signal.tier === "ABOVE") suffix = ` (+${signal.deltaPercent}%)`;
  }

  const tip = `Current asking price vs the 30-day sold average across ${signal.sampleSize} sales. How we compute this.`;

  return (
    <Link
      href="/pricing-methodology"
      aria-label={`${s.label}${suffix}. ${tip}`}
      className="group relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-foil-accent/60"
    >
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${s.ring}`}>
        {s.label}
        {suffix && <span className="font-mono tabular-nums">{suffix.trim()}</span>}
      </span>
      <span className="text-xs text-foil-cream/60">n={signal.sampleSize}</span>
      {/* Hover/focus tooltip (CSS only, no client JS). */}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 rounded-lg border border-foil-cream/15 bg-foil-night-2 px-3 py-2 text-xs leading-snug text-foil-cream opacity-0 shadow-[0_8px_24px_-8px_rgba(4,9,18,0.8)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        Based on {signal.sampleSize} sales over the last {signal.windowDays} days. How we compute this.
      </span>
    </Link>
  );
}
