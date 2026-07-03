// DetailSection: the card page's collapsible depth shell (card-page-vault-
// first goal). Server component, deliberately zero client JS.
//
// The vault-first hierarchy demotes the deep data (variants, sold table,
// card details) into expandable sections. The SEO contract is that collapsed
// content still ships in the server-rendered DOM (no client-fetch-on-expand),
// which native <details>/<summary> gives us for free: the content is always
// in the HTML, the disclosure state is a browser attribute. Pinned by the
// vault-first block in lib/__tests__/visual-regression.test.ts.
//
// Motion (emil-design-eng): the chevron rotates via a transform transition
// (interruptible, GPU-only); the body gets a one-shot rise-in entrance,
// motion-safe gated in globals.css. No height animation, no layout thrash.

import type { ReactNode } from "react";

export function DetailSection({
  title,
  meta,
  open,
  headingId,
  children,
}: {
  title: string;
  /** Optional right-aligned meta chip (e.g. a source credit). */
  meta?: ReactNode;
  /** Render expanded by default (the chart section); omit for collapsed. */
  open?: boolean;
  /** Optional id for #anchor targets on the summary heading. */
  headingId?: string;
  children: ReactNode;
}) {
  return (
    <details
      open={open}
      className="group mt-6 rounded-2xl border border-foil-cream/10 bg-foil-night-2"
    >
      <summary
        className="flex cursor-pointer select-none list-none items-center justify-between gap-3 rounded-2xl px-6 py-4 outline-none transition focus-visible:ring-2 focus-visible:ring-foil-accent/40 sm:px-8 [&::-webkit-details-marker]:hidden"
      >
        <span
          id={headingId}
          className="text-sm font-semibold uppercase tracking-wider text-foil-accent"
        >
          {title}
        </span>
        <span className="flex items-center gap-3">
          {meta}
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0 text-foil-cream/60 transition-transform duration-200 ease-out group-open:rotate-180"
          >
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>
      <div className="detail-body px-6 pb-6 sm:px-8 sm:pb-8">{children}</div>
    </details>
  );
}
