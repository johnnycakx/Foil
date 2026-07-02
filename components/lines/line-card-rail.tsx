"use client";

// Card-art scroll rail for the line tracker (eve-line-tracker, ADR-095) —
// John's signature interaction: a horizontal, swipeable wheel of the card art
// (the collector's-eye view). Clicking a tile smooth-scrolls to that card's
// row in the list below (jump-nav). ONE interaction, not a carnival — the rail
// + sakura is the whole flourish budget; everything else stays Flat-At-Rest.
//
// prefers-reduced-motion: the smooth-scroll degrades to an instant jump (the
// browser honors scroll-behavior:smooth ← the media query), and there is NO
// auto-scroll ever. Native overflow-x scrolling stays (that's not "motion" in
// the reduced-motion sense — it's user-driven).

import Image from "next/image";

export type RailCard = { slug: string; name: string; setName: string; image: string };

export function LineCardRail({ cards, pokemon }: { cards: RailCard[]; pokemon: string }) {
  return (
    <div
      role="list"
      aria-label={`${pokemon} card art — tap a card to jump to it`}
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]"
    >
      {cards.map((c) => (
        <button
          key={c.slug}
          type="button"
          role="listitem"
          aria-label={`Jump to ${c.name}, ${c.setName}`}
          onClick={() => {
            const el = document.getElementById(`card-${c.slug}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="group relative shrink-0 snap-start focus:outline-none"
        >
          <div className="w-24 overflow-hidden rounded-xl bg-foil-navy/5 ring-1 ring-foil-navy/10 transition group-hover:-translate-y-1 group-hover:ring-foil-sakura/50 group-focus-visible:ring-2 group-focus-visible:ring-foil-sakura sm:w-28">
            {c.image ? (
              <Image
                src={c.image}
                alt={`${c.name} (${c.setName})`}
                width={245}
                height={342}
                sizes="7rem"
                className="aspect-[245/342] w-full"
              />
            ) : (
              <div aria-hidden className="aspect-[245/342] w-full bg-foil-navy/5" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
