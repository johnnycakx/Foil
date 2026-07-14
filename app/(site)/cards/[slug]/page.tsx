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
import { AddToVault } from "@/components/cards/add-to-vault";
import { aboutListingCopy } from "@/lib/cards/about-copy";
import { getHeroSoldStat } from "@/lib/cards/sold-headline";
import { resolveListedFallback } from "@/lib/pricing/listed-fallback";
import { deriveAvailableVariants } from "@/lib/poketrace/variant";
import { getHydratedVariants } from "@/lib/poketrace/hydration";

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
  return `Live ${card.name} (${card.setName}) listings on eBay, sorted to surface the best current deal. Add it to your vault and we email you when it drops to your target.`;
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

  // Demand-driven hydration merge (ADR-092): when the baked snapshot carries
  // no PokeTrace variants (the ~650 top5-per-set long tail), fall back to the
  // runtime-hydrated variants the watch-triggered worker persisted. Baked
  // wins when present; a later bake run folds hydrated cards in for good.
  // Soft-fail to empty — one cheap single-row read on a force-dynamic render.
  let variants = card.variants ?? [];
  let hydratedSince: string | null = null;
  if (variants.length === 0) {
    const hydrated = await getHydratedVariants(slug);
    variants = hydrated.variants;
    hydratedSince = hydrated.hydratedAt;
  }

  // Vault-first hero (card-page-vault-first goal): the one headline trust
  // number, coherence-gated through the same resolver + variant selection the
  // sold panel below uses (lib/cards/sold-headline.ts). Null on thin-data
  // cards → the hero renders the honest pending line, never a figure.
  // getSoldHistory is in-process cached, so this adds no network call beyond
  // the panel's own fetch.
  const heroStat =
    tier === "metadata-only"
      ? null
      : await getHeroSoldStat(variants, selectedVariant, selectedCondition, Date.now());

  // LISTED fallback (pricing-bridge / ADR-118). When the sold spine is dark —
  // a lapsed PokeTrace key (R-070) makes getSoldHistory return null on EVERY
  // card — the hero would otherwise show the pending line site-wide. Instead we
  // fall through to the baked TCGplayer listed figure, rendered under an
  // explicit "listed (may lag)" label with its date. Sold ALWAYS wins when it
  // exists; this is a fallback, never a promotion. Zero network (it's in the
  // committed snapshot), so it cannot fail with the vendor.
  const listedFallback = heroStat
    ? null
    : resolveListedFallback(
        card.tcgplayerPrices,
        card.tcgplayerUpdatedAt,
        selectedVariant,
        Date.now(),
      );

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
  const aboutCopy = aboutListingCopy(tier);

  // The buy-signal badge (condition-matched ask-vs-sold read, ADR-053) is now
  // computed in /api/listing/[slug] alongside the verified listing (ONE
  // verdict, ONE getItem — design §5) and rendered by the LiveListingSection
  // client component, so it leaves the slow server render path (ADR-047 v2). The
  // variants-panel "current best" marker (which depended on the verified
  // listing's finish) is dropped from the SSR render for the same reason — it
  // was a Tranche-A safe-minimum nicety; true per-variant resolution is the
  // unchanged Tranche B #5 work.

  return (
    <main data-tone="night" className="mx-auto w-full max-w-4xl flex-1 bg-foil-night px-5 pt-10 pb-20 text-foil-cream sm:px-8 sm:pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <Breadcrumb items={breadcrumbItems} />

      <article>
        {/* Vault-first hero (card-page-vault-first goal): identity + ONE
            headline trust number + the Add to vault action, all above the
            fold at 390px. The card art rides compact beside the identity on
            mobile so the action stays thumb-reachable without scrolling;
            desktop keeps the full-art column. */}
        <div className="grid grid-cols-[6.5rem_1fr] items-start gap-x-5 sm:grid-cols-[16rem_1fr] sm:gap-x-12">
          <div className="flex justify-start sm:row-span-2">
            {card.image ? (
              <Image
                src={card.image}
                alt={`${card.name} (${card.setName}) #${card.number} card art`}
                width={400}
                height={558}
                priority
                sizes="(min-width: 640px) 16rem, 6.5rem"
                className="w-26 rounded-lg border border-foil-cream/10 shadow-[0_24px_60px_-28px_rgba(4,9,18,0.85)] sm:w-64 sm:rounded-2xl"
              />
            ) : (
              <div
                aria-hidden
                className="w-26 rounded-lg border border-foil-cream/10 bg-foil-night-2 sm:w-64 sm:rounded-2xl"
                style={{ aspectRatio: "245 / 342" }}
              />
            )}
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-foil-cream/60">
              {card.setName} · #{card.number}
              {card.rarity ? <> · {card.rarity}</> : null}
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold leading-tight tracking-[-0.02em] text-foil-cream sm:text-5xl">
              {card.name}
            </h1>
            {/* Variant badges — types + subtypes — at-a-glance identity
                (Session 41). Hidden on mobile: the fold belongs to the stat
                and the action; the badges return at sm+. */}
            {(card.types.length > 0 || card.subtypes.length > 0) && (
              <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
                {card.types.map((t) => (
                  <span
                    key={`type-${t}`}
                    className="inline-flex items-center rounded-full border border-foil-accent/40 bg-foil-accent/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-cream"
                  >
                    {t}
                  </span>
                ))}
                {card.subtypes.map((s) => (
                  <span
                    key={`subtype-${s}`}
                    className="inline-flex items-center rounded-full border border-foil-cream/15 bg-foil-night-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-cream/60"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
            {/* The ONE headline trust number: 30-day sold avg, coherence-
                gated. Thin data renders the honest pending line instead
                (null-over-guess extends to the hero). */}
            {heroStat ? (
              <div className="mt-4 sm:mt-6">
                <p className="text-xs uppercase tracking-wide text-foil-cream/60">
                  30-day sold avg · {heroStat.variantLabel} · {heroStat.tierLabel}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-4xl font-semibold tabular-nums text-foil-cream sm:text-5xl">
                    {formatUsd(heroStat.value)}
                  </span>
                  {heroStat.saleCount != null && (
                    <span className="text-sm text-foil-cream/60">
                      {heroStat.approxSaleCount ? "~" : ""}
                      {heroStat.saleCount} sales on record
                    </span>
                  )}
                </p>
              </div>
            ) : listedFallback ? (
              /* No sold figure we can stand behind — fall through to the baked
                 TCGplayer LISTED price, labeled as what it is (ADR-118). This
                 is an asking-price index, never a sold comp: the label and the
                 date carry that, and the type system forbids it reaching the
                 sold-labeled branch above. */
              <div className="mt-4 sm:mt-6">
                <p className="text-xs uppercase tracking-wide text-foil-cream/60">
                  {listedFallback.label}
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-display text-4xl font-semibold tabular-nums text-foil-cream/90 sm:text-5xl">
                    {formatUsd(listedFallback.amount)}
                  </span>
                  <span className="text-sm text-foil-cream/60">
                    as of {formatListedDate(listedFallback.lastUpdated)}
                  </span>
                </p>
                <p className="mt-2 text-xs text-foil-cream/50">
                  No recent sold data for this card right now, so this is what
                  it&rsquo;s listed at, not what it sold for.
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-foil-cream/60 sm:mt-6">
                Sold data pending for this card. We only show figures we can
                stand behind.
              </p>
            )}
          </div>
          {/* ONE AddToVault instance for every viewport: full-width under the
              identity row on mobile (col-span-2, thumb-sized inside the 390px
              fold); in the identity column on sm+. */}
          <div className="col-span-2 sm:col-span-1 sm:col-start-2">
            <AddToVault
              cardSlug={slug}
              cardName={card.name}
              availableVariantKeys={deriveAvailableVariants({ variants })}
              hasSoldData={heroStat != null}
            />
          </div>
        </div>

        {/* The proof (tier 2 of the vault-first hierarchy): the best-live-deal
            module stays in plain sight right under the action — it's the
            revenue path AND the "we found this for you" evidence. Never
            behind a dropdown. (ADR-046/047: metadata-only → 2 search CTAs,
            longtail → affiliate search fallback, curated → live best-listing.) */}
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
        <p className="mt-4 text-center text-[11px] text-foil-cream/60 sm:text-left">
          Foil TCG, LLC · Built by John Craig
        </p>

        {/* The depth (tier 3): sold history open by default (the chart is the
            strongest supporting evidence), variants and reference data
            collapsed. All of it native <details> — every row stays in the
            server-rendered DOM for crawlers; nothing fetches on expand. */}
        {tier !== "metadata-only" && (
          <>
            {/* Sold-history (PokeTrace) — Session 49 / ADR-042. Variant-aware
                30-day sold averages. SSR-only; ?v= chip links re-render. */}
            <SoldHistoryPanel
              slug={slug}
              cardName={card.name}
              variants={variants}
              hydratedSince={hydratedSince}
              selectedKey={selectedVariant}
              selectedCondition={selectedCondition}
            />

            {/* Variants + market range (TCGplayer) — Session 41 / ADR-030.
                The live "current best" marker moved to client hydration with the
                listing (ADR-047 v2); SSR shows the baked TCGplayer ranges. */}
            <CardVariantsSection
              card={card}
              currentBestPriceUsd={null}
              currentBestVariantKey={null}
            />
          </>
        )}

        {/* Reference-data layer (Session 41 / ADR-030). Renders only the
            fields the SDK exposes; gracefully skips rows it doesn't have. */}
        <CardMetadataBlock card={card} />

        <section className="mt-12 border-t border-foil-cream/10 pt-8 text-sm text-foil-cream/70">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
            About this card
          </h2>
          {/* Tier-honest copy (Cowork live audit 2026-07-04): fallback-tier
              pages render the Browse-on-eBay module, not a verified block, so
              the paragraph only promises the surface this tier actually has.
              lib/cards/about-copy.ts owns both variants; pinned by test. */}
          <div className="mt-3 space-y-4 leading-relaxed">
            <p>
              {card.name} from {card.setName}
              {card.releaseDate ? <> ({formatReleaseYear(card.releaseDate)})</> : null}
              {" "}is a Pokemon TCG single tracked on Foil. Card #{card.number}
              {card.rarity ? <> in the set, printed as {card.rarity}</> : null}.
              Pricing varies widely by condition, print run, and grading
              authority. {aboutCopy.lead}
            </p>
            <p>{aboutCopy.verify}</p>
          </div>
        </section>

        {related.length > 0 && (
          <aside className="mt-12 border-t border-foil-cream/10 pt-8" aria-labelledby="related-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="related-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
                More from {card.setName}
              </h2>
              <Link
                href={`/cards/sets/${card.setId}`}
                className="text-xs font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:decoration-foil-accent hover:text-foil-accent"
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
                      className="block rounded-xl border border-foil-cream/10 bg-foil-night-2 p-4 transition hover:-translate-y-0.5 hover:border-foil-accent/40"
                    >
                      <p className="font-mono text-[11px] uppercase tracking-wider text-foil-cream/60">
                        #{number}
                      </p>
                      <p className="mt-1 font-semibold text-foil-cream">{display}</p>
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

/** "Jul 1" — the honest age stamp on a listed fallback figure (ADR-118). */
function formatListedDate(iso: string | null): string {
  if (!iso) return "an unknown date";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "an unknown date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function formatReleaseYear(release: string): string {
  // Pokemon TCG SDK uses "YYYY/MM/DD" — pull the year for a casual mention.
  const m = release.match(/^(\d{4})/);
  return m ? m[1] : release;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}
