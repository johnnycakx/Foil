// /cards/[slug] — V1 per-card landing pages (deal-finder MVP).
//
// As of Session 22 the route is parameterized over the 200-card catalog in
// `lib/cards/catalog.ts`. Each slug maps to a Pokemon TCG SDK id; metadata
// (name, set, image, rarity) is fetched from pokemontcg.io with a 24h
// revalidate; the EPN call for the best current listing remains
// render-time + `cache: "no-store"` per ADR-021 / R-008.
//
// SSG: `generateStaticParams` returns every catalog slug so the build
// pre-renders all 200 routes. Pokemon TCG SDK fetches at build time are
// cached for 24h, so subsequent builds re-use the snapshot. EPN fetches
// still run at request time — `dynamicParams = false` + `dynamic =
// "force-dynamic"` together: only known slugs render, but each render
// re-fetches EPN.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  affiliateSearchUrl,
  getBestListing,
  type EpnBestListing,
} from "@/lib/affiliate/epn";
import { CARD_CATALOG, getCatalogEntry, relatedCardsForSlug } from "@/lib/cards/catalog";
import { getCardMetadata, type CardMetadata } from "@/lib/cards/sdk";
import { schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";

export const dynamic = "force-dynamic";
export const dynamicParams = false;
export const runtime = "nodejs";

export function generateStaticParams() {
  return CARD_CATALOG.map((entry) => ({ slug: entry.slug }));
}

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

function titleFor(card: CardMetadata): string {
  return `${card.name} (${card.setName}) — Best deals on eBay | Foil`;
}

function descriptionFor(card: CardMetadata): string {
  return `Live ${card.name} (${card.setName}) listings on eBay, sorted to surface the best current deal. Watchlist alerts when prices drop to your target.`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = getCatalogEntry(slug);
  if (!entry) return {};
  const card = await getCardMetadata({ id: entry.pokemonTcgId });
  return {
    title: titleFor(card),
    description: descriptionFor(card),
    alternates: { canonical: `/cards/${slug}` },
    openGraph: {
      type: "website",
      title: titleFor(card),
      description: `Live ${card.name} listings sorted by price. Set a target and we'll email you when one drops.`,
      siteName: "Foil",
      url: `/cards/${slug}`,
      images: card.image ? [{ url: card.image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${card.name} (${card.setName}) — Best deals on eBay`,
      description: `Live ${card.name} listings sorted by price.`,
      images: card.image ? [card.image] : undefined,
    },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const entry = getCatalogEntry(slug);
  if (!entry) notFound();

  const card = await getCardMetadata({ id: entry.pokemonTcgId });

  // Render-time EPN fetch — no caching. Soft-fails to null on any EPN error.
  const best: EpnBestListing | null = await getBestListing({
    cardName: card.name,
    setName: card.setName,
    customId: "foil-card-page",
  });

  const fallbackUrl = affiliateSearchUrl(`${card.name} ${card.setName}`, "foil-card-page");

  const canonical = `${siteUrl()}/cards/${slug}`;
  const productSchema: Record<string, unknown> = {
    "@type": "Product",
    name: `${card.name} (${card.setName})`,
    description: `Live ${card.name} (${card.setName}) listings on eBay, sorted to surface the best current deal.`,
    image: card.image || undefined,
    sku: slug,
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

  const related = relatedCardsForSlug(slug, 6);

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
            {card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.image}
                alt={`${card.name} (${card.setName}) #${card.number} card art`}
                className="w-48 self-center rounded-xl border border-white/10 shadow-2xl sm:self-start"
                width={245}
                height={342}
              />
            ) : (
              <div
                aria-hidden
                className="w-48 self-center rounded-xl border border-white/10 bg-[#101D38] sm:self-start"
                style={{ aspectRatio: "245 / 342" }}
              />
            )}
            <div className="flex-1">
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                {card.setName} · #{card.number}
                {card.rarity ? <> · {card.rarity}</> : null}
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
            <WatchlistForm cardSlug={slug} cardName={card.name} />
          </section>

          <section className="mt-12 border-t border-white/5 pt-8 text-sm text-zinc-300">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
              About this card
            </h2>
            <div className="mt-3 space-y-4 leading-relaxed">
              <p>
                {card.name} from {card.setName}
                {card.releaseDate ? <> ({formatReleaseYear(card.releaseDate)})</> : null}
                {" "}is a Pokemon TCG single tracked on Foil. Card #{card.number}
                {card.rarity ? <> in the set, printed as {card.rarity}</> : null}.
                Pricing varies widely by condition, print run, and grading
                authority — the Best Current Listing block above shows the
                lowest live eBay listing across raw and graded variants.
              </p>
              <p>
                Foil surfaces the lowest current eBay listing on every page
                load — no caching of listing data, no stale snapshots. The Best
                Current Listing block above reflects live state at the moment
                you opened this page.
              </p>
            </div>
          </section>

          {related.length > 0 && (
            <aside className="mt-12 border-t border-white/5 pt-8" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                More from {card.setName}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {related.map((r) => {
                  const display = r.slug.split("-").slice(2).join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
                  const number = r.pokemonTcgId.split("-").slice(1).join("-");
                  return (
                    <li key={r.slug}>
                      <Link
                        href={`/cards/${r.slug}`}
                        className="block rounded-xl border border-white/5 bg-[#101D38] p-4 transition hover:border-[#FF6B5C]/30"
                      >
                        <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                          #{number}
                        </p>
                        <p className="mt-1 font-semibold text-white">{display}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
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

function formatReleaseYear(release: string): string {
  // Pokemon TCG SDK uses "YYYY/MM/DD" — pull the year for a casual mention.
  const m = release.match(/^(\d{4})/);
  return m ? m[1] : release;
}

function WatchlistForm({ cardSlug, cardName }: { cardSlug: string; cardName: string }) {
  // Inline POST-as-JSON via a tiny script — keeps the page a Server Component
  // while still hitting /api/watchlist with the right shape.
  return (
    <form
      className="mt-4 flex flex-col gap-3 sm:flex-row"
      data-card-slug={cardSlug}
      data-card-name={cardName}
      action={`/api/watchlist`}
      method="post"
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
                      form.innerHTML = '<p class="text-sm text-zinc-300">Got it — we\\'ll email you when ' + (form.dataset.cardName || 'this card') + ' hits your target.</p>';
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
