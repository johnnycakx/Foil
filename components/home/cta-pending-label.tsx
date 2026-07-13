"use client";

// The label inside a primary <Link> CTA, aware of the navigation it starts.
//
// Round-2 tour Major: "Start your vault" gave zero reaction — "no indication
// that we're loading onto a new page, which is a massive issue." App-router
// navigations aren't instant (the destination renders on the server), so the
// button must answer the tap itself: useLinkStatus flips the label + shows a
// quiet working ring the moment the navigation is in flight. The press state
// itself is CSS (active:) on the Link.

import { useLinkStatus } from "next/link";

export function CtaPendingLabel({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-2.5" aria-live="polite">
      {pending && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-foil-navy/25 border-t-foil-navy motion-reduce:animate-none motion-reduce:border-foil-navy/60"
        />
      )}
      {pending ? pendingLabel : label}
    </span>
  );
}
