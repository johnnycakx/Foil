// "Today's best deals" board (ROADMAP B.4 / ADR-054). Server component.
//
// Renders ENTIRELY from the buy_signals cache (DealRow[]) — no eBay call at
// render time (R-008 + R-012). Columns per docs/website-copy-deal-finder.md:
//   Card · Recent sold (condition-matched) · Below by · See it on eBay
// "Below by" is the hook → it's the most prominent column. The literal eBay
// "Live ask" column from the copy is intentionally NOT shown: we never persist
// or republish an eBay listing price (ADR-054). The live listing resolves on
// click via the affiliate "See it on eBay" CTA. Brand tokens; mobile-first;
// calm/analytical voice (Gate 12/13) — no "steal", no urgency, no emoji.

import Link from "next/link";
import Image from "next/image";
import { affiliateSearchUrl, buildCustomId } from "@/lib/affiliate/epn";
import type { DealRow } from "@/lib/deals/leaderboard";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** PokeTrace tier key → human label for the condition-matched sold reference. */
function humanTier(tier: string | null): string {
  if (!tier) return "";
  const raw: Record<string, string> = {
    NEAR_MINT: "Near Mint",
    LIGHTLY_PLAYED: "Lightly Played",
    MODERATELY_PLAYED: "Moderately Played",
    HEAVILY_PLAYED: "Heavily Played",
    DAMAGED: "Damaged",
  };
  if (raw[tier]) return raw[tier];
  // Graded keys like "PSA_9" / "BGS_9_5" → "PSA 9" / "BGS 9.5".
  return tier.replace(/_/g, " ").replace(/(\d) (5)$/, "$1.$2");
}

export function DealsBoard({ deals }: { deals: DealRow[] }) {
  if (deals.length === 0) {
    return (
      <div className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-8 text-center shadow-sm shadow-foil-navy/5">
        <p className="text-foil-navy">We&apos;re re-checking the market right now.</p>
        <p className="mt-2 text-sm text-foil-slate">
          New below-market listings post here every day. Check back shortly, or get them by email below.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-foil-navy/10 bg-foil-cream shadow-sm shadow-foil-navy/5">
      {/* Column header — hidden on the smallest screens (the row layout stacks
          and self-labels there). */}
      <div className="hidden border-b border-foil-navy/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-foil-slate sm:grid sm:grid-cols-[2rem_1fr_8rem_7rem_7rem] sm:items-center sm:gap-4">
        <span aria-hidden>#</span>
        <span>Card</span>
        <span className="text-right">Recent sold</span>
        <span className="text-right text-foil-gold">Below by</span>
        <span className="text-right">See it</span>
      </div>

      <ol className="divide-y divide-foil-navy/10">
        {deals.map((d, i) => {
          const below = d.deltaPct != null ? Math.round(Math.abs(d.deltaPct)) : null;
          const ctaUrl = affiliateSearchUrl(
            `${d.cardName} ${d.setName}`.trim(),
            buildCustomId({ tier: "deals", slug: d.cardSlug }),
          );
          return (
            <li
              key={d.cardSlug}
              className="grid grid-cols-[1fr_5rem] items-center gap-3 px-4 py-4 sm:grid-cols-[2rem_1fr_8rem_7rem_7rem] sm:gap-4 sm:px-5"
            >
              {/* Rank — desktop only (kept out of the mobile two-col grid). */}
              <span
                aria-hidden
                className="hidden font-mono text-sm tabular-nums text-foil-slate sm:inline"
              >
                {i + 1}
              </span>

              {/* Card identity */}
              <Link
                href={`/cards/${d.cardSlug}`}
                className="flex min-w-0 items-center gap-3 transition hover:text-foil-coral"
              >
                {d.imageUrl ? (
                  <Image
                    src={d.imageUrl}
                    alt=""
                    width={48}
                    height={67}
                    unoptimized
                    className="h-12 w-auto shrink-0 rounded-md border border-foil-navy/10 shadow-sm shadow-foil-navy/10"
                  />
                ) : (
                  <span aria-hidden className="h-12 w-9 shrink-0 rounded-md border border-foil-navy/10 bg-foil-cream" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foil-navy">{d.cardName}</span>
                  <span className="block truncate text-xs text-foil-slate">{d.setName}</span>
                  {/* Mobile-only inline sold + below (the desktop columns are hidden here). */}
                  <span className="mt-1 block text-xs text-foil-slate sm:hidden">
                    {d.soldReference != null ? <>Sold {formatUsd(d.soldReference)}</> : null}
                    {d.matchedTier ? <> · {humanTier(d.matchedTier)}</> : null}
                  </span>
                </span>
              </Link>

              {/* Recent sold (condition-matched) — desktop column */}
              <span className="hidden text-right sm:block">
                <span className="block font-semibold tabular-nums text-foil-navy">
                  {d.soldReference != null ? formatUsd(d.soldReference) : "—"}
                </span>
                {d.matchedTier ? (
                  <span className="block text-[11px] text-foil-slate">{humanTier(d.matchedTier)}</span>
                ) : null}
              </span>

              {/* Below by — THE hook. Mobile: shown in the right cell; desktop:
                  its own prominent gold column. */}
              <span className="text-right">
                <span className="font-display block text-2xl font-bold tabular-nums leading-none text-foil-navy sm:text-3xl">
                  {below != null ? `${below}%` : "—"}
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-foil-gold">below sold</span>
              </span>

              {/* See it on eBay — resolves the live listing on click (affiliate). */}
              <a
                href={ctaUrl}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="col-span-2 mt-1 inline-flex items-center justify-center rounded-full bg-foil-navy px-4 py-2 text-xs font-semibold text-foil-cream shadow-sm shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:ring-2 hover:ring-foil-gold/40 sm:col-span-1 sm:mt-0"
              >
                See it on eBay →
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
