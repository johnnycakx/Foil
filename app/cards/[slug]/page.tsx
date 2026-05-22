// /cards/[slug] — V1 per-card landing page (deal-finder MVP).
//
// Per ADR-020 + ADR-021, this is the first concrete proof of the deal-finder
// product direction. Hardcoded to Charizard (Base Set #4) for V1; the
// 200-card programmatic pipeline (ROADMAP NEXT #8) lands in a follow-on goal.
//
// Compliance posture (R-008 in docs/RISKS.md):
//   - Server-side EPN fetch only, render-time, `cache: "no-store"` (in epn.ts).
//   - We render the listing inline and DON'T persist it anywhere.
//   - Editorial copy below the fold makes NO listing-specific claims about
//     price, condition, or seller — the live listing block self-describes.
//   - Affiliate URLs always include EBAY_CAMPAIGN_ID + customid=foil-card-page.
//
// Soft-fail design: if EPN returns no usable best-listing (network down, no
// matches, misconfigured creds), the page still renders 200 with a fallback
// "Browse Charizard listings on eBay" CTA via `affiliateSearchUrl`. The page
// is robust to EPN downtime by construction.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  affiliateSearchUrl,
  getBestListing,
  type EpnBestListing,
} from "@/lib/affiliate/epn";
import { schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// V1 single-card catalog. The 200-card pipeline (NEXT #8) will replace this
// with a generated source backed by Pokemon TCG SDK.
type CardEntry = {
  slug: string;
  name: string;
  setName: string;
  setSlug: string;
  collectorNumber: string;
  image: string;
};

const CARDS: Record<string, CardEntry> = {
  "charizard-base-set-4": {
    slug: "charizard-base-set-4",
    name: "Charizard",
    setName: "Base Set",
    setSlug: "base1",
    collectorNumber: "4",
    image: "https://images.pokemontcg.io/base1/4.png",
  },
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.foiltcg.com";
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = CARDS[slug];
  if (!card) return {};
  return {
    title: `${card.name} (${card.setName}) — Best deals on eBay | Foil`,
    description: `Live ${card.name} (${card.setName}) listings on eBay, sorted to surface the best current deal. Watchlist alerts when prices drop to your target.`,
    alternates: { canonical: `/cards/${card.slug}` },
    openGraph: {
      type: "website",
      title: `${card.name} (${card.setName}) — Best deals on eBay | Foil`,
      description: `Live ${card.name} listings sorted by price. Set a target and we'll email you when one drops.`,
      siteName: "Foil",
      url: `/cards/${card.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${card.name} (${card.setName}) — Best deals on eBay`,
      description: `Live ${card.name} listings sorted by price.`,
    },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = CARDS[slug];
  if (!card) notFound();

  // Render-time fetch — no caching. Soft-fails to null on any EPN error.
  const best: EpnBestListing | null = await getBestListing({
    cardName: card.name,
    setName: card.setName,
    customId: "foil-card-page",
  });

  const fallbackUrl = affiliateSearchUrl(`${card.name} ${card.setName}`, "foil-card-page");

  // schema.org/Product. `offers` array populated only when a live best
  // listing is available — keeps the markup honest under degraded conditions.
  const canonical = `${siteUrl()}/cards/${card.slug}`;
  const productSchema: Record<string, unknown> = {
    "@type": "Product",
    name: `${card.name} (${card.setName})`,
    description: `Live ${card.name} (${card.setName}) listings on eBay, sorted to surface the best current deal.`,
    image: card.image,
    sku: card.slug,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
  if (best) {
    productSchema.offers = [
      {
        "@type": "Offer",
        priceCurrency: best.currency,
        price: best.price.toFixed(2),
        availability: "https://schema.org/InStock",
        url: best.affiliateUrl,
        seller: { "@type": "Organization", name: "eBay" },
      },
    ];
  }
  const jsonLd = schemaGraph(productSchema);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#0B1428] text-white antialiased">
      <header className="border-b border-white/5 bg-[#0B1428]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF6B5C]" />
            Foil
          </Link>
          <Link
            href="/blog"
            className="text-sm text-zinc-300 transition hover:text-white"
          >
            Blog
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />

        <article>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={card.image}
              alt={`${card.name} (${card.setName}) #${card.collectorNumber} card art`}
              className="w-48 self-center rounded-xl border border-white/10 shadow-2xl sm:self-start"
              width={245}
              height={342}
            />
            <div className="flex-1">
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                {card.setName} · #{card.collectorNumber}
              </p>
              <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                {card.name}
              </h1>
              <p className="mt-4 text-lg text-zinc-300">
                Live listings on eBay, sorted to surface the best current deal.
                Set a target price and we&apos;ll email you when one drops.
              </p>
            </div>
          </div>

          <section
            className="mt-10 rounded-2xl border border-white/10 bg-[#101D38] p-6 sm:p-8"
            aria-labelledby="best-deal-heading"
          >
            <h2 id="best-deal-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Best current listing
            </h2>
            {best ? (
              <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-3xl font-bold text-white">
                    {formatPrice(best.price, best.currency)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-300">{best.title}</p>
                </div>
                <a
                  href={best.affiliateUrl}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-[#FF6B5C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7f72]"
                >
                  Buy on eBay →
                </a>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-zinc-300">
                  Live deal data is briefly unavailable. Browse current eBay
                  listings while we re-sync.
                </p>
                <a
                  href={fallbackUrl}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  Browse on eBay →
                </a>
              </div>
            )}
            <p className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500">
              Prices update on each page load. Affiliate-tracked — Foil earns a
              commission on eBay purchases that originate from this link.
            </p>
          </section>

          <section className="mt-10" aria-labelledby="watchlist-heading">
            <h2 id="watchlist-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Email me when it drops
            </h2>
            <p className="mt-3 text-sm text-zinc-300">
              Set a target price; we&apos;ll email you the moment a {card.name}{" "}
              listing meets it. No account required.
            </p>
            <WatchlistForm cardSlug={card.slug} />
          </section>

          <section className="mt-12 border-t border-white/5 pt-8 text-sm text-zinc-300">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              About this card
            </h2>
            <div className="mt-3 space-y-4 leading-relaxed">
              <p>
                {card.name} from {card.setName} is one of the most recognized
                Pokemon TCG singles. Card #{card.collectorNumber} in the set,
                printed as a Holo Rare in the original {card.setName} run.
                Pricing varies widely by condition, print run (1st Edition,
                Shadowless, Unlimited), and grading authority.
              </p>
              <p>
                Foil surfaces the lowest current eBay listing on every page
                load — no caching of listing data, no stale snapshots. The Best
                Current Listing block above reflects live state at the moment
                you opened this page.
              </p>
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-white/5 bg-[#0B1428]">
        <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Foil. Pokemon TCG deal-finder — find the
            best card listings across eBay, instantly.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Client component: small inline form that POSTs to /api/watchlist. Inline
// rather than a shared component because (a) it's currently the only caller
// and (b) the form shape may change as we learn how subscribers actually use
// it. Promote to components/ on the second instance.
function WatchlistForm({ cardSlug }: { cardSlug: string }) {
  return (
    <form
      className="mt-4 flex flex-col gap-3 sm:flex-row"
      data-card-slug={cardSlug}
      action={`/api/watchlist`}
      method="post"
      // The actual POST is handled by an inline script below — see notes there.
      onSubmit={undefined}
    >
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="flex-1 rounded-full border border-white/15 bg-[#0B1428] px-5 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#FF6B5C] focus:outline-none"
      />
      <input
        type="number"
        name="target_price"
        required
        min={1}
        step={1}
        placeholder="Target ($)"
        className="w-full rounded-full border border-white/15 bg-[#0B1428] px-5 py-3 text-sm text-white placeholder-zinc-500 focus:border-[#FF6B5C] focus:outline-none sm:w-40"
      />
      <button
        type="submit"
        className="rounded-full bg-[#FF6B5C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7f72]"
      >
        Notify me
      </button>
      {/* Tiny inline script: shapes the form payload into the JSON the
          /api/watchlist route expects, then submits via fetch. Keeps the
          page a Server Component while still posting JSON. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              var form = document.currentScript.parentElement;
              form.addEventListener('submit', function (e) {
                e.preventDefault();
                var email = form.elements.email.value;
                var targetDollars = parseFloat(form.elements.target_price.value || '0');
                var btn = form.querySelector('button[type=submit]');
                if (btn) btn.disabled = true;
                fetch('/api/watchlist', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: email,
                    card_slug: form.dataset.cardSlug,
                    target_price_cents: Math.round(targetDollars * 100),
                  }),
                })
                  .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
                  .then(function (res) {
                    if (res.ok && res.body && res.body.ok) {
                      form.innerHTML = '<p class="text-sm text-zinc-300">Got it — we\\'ll email you when ' + form.dataset.cardSlug.split('-').slice(0, -2).join(' ') + ' hits your target.</p>';
                    } else if (btn) {
                      btn.disabled = false;
                      btn.textContent = 'Try again';
                    }
                  })
                  .catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Try again'; } });
              });
            })();
          `,
        }}
      />
    </form>
  );
}
