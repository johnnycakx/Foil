// /cards/[slug] — V1 per-card landing pages (deal-finder).
//
// Layout chrome (header/footer) lives in the (site) route group layout —
// this file only renders the page-specific content.
//
// Compliance posture (R-008): `force-dynamic` + EPN fetched render-time
// with `cache: "no-store"` via lib/affiliate/epn.ts. Pokemon TCG SDK
// catalog metadata is cached for 24h (it's not eBay listing data).

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { affiliateSearchUrl, type EpnBestListing } from "@/lib/affiliate/epn";
import { getBestListing } from "@/lib/affiliate/ebay-browse";
import { CARD_CATALOG, getCatalogEntry, relatedCardsForSlug, cardTier } from "@/lib/cards/catalog";
import { LongTailListingFallback } from "@/components/cards/long-tail-listing-fallback";
import { MetadataOnlyListing } from "@/components/cards/metadata-only-listing";
import { getCardMetadata, type CardMetadata } from "@/lib/cards/sdk";
import { breadcrumbListSchema, schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { CardMetadataBlock } from "@/components/card-metadata-block";
import { CardVariantsSection } from "@/components/card-variants-section";
import { LiveTimestamp } from "@/components/live-timestamp";
import { SoldHistoryPanel } from "@/components/cards/sold-history-panel";
import { WatchlistForm } from "@/components/cards/watchlist-form";
import { deriveAvailableVariants } from "@/lib/poketrace/variant";
import { BuySignalBadge } from "@/components/buy-signal-badge";
import { classifyBuySignal } from "@/lib/buy-signal/compute";
import { resolveSoldReference } from "@/lib/buy-signal/reference";

// Rendering mode (ADR-047, amended). This page reads `searchParams` (the `v`
// variant + `c` condition URL state, ADR-043) on the server, which forces
// DYNAMIC rendering — fundamentally incompatible with ISR. The original
// SSG+ISR-hybrid attempt (revalidate=3600 + connection()) threw
// DYNAMIC_SERVER_USAGE at runtime on EVERY card page because of this read, so
// ISR is deferred until variant/condition selection moves client-side (see
// ADR-047 "What shipped" + RISKS R-013). `force-dynamic` is the known-good
// mode and the R-008 guarantee (eBay listing data is never cached): every
// render re-fetches live, paired with getBestListing's own `cache: "no-store"`.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// No generateStaticParams: under force-dynamic Next prerenders nothing, so the
// build is flat at any catalog size with zero build-time eBay Browse calls
// without it. (Exporting an empty generateStaticParams instead would classify
// the route as ● SSG and conflict with the searchParams read — DYNAMIC_SERVER_
// USAGE.) ISR for the cheap long tail is deferred until variant/condition
// selection moves client-side and the server-side searchParams read is gone
// (ADR-047 "What shipped" + RISKS R-013).

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

// Heuristic condition + grade extraction from an EPN listing title. EPN
// doesn't expose structured condition data on its V1 surface, so we infer
// from common abbreviations. Falls back to null on no match — page just
// hides the badge.
function inferConditionLabel(title: string | undefined): { label: string; tone: "grade" | "raw" } | null {
  if (!title) return null;
  const t = title.toUpperCase();
  // Graded slabs come first — they're the strongest signal.
  const graded = t.match(/\b(PSA|BGS|CGC|SGC)\s*([0-9]{1,2}(?:\.5)?)\b/);
  if (graded) return { label: `${graded[1]} ${graded[2]}`, tone: "grade" };
  // Then common raw condition shorthands.
  if (/\bNM-?MT\b|\bMINT\b/.test(t)) return { label: "Near Mint", tone: "raw" };
  if (/\bNM\b/.test(t)) return { label: "Near Mint", tone: "raw" };
  if (/\bLP\b/.test(t)) return { label: "Lightly Played", tone: "raw" };
  if (/\bMP\b/.test(t)) return { label: "Moderately Played", tone: "raw" };
  if (/\bHP\b/.test(t)) return { label: "Heavily Played", tone: "raw" };
  if (/\bDMG\b|\bDAMAGED\b/.test(t)) return { label: "Damaged", tone: "raw" };
  return null;
}

// Build an AggregateOffer from the baked TCGplayer price ranges (ADR-046).
// Long-tail pages have no live eBay Offer, but the baked TCGplayer low/high
// (no network, R-008-safe — not eBay listing data) still gives a price signal
// for Product rich results. Returns null when no usable price range exists.
function aggregateOfferFromTcgplayer(
  prices: Record<string, { low: number | null; high: number | null }> | undefined,
  url: string,
): Record<string, unknown> | null {
  const lows: number[] = [];
  const highs: number[] = [];
  for (const p of Object.values(prices ?? {})) {
    if (typeof p.low === "number" && p.low > 0) lows.push(p.low);
    if (typeof p.high === "number" && p.high > 0) highs.push(p.high);
  }
  if (lows.length === 0 && highs.length === 0) return null;
  const low = lows.length ? Math.min(...lows) : Math.min(...highs);
  const high = highs.length ? Math.max(...highs) : Math.max(...lows);
  return {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: low.toFixed(2),
    highPrice: high.toFixed(2),
    offerCount: lows.length + highs.length,
    url,
  };
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; c?: string }>;
}) {
  const { slug } = await params;
  const { v: selectedVariant, c: selectedCondition } = await searchParams;
  const entry = getCatalogEntry(slug);
  if (!entry) notFound();

  const card = await getCardMetadata({ id: entry.pokemonTcgId });
  const tier = cardTier(slug);

  // Render-time Browse fetch — curated tier only (ADR-046/047). Long-tail +
  // metadata-only cards skip the eBay Browse call (bounds the per-render Browse
  // quota as the catalog scales). R-008 (never cache eBay listing data) is held
  // by force-dynamic above + getBestListing's own `cache: "no-store"`.
  // Soft-fails to null on error.
  let best: EpnBestListing | null = null;
  if (tier === "curated") {
    best = await getBestListing({
      cardName: card.name,
      setName: card.setName,
      customId: "foil-card-page",
      surface: "page_render",
    });
  }

  const fallbackUrl = affiliateSearchUrl(`${card.name} ${card.setName}`, "foil-card-page");
  const condition = best ? inferConditionLabel(best.title) : null;

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
  } else if (tier === "longtail") {
    // Long-tail pages omit the live Offer (no Browse call) but keep an
    // AggregateOffer when the baked TCGplayer price range is available
    // (ADR-046) — Product still carries a price signal for rich results.
    const agg = aggregateOfferFromTcgplayer(card.tcgplayerPrices, canonical);
    if (agg) productSchema.offers = agg;
  }

  // Session 41 / ADR-030: Breadcrumb (visual + BreadcrumbList JSON-LD).
  // The visual <Breadcrumb> consumes the same `items` array fed into
  // `breadcrumbListSchema`, so a drift between the two surfaces is
  // visible to a human reader, not just to Googlebot.
  const siteRoot = siteUrl().replace(/\/$/, "");
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: "Cards", href: "/cards" },
    { label: card.setName, href: `/cards/sets/${card.setId}` },
    { label: card.name, href: `/cards/${slug}` },
  ];
  const breadcrumbSchema = breadcrumbListSchema(
    breadcrumbItems.map((item) => ({ name: item.label, url: `${siteRoot}${item.href}` })),
  );

  const jsonLd = schemaGraph(productSchema, breadcrumbSchema);

  const related = relatedCardsForSlug(slug, 6);

  // Buy signal (ROADMAP #32 / ADR-053): classify the live ask against the
  // variant's raw 30-day sold average. Curated tier only (the only tier with a
  // live ask). Renders nothing when the sample is thin (UNKNOWN -> null badge),
  // so a card with no/sparse sold data simply shows no signal.
  let buySignal = null;
  if (tier === "curated" && best) {
    const ref = await resolveSoldReference(card.variants, selectedVariant);
    buySignal = classifyBuySignal({
      askPrice: best.price,
      reference: ref.reference,
      sampleSize: ref.sampleSize,
    });
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={breadcrumbItems} />

      <article>
        <div className="grid gap-10 sm:grid-cols-[16rem_1fr] sm:items-start sm:gap-12">
          <div className="flex justify-center sm:justify-start">
            {card.image ? (
              <Image
                src={card.image}
                alt={`${card.name} (${card.setName}) #${card.number} card art`}
                width={400}
                height={558}
                priority
                sizes="(min-width: 640px) 16rem, 14rem"
                className="w-56 rounded-2xl border border-foil-navy/10 shadow-2xl shadow-foil-navy/20 sm:w-64"
              />
            ) : (
              <div
                aria-hidden
                className="w-56 rounded-2xl border border-foil-navy/10 bg-foil-cream sm:w-64"
                style={{ aspectRatio: "245 / 342" }}
              />
            )}
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-foil-slate">
              {card.setName} · #{card.number}
              {card.rarity ? <> · {card.rarity}</> : null}
            </p>
            <h1 className="font-display mt-2 text-4xl font-bold leading-tight tracking-[-0.02em] text-foil-navy sm:text-5xl">
              {card.name}
            </h1>
            {/* Variant badges — types + subtypes — render adjacent to the
                title for at-a-glance card identity. Session 41. */}
            {(card.types.length > 0 || card.subtypes.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {card.types.map((t) => (
                  <span
                    key={`type-${t}`}
                    className="inline-flex items-center rounded-full border border-foil-gold/40 bg-foil-gold/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-navy"
                  >
                    {t}
                  </span>
                ))}
                {card.subtypes.map((s) => (
                  <span
                    key={`subtype-${s}`}
                    className="inline-flex items-center rounded-full border border-foil-navy/15 bg-foil-cream px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-slate"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-4 text-base text-foil-slate sm:text-lg">
              Live listings on eBay, sorted to surface the best current deal.
              Set a target price and we&apos;ll email you when one drops.
            </p>
          </div>
        </div>

        {/* Variants + sold-history are data-bearing surfaces — skipped on the
            metadata-only tier (no priced/sold data; ADR-047). */}
        {tier !== "metadata-only" && (
          <>
            {/* Variants + market range (TCGplayer) — Session 41 / ADR-030. */}
            <CardVariantsSection card={card} currentBestPriceUsd={best?.price ?? null} />

            {/* Buy signal (ROADMAP #32 / ADR-053) — calm read on the live ask
                vs the 30-day sold average. Mounted above the sold-history /
                price chart; renders nothing on a thin sample (UNKNOWN). */}
            {buySignal && buySignal.tier !== "UNKNOWN" && (
              <div className="mt-10">
                <BuySignalBadge signal={buySignal} />
              </div>
            )}

            {/* Sold-history (PokeTrace) — Session 49 / ADR-042. Variant-aware
                30-day sold averages. SSR-only; ?v= chip links re-render. */}
            <SoldHistoryPanel
              slug={slug}
              cardName={card.name}
              variants={card.variants}
              selectedKey={selectedVariant}
              selectedCondition={selectedCondition}
            />
          </>
        )}

        {/* Listing block (ADR-046/047). metadata-only → 2 search CTAs, no
            Browse call, no live block. longtail → affiliate search fallback +
            sold-history above. curated → live eBay best-listing. */}
        {tier === "metadata-only" ? (
          <MetadataOnlyListing
            cardName={card.name}
            ebaySearchUrl={affiliateSearchUrl(`${card.name} ${card.setName}`, "foil-metadata-only")}
            tcgplayerUrl={`https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(card.name)}`}
          />
        ) : tier === "longtail" ? (
          <LongTailListingFallback cardName={card.name} searchUrl={fallbackUrl} />
        ) : (
        <>
        {/* Live timestamp chip — sits above the Best Listing block as a
            data-freshness affordance. Client-side ticks every 10s. */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <LiveTimestamp />
        </div>

        <section
          className="mt-10 rounded-2xl border border-foil-gold/40 bg-foil-cream p-6 shadow-xl shadow-foil-navy/10 sm:p-8"
          aria-labelledby="best-deal-heading"
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
            {condition ? (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  condition.tone === "grade"
                    ? "bg-foil-gold/20 text-foil-navy"
                    : "bg-foil-navy/10 text-foil-navy"
                }`}
              >
                {condition.label}
              </span>
            ) : null}
          </div>

          {best ? (
            <>
              <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="font-display text-4xl font-bold tabular-nums text-foil-navy sm:text-5xl">
                    {formatPrice(best.price, best.currency)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-foil-slate">{best.title}</p>
                </div>
                <a
                  href={best.affiliateUrl}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-foil-navy px-6 py-3 text-sm font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40"
                >
                  Buy on eBay →
                </a>
              </div>
              <p className="mt-5 text-[11px] uppercase tracking-wider text-foil-slate">
                Live listing · Prices update on every page load · Affiliate-tracked — Foil earns a commission on eBay purchases that originate from this link.
              </p>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-foil-slate">
                  Live deal data is briefly unavailable. Browse current eBay
                  listings while we re-sync.
                </p>
                <a
                  href={fallbackUrl}
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
        )}

        <section
          className="mt-10 rounded-2xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8"
          aria-labelledby="watchlist-heading"
        >
          <h2 id="watchlist-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-gold">
            Email me when it drops
          </h2>
          <p className="mt-3 text-sm text-foil-slate">
            Set a target price; we&apos;ll email you the moment a {card.name}{" "}
            listing meets it. No account required.
          </p>
          <WatchlistForm
            cardSlug={slug}
            cardName={card.name}
            availableVariantKeys={deriveAvailableVariants(card)}
          />
          <p className="mt-3 text-[11px] uppercase tracking-wider text-foil-slate">
            One-shot email · No spam · Unsubscribe by clicking the link in any email we send.
          </p>
        </section>

        {/* Reference-data layer (Session 41 / ADR-030). Renders only the
            fields the SDK exposes; gracefully skips rows it doesn't have. */}
        <CardMetadataBlock card={card} />

        <section className="mt-12 border-t border-foil-navy/10 pt-8 text-sm text-foil-slate">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foil-gold">
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
          <aside className="mt-12 border-t border-foil-navy/10 pt-8" aria-labelledby="related-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="related-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-gold">
                More from {card.setName}
              </h2>
              <Link
                href={`/cards/sets/${card.setId}`}
                className="text-xs font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold hover:text-foil-coral"
              >
                See all in {card.setName} →
              </Link>
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => {
                const display = r.slug.split("-").slice(2).join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
                const number = r.pokemonTcgId.split("-").slice(1).join("-");
                return (
                  <li key={r.slug}>
                    <Link
                      href={`/cards/${r.slug}`}
                      className="block rounded-xl border border-foil-navy/10 bg-foil-cream p-4 shadow-sm shadow-foil-navy/5 transition hover:-translate-y-0.5 hover:border-foil-gold/40 hover:shadow-md hover:shadow-foil-navy/10"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-wider text-foil-slate">
                        #{number}
                      </p>
                      <p className="mt-1 font-semibold text-foil-navy">{display}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </article>
    </main>
  );
}

function formatReleaseYear(release: string): string {
  // Pokemon TCG SDK uses "YYYY/MM/DD" — pull the year for a casual mention.
  const m = release.match(/^(\d{4})/);
  return m ? m[1] : release;
}
