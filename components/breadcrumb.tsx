// Breadcrumb — Server Component. Renders the path
// `Home / Cards / <Set Name> / <Card Name>` with schema.org
// BreadcrumbList JSON-LD embedded. Session 41 / ADR-030.
//
// Embed pattern: each consumer page calls `breadcrumbListSchema(items, siteUrl)`
// from lib/seo/schema-helpers and feeds the result through its existing
// schemaGraph() chain. The visual breadcrumb (this component) and the
// JSON-LD are rendered side-by-side — they share the `items` array so a
// schema-drift bug shows up immediately to a human reader, not just to
// Googlebot.

import Link from "next/link";

export type BreadcrumbItem = {
  /** Display label, e.g. "Cards" or "Base". */
  label: string;
  /** Relative path. Last item (current page) typically passes the page's
   *  own path — rendered as plain text, not a link. */
  href: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;
  const last = items.length - 1;
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex flex-wrap items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-foil-cream/60"
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === last;
          return (
            <li key={`${item.href}-${i}`} className="flex items-center gap-1">
              {isLast ? (
                <span aria-current="page" className="text-foil-cream">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="transition hover:text-foil-cream hover:underline hover:decoration-foil-accent"
                >
                  {item.label}
                </Link>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-foil-cream/40">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
