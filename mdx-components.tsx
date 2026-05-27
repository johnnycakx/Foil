import type { MDXComponents } from "mdx/types";
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";

// Session 42 / ADR-031: every custom blog-body component migrated to
// the cream/navy/gold palette. The pre-Session-39 versions of these
// components rendered light text on dark backdrops; on the new cream
// surface that read as invisible (Callout "Heads up" was washed-out
// amber-on-cream). All components now render foil-navy text on
// foil-cream surfaces, with foil-gold as the default accent and
// foil-coral reserved for the warning Callout's signal color.

type CalloutVariant = "info" | "warning" | "tip";

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { wrap: string; label: string; tag: string }
> = {
  // Per Session 42 spec: the "Heads up" tag (warning variant) renders
  // GOLD-accent — same family as info + tip. Coral is reserved for the
  // strict hover-only rule (ADR-029) plus error states (Session 39
  // SESSION-LOG). None of the existing blog posts use a true warning-
  // tone callout that would justify a coral-stripe variant; if one
  // emerges, add a new `warn` / "Watch out" variant alongside these
  // three rather than overloading the warning-as-Heads-up slot.
  info: {
    wrap: "border-foil-navy/15 bg-foil-cream text-foil-navy shadow-sm shadow-foil-navy/5",
    label: "text-foil-gold",
    tag: "Note",
  },
  warning: {
    wrap: "border-foil-gold/40 bg-foil-cream text-foil-navy shadow-sm shadow-foil-navy/5",
    label: "text-foil-gold",
    tag: "Heads up",
  },
  tip: {
    wrap: "border-foil-gold/50 bg-foil-gold/5 text-foil-navy shadow-sm shadow-foil-navy/5",
    label: "text-foil-gold",
    tag: "Pro tip",
  },
};

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: CalloutVariant;
  title?: string;
  children: ReactNode;
}) {
  const style = CALLOUT_STYLES[variant];
  return (
    <aside
      className={`not-prose my-6 rounded-2xl border px-5 py-4 text-sm leading-6 ${style.wrap}`}
      role="note"
    >
      <p className={`mb-1 text-xs font-semibold uppercase tracking-wider ${style.label}`}>
        {title ?? style.tag}
      </p>
      <div className="text-foil-navy [&>p]:my-0 [&>p+p]:mt-2">{children}</div>
    </aside>
  );
}

/**
 * Inline scanner CTA — visually echoes the /upload landing tile so a blog
 * reader sees what they're walking into. Not a working uploader (auth + rate
 * limit live on /upload); intent is to convert the reader, not duplicate the
 * scanning pipeline in unauthed marketing surfaces.
 */
export function CardScannerEmbed({
  headline = "Scan a card now",
  body = "Snap one card. Foil reads the printed name, set code, and collector number — and returns eBay + TCGplayer + graded comps in under 10 seconds.",
  cta = "Try the scanner",
  href = "/upload",
}: {
  headline?: string;
  body?: string;
  cta?: string;
  href?: string;
}) {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-xl shadow-foil-navy/10 sm:p-8">
      <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">
        Foil scanner
      </p>
      <h3 className="font-display mt-2 text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
        {headline}
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-foil-slate">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-foil-navy px-4 py-2.5 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
      >
        {cta}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

/**
 * Renders a FAQ section. Posts pass the same {question, answer} array that
 * lives in frontmatter — keeping content in one place means the rendered FAQ
 * and the FAQPage JSON-LD never drift apart. Use as `<FAQ items={faq} />` from
 * MDX (the page route passes the parsed frontmatter array down) or pass items
 * inline for one-off cases.
 */
export function FAQ({
  items,
  heading = "Frequently asked questions",
}: {
  items: ReadonlyArray<{ question: string; answer: string }>;
  heading?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="not-prose mt-12">
      <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-foil-navy sm:text-3xl">
        {heading}
      </h2>
      <div className="mt-6 space-y-4">
        {items.map((q) => (
          <div
            key={q.question}
            className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-5 shadow-sm shadow-foil-navy/5 transition hover:border-foil-gold/40 hover:bg-foil-gold/5"
          >
            <h3 className="font-display text-lg font-bold text-foil-navy">{q.question}</h3>
            <p className="mt-2 text-foil-navy/85">{q.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Internal pillar/cluster link with a trailing arrow. Used in MDX to make
 * topic-cluster cross-links visually distinct from inline prose links so the
 * site graph is obvious to both readers and crawlers.
 */
export function TopicLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-baseline gap-1 font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 transition hover:text-foil-coral"
    >
      {children}
      <span aria-hidden className="text-foil-gold">
        →
      </span>
    </Link>
  );
}

function Anchor({
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) return <a {...rest}>{children}</a>;
  const isInternal = href.startsWith("/") || href.startsWith("#");
  if (isInternal) {
    return (
      <Link href={href} {...(rest as Record<string, unknown>)}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  );
}

const components: MDXComponents = {
  Callout,
  CardScannerEmbed,
  FAQ,
  TopicLink,
  a: Anchor,
  // Match the prose-pre styling in `app/(site)/blog/[slug]/page.tsx` so the
  // MDX override and the prose chain agree on dark-on-cream code blocks.
  pre: (props: HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="my-5 overflow-x-auto rounded-xl border border-foil-navy/15 bg-foil-navy p-4 text-sm leading-6 text-foil-cream"
    />
  ),
  // Same parity with `prose-code:bg-foil-navy/10 prose-code:text-foil-navy`.
  code: (props: HTMLAttributes<HTMLElement>) => (
    <code
      {...props}
      className="rounded bg-foil-navy/10 px-1.5 py-0.5 font-mono text-[0.92em] text-foil-navy"
    />
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
