// /cards/sets/[set-id] — per-set browse. Lists every catalog entry from
// the given set with thumbnail + name + collector number. Each card links
// to its individual /cards/<slug> deal page.
//
// Closed slug set: generateStaticParams uses `setIdsInCatalog()`, so only
// sets we actively track render — anything else 404s (no listing-data
// orphans).

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { entriesForSet, setIdsInCatalog } from "@/lib/cards/catalog";
import { getCardMetadata, getSetMetadata } from "@/lib/cards/sdk";

export const dynamic = "force-static";
export const dynamicParams = false;
// Session 40 / Task #23 Bug 3: shortened from 24h → 1h. Upstream
// pokemontcg.io is intermittently 504/404-ing under load; a short
// revalidate window means a build that catches a bad-upstream minute
// self-heals within an hour instead of sticking for a day.
export const revalidate = 3600;

export function generateStaticParams() {
  return setIdsInCatalog().map((id) => ({ "set-id": id }));
}

type PageProps = { params: Promise<{ "set-id": string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { "set-id": setId } = await params;
  if (!setIdsInCatalog().includes(setId)) return {};
  const set = await getSetMetadata({ id: setId });
  const title = `${set.name} — Best Pokémon TCG card deals | Foil`;
  const description = `Browse every ${set.name} card Foil tracks. Live eBay listings, watchlist alerts when prices drop to your target.`;
  return {
    title,
    description,
    alternates: { canonical: `/cards/sets/${setId}` },
    openGraph: {
      type: "website",
      title,
      description,
      siteName: "Foil",
      url: `/cards/sets/${setId}`,
      images: set.logoUrl ? [{ url: set.logoUrl }] : undefined,
    },
  };
}

export default async function SetIndexPage({ params }: PageProps) {
  const { "set-id": setId } = await params;
  if (!setIdsInCatalog().includes(setId)) notFound();

  const entries = entriesForSet(setId);
  const set = await getSetMetadata({ id: setId });
  // Metadata for every card in this set — fetched in parallel; SDK lib
  // caches each card 24h so subsequent builds are cheap.
  const cardsWithMeta = await Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      meta: await getCardMetadata({ id: entry.pokemonTcgId }),
    })),
  );

  const releaseYear = set.releaseDate?.match(/^(\d{4})/)?.[1] ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-12 pb-20 sm:px-8 sm:pt-16">
      <nav aria-label="Breadcrumb" className="font-mono text-[11px] uppercase tracking-wider text-foil-slate">
        <Link href="/cards" className="transition hover:text-foil-navy">
          ← All sets
        </Link>
      </nav>

      <header className="mt-6 grid gap-6 sm:grid-cols-[12rem_1fr] sm:items-center">
        {set.logoUrl ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-foil-navy/10 bg-foil-navy p-4">
            <Image
              src={set.logoUrl}
              alt={`${set.name} set logo`}
              width={320}
              height={120}
              className="max-h-24 w-auto"
              sizes="12rem"
            />
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-foil-gold">
            {set.series || "Set"}
            {releaseYear ? <> · {releaseYear}</> : null}
          </p>
          <h1 className="font-display mt-2 text-4xl font-bold leading-tight tracking-[-0.02em] text-foil-navy sm:text-5xl">
            {set.name}
          </h1>
          <p className="mt-3 text-base text-foil-slate sm:text-lg">
            {entries.length} card{entries.length === 1 ? "" : "s"} tracked from this set. Pick one to see the current best eBay listing.
          </p>
        </div>
      </header>

      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cardsWithMeta.map((entry) => {
          const number = entry.pokemonTcgId.split("-").slice(1).join("-");
          return (
            <li key={entry.slug}>
              <Link
                href={`/cards/${entry.slug}`}
                className="group block rounded-2xl border border-foil-navy/10 bg-foil-cream p-3 shadow-sm shadow-foil-navy/5 transition hover:-translate-y-0.5 hover:border-foil-gold/40 hover:shadow-lg hover:shadow-foil-navy/10"
              >
                <div className="overflow-hidden rounded-xl bg-foil-navy/5">
                  {entry.meta.image ? (
                    <Image
                      src={entry.meta.image}
                      alt={`${entry.meta.name} (${set.name}) #${number}`}
                      width={245}
                      height={342}
                      sizes="(min-width: 1024px) 14rem, (min-width: 640px) 18vw, 40vw"
                      className="aspect-[245/342] w-full transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div aria-hidden className="w-full bg-foil-navy/5" style={{ aspectRatio: "245 / 342" }} />
                  )}
                </div>
                <div className="mt-3 px-1 pb-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-foil-slate">
                    #{number}
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foil-navy group-hover:text-foil-coral">
                    {entry.meta.name}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
