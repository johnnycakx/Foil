// "Here's an actual recent read" proof for the /newsletter landing page.
//
// This REPLACES the old hardcoded SAMPLE_EXCERPTS (three invented newsletter
// issues with fabricated dated comps like "cleared at $32"). Those violated
// Foil's core no-fabrication discipline (R-001 / the content-marker gates / the
// vision null-over-guess doctrine) and were stale-dated.
//
// Instead we render 2-3 REAL market movers from the same `market_movers` cache
// that powers /deals (lib/deals/market-movers-read.ts). Every figure here traces
// to a live PokeTrace aggregate (avg7d / avg30d / saleCount), so a fabricated
// number is structurally impossible — the strongest form of the honesty rule.
//
// Server Component. The page reads the data and soft-fails to empty; when no
// movers clear the bar (cache empty / cron not yet run / PokeTrace down) we
// render the honest FALLBACK that describes the issue FORMAT truthfully, never
// inventing specific comps. Brand tokens; calm/analytical voice; no em dashes
// (BRAND-VOICE Gate 12), no hype (Gate 13).

import Link from "next/link";
import type { MarketMovers, MoverRow } from "@/lib/deals/market-movers-read";

/** Exact USD, whole-dollar above $100 to match the /deals movers board. */
function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/** One real "good buy" row: card identity + the move + the exact figures. */
function MoverProof({ m }: { m: MoverRow }) {
  return (
    <li className="grid grid-cols-[1fr_5rem] items-center gap-3 px-4 py-4 sm:px-5">
      <Link
        href={`/cards/${m.cardSlug}`}
        className="min-w-0 transition hover:text-foil-coral"
      >
        <span className="block truncate font-semibold text-foil-navy">{m.cardName}</span>
        <span className="block truncate text-xs text-foil-slate">{m.setName}</span>
        <span className="mt-1 block text-xs text-foil-slate">
          {m.avg7d != null && m.avg30d != null ? (
            <>
              NM {formatUsd(m.avg7d)} (7d) vs {formatUsd(m.avg30d)} (30d) · {m.saleCount} sales
            </>
          ) : (
            <>Near Mint · {m.saleCount} sales</>
          )}
        </span>
      </Link>
      <span className="text-right">
        <span className="font-display block text-2xl font-bold tabular-nums leading-none text-foil-navy">
          {Math.abs(m.momentumPct)}%
        </span>
        <span className="block text-[11px] uppercase tracking-wider text-foil-gold">
          below 30-day avg
        </span>
      </span>
    </li>
  );
}

/**
 * The honest fallback: no real movers available, so describe the issue FORMAT
 * truthfully without inventing a single figure. Renders when the cache is empty
 * (migration not yet applied, cron not yet run, or PokeTrace down).
 */
function FormatFallback() {
  return (
    <div className="mt-6 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-7">
      <p className="text-sm leading-relaxed text-foil-slate sm:text-base">
        Every issue is built from real market data, never guesses. Each one carries:
      </p>
      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foil-navy sm:text-base">
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
          <span>
            A short good-buys list: cards whose Near Mint copies are trading below their own 30-day
            sold average, with the exact numbers behind each.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
          <span>The cards on the move this week, cooling off and heating up, ranked by the size of the move.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foil-gold" />
          <span>One sharp valuation note, drawn from recent sold data rather than hype.</span>
        </li>
      </ul>
      {/* Insertion point: once issue #1 ships as a web post, swap this fallback
          for a link list of the real archived issues. */}
    </div>
  );
}

/**
 * The /newsletter "what lands in your inbox" proof. Shows up to 3 real movers as
 * an actual recent read, or the honest format fallback when the cache is empty.
 */
export function RecentReadSnippet({ movers }: { movers: MarketMovers }) {
  const picks = movers.down.slice(0, 3);

  return (
    <section className="mt-14">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-foil-navy sm:text-2xl">
        What lands in your inbox
      </h2>

      {picks.length > 0 ? (
        <>
          <p className="mt-2 text-sm text-foil-slate">
            An actual read from this week&apos;s sold data: Near Mint copies trading below their own
            30-day average. Each is a candidate worth a look, not a guarantee. Every figure is a real
            recent average.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-foil-navy/10 bg-foil-cream shadow-sm shadow-foil-navy/5">
            <ol className="divide-y divide-foil-navy/10">
              {picks.map((m) => (
                <MoverProof key={m.cardSlug} m={m} />
              ))}
            </ol>
          </div>
          <p className="mt-4 text-sm text-foil-slate">
            See the full board on{" "}
            <Link
              href="/deals"
              className="font-medium text-foil-navy underline decoration-foil-gold underline-offset-4 transition hover:text-foil-coral"
            >
              this week&apos;s good buys
            </Link>
            . Subscribe above to get it in your inbox once a week.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-foil-slate">
            Here is what each issue contains, so you know exactly what you are signing up for.
          </p>
          <FormatFallback />
        </>
      )}
    </section>
  );
}
