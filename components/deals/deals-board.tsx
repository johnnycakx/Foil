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
import type { DealRow } from "@/lib/deals/leaderboard";
import { dealsGateState, TEASER_COUNT } from "@/lib/deals/gate";
import { DealsDropGate } from "./deals-drop-gate";

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
  // Gated teaser (ADR-112): top 2 deals shown fully (proof it's real), the rest
  // visibly LOCKED behind the drop subscribe. Thin-day honesty — dealsGateState
  // never fabricates a locked count when supply is 0–2.
  const gate = dealsGateState(deals.length);
  const shown = deals.slice(0, TEASER_COUNT);
  const locked = deals.slice(TEASER_COUNT);

  if (deals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-foil-cream/12 bg-foil-night-2 p-8 text-center shadow-sm shadow-foil-navy/5">
          <p className="text-foil-cream">We&apos;re re-checking the market right now.</p>
          <p className="mt-2 text-sm text-foil-cream/60">
            New below-market listings post here every day. Check back shortly, or get them by email below.
          </p>
        </div>
        <DealsDropGate headline={gate.headline} subtext={gate.subtext} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
    <div className="overflow-hidden rounded-2xl border border-foil-cream/12 bg-foil-night-2">
      {/* Column header — hidden on the smallest screens (the row layout stacks
          and self-labels there). */}
      <div className="hidden border-b border-foil-cream/12 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-foil-cream/60 sm:grid sm:grid-cols-[2rem_1fr_8rem_7rem_7rem] sm:items-center sm:gap-4">
        <span aria-hidden>#</span>
        <span>Card</span>
        <span className="text-right">Recent sold</span>
        <span className="text-right text-foil-accent">Below by</span>
        <span className="text-right">See it</span>
      </div>

      <ol className="divide-y divide-foil-cream/10">
        {shown.map((d, i) => {
          const below = d.deltaPct != null ? Math.round(Math.abs(d.deltaPct)) : null;
          // Click-time redirect (ADR-056): /go/deal/[slug] runs a LIVE
          // getBestListing and lands the buyer on the specific best listing
          // (falling back to an affiliate search). No Browse call at view time.
          const ctaUrl = `/go/deal/${d.cardSlug}`;
          return (
            <li
              key={d.cardSlug}
              className="grid grid-cols-[1fr_5rem] items-center gap-3 px-4 py-4 sm:grid-cols-[2rem_1fr_8rem_7rem_7rem] sm:gap-4 sm:px-5"
            >
              {/* Rank — desktop only (kept out of the mobile two-col grid). */}
              <span
                aria-hidden
                className="hidden font-mono text-sm tabular-nums text-foil-cream/60 sm:inline"
              >
                {i + 1}
              </span>

              {/* Card identity */}
              <Link
                href={`/cards/${d.cardSlug}`}
                className="flex min-w-0 items-center gap-3 transition hover:text-foil-accent"
              >
                {d.imageUrl ? (
                  <Image
                    src={d.imageUrl}
                    alt=""
                    width={48}
                    height={67}
                    unoptimized
                    className="h-16 w-auto shrink-0 rounded-lg border border-foil-cream/12 shadow-[0_4px_14px_rgba(4,9,18,0.6)]"
                  />
                ) : (
                  <span aria-hidden className="h-12 w-9 shrink-0 rounded-md border border-foil-cream/12 bg-foil-night" />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-foil-cream">{d.cardName}</span>
                  <span className="block truncate text-xs text-foil-cream/60">{d.setName}</span>
                  {/* Mobile-only inline sold + below (the desktop columns are hidden here). */}
                  <span className="mt-1 block text-xs text-foil-cream/60 sm:hidden">
                    {d.soldReference != null ? <>Sold {formatUsd(d.soldReference)}</> : null}
                    {d.matchedTier ? <> · {humanTier(d.matchedTier)}</> : null}
                  </span>
                </span>
              </Link>

              {/* Recent sold (condition-matched) — desktop column */}
              <span className="hidden text-right sm:block">
                <span className="block font-semibold tabular-nums text-foil-cream">
                  {d.soldReference != null ? formatUsd(d.soldReference) : "—"}
                </span>
                {d.matchedTier ? (
                  <span className="block text-[11px] text-foil-cream/60">{humanTier(d.matchedTier)}</span>
                ) : null}
              </span>

              {/* Below by — THE hook. Mobile: shown in the right cell; desktop:
                  its own prominent gold column. */}
              <span className="text-right">
                <span className="font-display block text-2xl font-bold tabular-nums leading-none text-foil-cream sm:text-3xl">
                  {below != null ? `${below}%` : "—"}
                </span>
                <span className="block text-[11px] uppercase tracking-wider text-foil-accent">below sold</span>
                {/* Drawn magnitude bar (design-round3-fixes §2). ADR-054: the
                    live ask is never republished, so this draws only the % —
                    a depth gauge, not a price position. */}
                {below != null ? (
                  <span aria-hidden className="relative mt-2 ml-auto block h-1 w-20 overflow-hidden rounded-full bg-foil-cream/10">
                    <span
                      className="absolute inset-y-0 right-0 rounded-full bg-foil-accent/70"
                      style={{ width: `${Math.min(90, below * 2.4)}%` }}
                    />
                  </span>
                ) : null}
              </span>

              {/* See it on eBay — resolves the live listing on click (affiliate). */}
              <a
                href={ctaUrl}
                target="_blank"
                rel="sponsored noopener noreferrer"
                className="col-span-2 mt-1 inline-flex items-center justify-center rounded-full border border-foil-accent/40 px-4 py-2 text-xs font-semibold text-foil-accent transition-all hover:-translate-y-0.5 hover:bg-foil-accent/10 sm:col-span-1 sm:mt-0"
              >
                See it on eBay →
              </a>
            </li>
          );
        })}

        {/* Visibly LOCKED rows — the card is dimmed + blurred so it's clearly
            "there but gated" (no sold/below/CTA leaked); the drop subscribe
            below unlocks the daily email. Never rendered on thin days (locked
            is empty when supply ≤ 2). */}
        {locked.map((d) => (
          <li
            key={`locked-${d.cardSlug}`}
            className="grid grid-cols-[1fr_5rem] items-center gap-3 px-4 py-4 sm:grid-cols-[2rem_1fr_8rem_7rem_7rem] sm:gap-4 sm:px-5"
            aria-hidden
          >
            <span className="hidden font-mono text-sm tabular-nums text-foil-cream/30 sm:inline">🔒</span>
            <div className="flex min-w-0 items-center gap-3">
              {d.imageUrl ? (
                <Image
                  src={d.imageUrl}
                  alt=""
                  width={48}
                  height={67}
                  unoptimized
                  className="h-16 w-auto shrink-0 rounded-lg border border-foil-cream/12 opacity-30 blur-[3px]"
                />
              ) : (
                <span className="h-16 w-11 shrink-0 rounded-lg border border-foil-cream/12 bg-foil-night opacity-40" />
              )}
              <span className="h-3 w-32 max-w-full rounded-full bg-foil-cream/10" />
            </div>
            <span className="col-span-1 col-start-2 mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-foil-cream/45 sm:col-span-3 sm:col-start-3 sm:mt-0 sm:justify-end">
              <span aria-hidden>🔒</span> In today&apos;s drop
            </span>
          </li>
        ))}
      </ol>
    </div>

    {/* The gate — converts the "there's more" moment into a drop subscribe,
        or degrades honestly on a thin day (no fake locked count). */}
    <DealsDropGate headline={gate.headline} subtext={gate.subtext} />
    </div>
  );
}
