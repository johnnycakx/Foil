import type { MDXComponents } from "mdx/types";
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";

type CalloutVariant = "info" | "warning" | "tip";

const CALLOUT_STYLES: Record<
  CalloutVariant,
  { wrap: string; label: string; tag: string }
> = {
  info: {
    wrap: "border-sky-400/30 bg-sky-500/5 text-sky-100",
    label: "text-sky-300",
    tag: "Note",
  },
  warning: {
    wrap: "border-amber-400/30 bg-amber-500/5 text-amber-100",
    label: "text-amber-300",
    tag: "Heads up",
  },
  tip: {
    wrap: "border-emerald-400/30 bg-emerald-500/5 text-emerald-100",
    label: "text-emerald-300",
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
      <div className="text-zinc-100/90 [&>p]:my-0 [&>p+p]:mt-2">{children}</div>
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
    <div className="not-prose my-8 overflow-hidden rounded-2xl border border-[#FF6B5C]/30 bg-gradient-to-br from-[#101D38] via-[#0B1428] to-[#101D38] p-6 shadow-xl shadow-[#FF6B5C]/5 sm:p-8">
      <p className="text-xs font-medium uppercase tracking-wider text-[#FFC7BA]">
        Foil scanner
      </p>
      <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
        {headline}
      </h3>
      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-300">{body}</p>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF6B5C] px-4 py-2.5 text-sm font-semibold text-[#0B1428] transition hover:bg-[#FF8775]"
      >
        {cta}
        <span aria-hidden>→</span>
      </Link>
    </div>
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
      className="inline-flex items-baseline gap-1 font-medium text-[#FF6B5C] underline decoration-[#FF6B5C]/40 underline-offset-4 transition hover:decoration-[#FF6B5C]"
    >
      {children}
      <span aria-hidden className="text-[#FF6B5C]">
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
  TopicLink,
  a: Anchor,
  pre: (props: HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="my-5 overflow-x-auto rounded-xl border border-white/10 bg-[#0B1428] p-4 text-sm leading-6"
    />
  ),
  code: (props: HTMLAttributes<HTMLElement>) => (
    <code
      {...props}
      className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.92em] text-zinc-100"
    />
  ),
};

export function useMDXComponents(): MDXComponents {
  return components;
}
