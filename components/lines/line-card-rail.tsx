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
      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]"
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
          {/* Unified tile height + soft navy-tinted shadow (design-round3-fixes §6):
              h is w × the 245/342 card ratio, so every tile lands identical. */}
          <div className="h-[134px] w-24 overflow-hidden rounded-xl bg-foil-navy/5 shadow-md shadow-foil-navy/10 ring-1 ring-foil-navy/10 transition group-hover:-translate-y-1 group-hover:ring-foil-sakura/50 group-focus-visible:ring-2 group-focus-visible:ring-foil-sakura sm:h-[156px] sm:w-28">
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
              // Designed placeholder — never a blank box (design-round3-fixes §6).
              <div className="flex aspect-[245/342] w-full flex-col items-center justify-center gap-1 bg-foil-navy/5 p-2 text-center">
                <span className="text-[10px] font-medium leading-tight text-foil-slate">{c.name}</span>
                <span className="text-[9px] text-foil-slate">{c.setName}</span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
