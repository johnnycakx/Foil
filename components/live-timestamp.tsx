"use client";

// Live timestamp chip — Client component. Renders a small "Just now" /
// "X seconds ago" / "X minutes ago" indicator next to the best-listing
// block so the visitor can see the data was fetched fresh on this page
// load. Updates every 10 seconds while the page is open.
//
// Aria-live="polite" so a screen reader announces the freshness when it
// changes, without being interruptive. Foil-gold pulse dot reuses the
// "live" affordance used elsewhere (header wordmark, best-listing block).
//
// Session 41 / ADR-030.

import { useEffect, useState } from "react";

type Props = {
  /** Optional label to render before the relative time. Default "Live". */
  label?: string;
};

function formatRelative(secondsAgo: number): string {
  if (secondsAgo < 5) return "Just now";
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
  if (secondsAgo < 3600) {
    const m = Math.floor(secondsAgo / 60);
    return `${m} min ago`;
  }
  const h = Math.floor(secondsAgo / 3600);
  return `${h}h ago`;
}

export function LiveTimestamp({ label = "Live" }: Props) {
  // Anchor the clock at first client paint so the relative time is
  // honest about when the user opened THIS page (not when the page was
  // built or cached).
  const [start] = useState(() => Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const tick = () => setSecondsAgo((Date.now() - start) / 1000);
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [start]);

  return (
    <p
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full border border-foil-gold/40 bg-foil-cream px-3 py-1 text-xs font-medium text-foil-navy shadow-sm shadow-foil-navy/5"
    >
      <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-gold opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-gold" />
      </span>
      <span>{label}</span>
      <span className="text-foil-slate">·</span>
      <span className="font-mono tabular-nums text-foil-slate">{formatRelative(secondsAgo)}</span>
    </p>
  );
}
