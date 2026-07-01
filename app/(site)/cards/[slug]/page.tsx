// /cards/[slug] — V1 per-card landing pages (deal-finder).
//
// Layout chrome (header/footer) lives in the (site) route group layout —
// this file only renders the page-specific content.
//
// Compliance posture (R-008): the live eBay listing is fetched client-side from
// /api/listing/[slug] (force-dynamic + `cache: "no-store"`), NOT in this
// server render. Pokemon TCG SDK catalog metadata is BAKED-FIRST as of the
// perf-and-data-foundation goal (2026-07-01): getCardMetadata returns the
// committed snapshot entry with zero network for any baked id (all catalog
// entries after a full bake); the timeout-bounded live fetch (≤5s) runs only
// for ids missing from the snapshot. So this page serves fast, evergreen,
// crawlable HTML regardless of pokemontcg.io's health, and the volatile
// affiliate listing hydrates per-visitor (SEO crawlability fix, ADR-047 v2
// amendment) — never cached, never in the crawled DOM.

import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { affiliateSearchUrl, buildCustomId } from "@/lib/affiliate/epn";
import { CARD_CATALOG, getCatalogEntry, relatedCardsForSlug, cardTier } from "@/lib/cards/catalog";
import { LongTailListingFallback } from "@/components/cards/long-tail-listing-fallback";
import { MetadataOnlyListing } from "@/components/cards/metadata-only-listing";
import { LiveListingSection } from "@/components/cards/live-listing-section";
import { getCardMetadata, type CardMetadata } from "@/lib/cards/sdk";
import { aggregateOfferFromTcgplayer } from "@/lib/cards/aggregate-offer";
import { siteUrl } from "@/lib/seo/site-url";
import { breadcrumbListSchema, schemaGraph, serializeJsonLd } from "@/lib/seo/schema-helpers";
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb";
import { CardMetadataBlock } from "@/components/card-metadata-block";
import { CardVariantsSection } from "@/components/card-variants-section";
import { SoldHistoryPanel } from "@/components/cards/sold-history-panel";
import { WatchlistForm } from "@/components/cards/watchlist-form";
import { deriveAvailableVariants } from "@/lib/poketrace/variant";

// Rendering mode (ADR-047, amended twice). This page reads `searchParams` (the
// `v`/`c` URL state, ADR-043) on the server, which forces DYNAMIC rendering, so
// full ISR stays deferred (the ADR-047 "Runtime reality" DYNAMIC_SERVER_USAGE
// 500; RISKS R-013). `force-dynamic` is the known-good mode. The v2 SEO fix
// (this amendment) does NOT reopen ISR — it keeps force-dynamic but makes the
// server render FAST by moving the slow live eBay fetch off the critical path
// (to /api/listing/[slug], client-hydrated). The page no longer fetches
// eBay at all; R-008's no-cache guarantee now lives in that endpoint.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// No generateStaticParams: under force-dynamic Next prerenders nothing, so the
// build is flat at any catalog size with zero build-time eBay Browse calls
// without it. (Exporting an empty generateStaticParams instead would classify
// the route as ● SSG and conflict with the searchParams read — DYNAMIC_SERVER_
// USAGE.) ISR for the cheap long tail is deferred until variant/condition
// selection moves client-side and the server-side searchParams read is gone
// (ADR-047 "What shipped" + RISKS R-013).

// Both generateMetadata and the page body need the card record. For baked ids
// the call is a synchronous in-memory map hit, but for a snapshot-missing id
// it's a live (timeout-bounded) fetch — React cache() dedupes the pair to ONE
// lookup per request on both paths.
const getCard = cache(async (id: string) => getCardMetadata({ id }));

function titleFor(card: CardMetadata): string {
  // Lead with the card name + set (the actual query), then the two highest-volume
  // per-card buyer terms (price, deals). No em dash (brand voice). NO brand
  // suffix here — the root layout's title template appends "· Foil" (the old
  // "| Foil" suffix rendered a double brand: "… | Foil · Foil").
  return `${card.name} (${card.setName}) price & deals`;
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
  const card = await getCard(entry.pokemonTcgId);
  return {
    title: titleFor(card),
    description: descriptionFor(card),
    // Indexable (dual-track restore, ADR-064): the per-card deal-finder pages
    // are the primary programmatic-SEO surface again. The page soft-fails to a
    // no-pricing render (never a 500) if POKETRACE/eBay keys are missing or
    // invalid, so a lapsed key never costs us the index entry.
    alternates: { canonical: `/cards/${slug}` },
    // og:title / twitter:title deliberately OMITTED — they inherit the resolved
    // page title, so <title>, og:title, and twitter:title can never drift
    // apart again (the old hand-written twitter:title used a different string
    // AND an em dash, both against the metadata contract).
    openGraph: {
      type: "website",
      description: `Live ${card.name} listings sorted by price. Set a target and we'll email you when one drops.`,
      siteName: "Foil",
      url: `/cards/${slug}`,
      images: card.image ? [{ url: card.image }] : ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      description: `Live ${card.name} listings sorted by price.`,
      images: card.image ? [card.image] : ["/opengraph-image"],
    },
  };
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ v?: string; c?: string; src?: string }>;
}) {
  const { slug } = await params;
  const { v: selectedVariant, c: selectedCondition, src } = await searchParams;
  const entry = getCatalogEntry(slug);
  if (!entry) notFound();

  const card = await getCard(entry.pokemonTcgId);
  const tier = cardTier(slug);

  // The curated-tier LIVE listing + buy-signal are NO LONGER fetched in this
  // server render (the ~38s eBay block that throttled crawl). They hydrate
  // client-side via the LiveListingSection client component (/api/listing/[slug]). This page
  // renders only fast, evergreen, crawlable content. `src` (a creator/campaign
  // tag from the inbound link) is untrusted — buildCustomId sanitizes it.
  const ebayQuery = `${card.name} ${card.setName}`;
  // The curated honest-null fallback URL — built here (no network) and passed to
  // the client section as its ultimate fallback if the fetch itself fails.
  const curatedFallbackUrl = affiliateSearchUrl(ebayQuery, buildCustomId({ tier: "curated", slug, src }));

  const canonical = `${siteUrl()}/cards/${slug}`;
  const productSchema: Record<string, unknown> = {
    "@type": "Product",
    name: `${card.name} (${card.setName})`,
    description: `Live ${card.name} (${card.setName}) listings on eBay, sorted to surface the best current deal.`,
    image: card.image || undefined,
    sku: slug,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
  if (tier === "longtail" || tier === "curated") {
    // Server JSON-LD carries the STABLE baked TCGplayer AggregateOffer for rich
    // results (ADR-046; design §4 schema-check), zero eBay calls. The live eBay
    // price is intentionally NOT in the crawled structured data — it hydrates
    // client-side, it's volatile (changes per load), and it's R-008-bound
    // (ADR-047 v2). A stable AggregateOffer is also better for rich-result
    // eligibility than a price that mutates on every crawl.
    const agg = aggregateOfferFromTcgplayer(card.tcgplayerPrices, canonical);
    if (agg) productSchema.offers = agg;
  }

  // Session 41 / ADR-030: Breadcrumb (visual + BreadcrumbList JSON-LD).
  // The visual <Breadcrumb> consumes the same `items` array fed into
  // `breadcrumbListSchema`, so a drift between the two surfaces is
  // visible to a human reader, not just to Googlebot.
  const siteRoot = siteUrl(); // trailing slash already stripped by the shared helper
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

  // The buy-signal badge (condition-matched ask-vs-sold read, ADR-053) is now
  // computed in /api/listing/[slug] alongside the verified listing (ONE
  // verdict, ONE getItem — design §5) and rendered by the LiveListingSection
  // client component, so it leaves the slow server render path (ADR-047 v2). The
  // variants-panel "current best" marker (which depended on the verified
  // listing's finish) is dropped from the SSR render for the same reason — it
  // was a Tranche-A safe-minimum nicety; true per-variant resolution is the
  // unchanged Tranche B #5 work.

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
            {/* Variants + market range (TCGplayer) — Session 41 / ADR-030.
                The live "current best" marker moved to client hydration with the
                listing (ADR-047 v2); SSR shows the baked TCGplayer ranges. */}
            <CardVariantsSection
              card={card}
              currentBestPriceUsd={null}
              currentBestVariantKey={null}
            />

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
            ebaySearchUrl={affiliateSearchUrl(ebayQuery, buildCustomId({ tier: "metadata-only", slug, src }))}
            tcgplayerUrl={`https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(card.name)}`}
          />
        ) : tier === "longtail" ? (
          <LongTailListingFallback cardName={card.name} searchUrl={affiliateSearchUrl(ebayQuery, buildCustomId({ tier: "longtail", slug, src }))} />
        ) : (
          // Curated: the live eBay best-listing + buy-signal hydrate client-side
          // (ADR-047 v2) so this server render stays fast + crawlable. The block
          // soft-fails to the honest-null "browse on eBay" state.
          <LiveListingSection
            slug={slug}
            src={src}
            selectedVariant={selectedVariant}
            fallbackUrl={curatedFallbackUrl}
          />
        )}

        {/* Trust line near the buy CTA (F3): the LLC + a plain founder credit,
            the authority a cold creator-driven visitor needs before entering an
            email or clicking an affiliate link (email-ask-cleanup, ADR-066). */}
        <p className="mt-4 text-center text-[11px] text-foil-slate sm:text-left">
          Foil TCG, LLC · Built by John Craig
        </p>

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
              lowest live eBay listing we could verify is this exact card
              (set, collector number, and language checked against the
              listing&apos;s own item specifics).
            </p>
            <p>
              Foil verifies the lowest current eBay listing on every page
              load — no caching of listing data, no stale snapshots. When no
              listing passes verification, we say so instead of showing a
              maybe-wrong one. The block above reflects live state at the
              moment you opened this page.
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
