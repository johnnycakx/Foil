"use client";

// Client-hydrated "Best current listing" block (SEO crawlability fix, ADR-047 v2
// amendment). Fetches the live eBay verified listing + buy-signal from
// /api/listing/[slug] (no-store) AFTER the page's evergreen HTML has
// rendered, so the curated card page serves fast crawlable HTML instead of
// blocking the server render on a ~38s eBay fetch. The live affiliate listing
// never enters the server-rendered (crawled) DOM. R-008 holds: the endpoint is
// force-dynamic + no-store; nothing is cached.

import { useEffect, useState } from "react";
import { LiveTimestamp } from "@/components/live-timestamp";
import { BuySignalBadge } from "@/components/buy-signal-badge";
import type { LiveListingResponse } from "@/app/api/listing/[slug]/route";

const CONDITION_BADGE_LABELS: Record<string, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
  GRADED: "Graded",
};

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

function conditionBadge(condition: string): { label: string; tone: "grade" | "raw" } | null {
  const label = CONDITION_BADGE_LABELS[condition];
  if (!label) return null;
  return { label, tone: condition === "GRADED" ? "grade" : "raw" };
}

export function LiveListingSection({
  slug,
  src,
  selectedVariant,
  fallbackUrl,
}: {
  slug: string;
  /** Untrusted creator/campaign tag from the inbound link; forwarded to the
   *  endpoint, which sanitizes it via buildCustomId. */
  src?: string;
  selectedVariant?: string;
  /** Server-built affiliate search URL — the ultimate honest-null fallback if
   *  the fetch itself fails before the endpoint can return its own. */
  fallbackUrl: string;
}) {
  const [data, setData] = useState<LiveListingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (selectedVariant) qs.set("v", selectedVariant);
    if (src) qs.set("src", src);
    const url = `/api/listing/${encodeURIComponent(slug)}${qs.toString() ? `?${qs}` : ""}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<LiveListingResponse>) : null))
      .then((json) => {
        if (!alive) return;
        setData(json ?? { verified: null, buySignal: null, fallbackUrl });
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setData({ verified: null, buySignal: null, fallbackUrl });
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [slug, src, selectedVariant, fallbackUrl]);

  const verified = data?.verified ?? null;
  const cond = verified ? conditionBadge(verified.condition) : null;
  const resolvedFallback = data?.fallbackUrl ?? fallbackUrl;

  return (
    <>
      {/* Buy signal — condition-matched read of the live ask vs the same-condition
          30-day sold average. Renders only once the live data loads + is non-UNKNOWN. */}
      {data?.buySignal && data.buySignal.tier !== "UNKNOWN" && (
        <div className="mt-10">
          <BuySignalBadge signal={data.buySignal} />
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <LiveTimestamp />
      </div>

      <section
        className="mt-10 rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-xl shadow-foil-navy/10 sm:p-8"
        aria-labelledby="best-deal-heading"
        aria-busy={loading}
      >
        <div className="flex items-start justify-between gap-3">
          <h2
            id="best-deal-heading"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foil-gold"
          >
            <span className="relative inline-flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-foil-gold opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-foil-gold" />
            </span>
            Best current listing
          </h2>
          {cond ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                cond.tone === "grade" ? "bg-foil-gold/20 text-foil-navy" : "bg-foil-navy/10 text-foil-navy"
              }`}
            >
              {cond.label}
            </span>
          ) : null}
        </div>

        {loading ? (
          // Lightweight skeleton while the live listing loads (no layout shift).
          <div className="mt-4" aria-hidden>
            <div className="h-11 w-40 animate-pulse rounded-lg bg-foil-navy/10" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-foil-navy/10" />
            <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-slate">Checking live eBay listings…</p>
          </div>
        ) : verified ? (
          <>
            <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="font-display text-4xl font-bold tabular-nums text-foil-navy sm:text-5xl">
                  {formatPrice(verified.price, verified.currency)}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-foil-slate">{verified.title}</p>
              </div>
              <a
                href={verified.affiliateUrl}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-foil-navy px-6 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
              >
                Buy on eBay →
              </a>
            </div>
            <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-slate">
              Live listing · Identity-verified against the listing&apos;s own item specifics · Prices update on every page load · Affiliate-tracked — Foil earns a commission on eBay purchases that originate from this link.
            </p>
          </>
        ) : (
          <>
            {/* Honest null (the design's core promise): no verified listing beats
                showing the unverified cheapest. */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foil-slate">
                No verified listing right now. We checked the cheapest live eBay
                listings and couldn&apos;t confirm an exact match for this card —
                rather than show you a maybe-wrong one, browse the live search yourself.
              </p>
              <a
                href={resolvedFallback}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-foil-navy/20 bg-foil-cream px-6 py-3 text-sm font-semibold text-foil-navy transition hover:border-foil-gold/40 hover:bg-foil-gold/5"
              >
                Browse on eBay →
              </a>
            </div>
            <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-slate">
              Affiliate-tracked search · Foil earns a commission on eBay purchases that originate from this link.
            </p>
          </>
        )}
      </section>
    </>
  );
}
