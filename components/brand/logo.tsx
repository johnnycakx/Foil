// ADR-055 — Fredoka "FoilTCG" wordmark + foil-corner card mark.
//
// Supersedes the ADR-036/038/040 glyph lineage (Foil Spark → navy Pokeball →
// classic red/white Pokeball). The literal Pokeball was Nintendo/Pokémon
// trade dress in the brand position of a buyer-side affiliate business — a
// pre-PokeBeard-launch trademark-exposure blocker. This replaces it with an
// owned mark: a Fredoka wordmark ("Foil" + gold-sheen "TCG") and an abstract
// foil-corner card glyph. No Pokeball, no Pokémon-trademark shapes, no
// yellow+blue Pokémon trade dress — navy/gold, fully in-brand.
//
// Tokens (globals.css @theme): navy #0f1e3a, gold #c9a24b, cream #f8f5f0.
// Fredoka is pinned in app/layout.tsx as the `--font-wordmark` next/font var,
// exposed as the `font-wordmark` Tailwind utility.

type Size = "sm" | "md" | "lg";
/** "onCream" (default, header): navy "Foil". "onNavy" (footer/dark/OG): cream "Foil". */
type Tone = "onCream" | "onNavy";

const MARK_PX: Record<Size, number> = { sm: 16, md: 20, lg: 30 };
const WORDMARK_CLASS: Record<Size, string> = { sm: "text-base", md: "text-xl", lg: "text-3xl" };
const GAP_CLASS: Record<Size, string> = { sm: "gap-1.5", md: "gap-2", lg: "gap-2.5" };

// Darker gold for the fold underside (the revealed corner) — passes as a flat
// accent, distinct enough from the bright flap to read as a fold.
const GOLD = "#c9a24b";
const GOLD_DARK = "#a8842f";
const GOLD_LIGHT = "#e3c87a";
const NAVY = "#0f1e3a";

/**
 * Foil-corner card mark. A navy rounded-rect card tile whose top-right corner
 * is folded forward, revealing a two-tone gold foil back (a "dog-ear"): the
 * cut corner shows darker gold (underside), the folded flap is bright gold with
 * a restrained vertical sheen gradient. Transparent background — drop it into
 * any lockup. Isolated + geometry-only so John can swap it later without
 * touching the wordmark. (viewBox 0 0 32 32; card x6→26 y4→28, fold leg 9.)
 */
export function FoilCornerMark({ px = 20 }: { px?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={px}
      height={px}
      role="presentation"
      aria-hidden
      className="inline-block shrink-0"
    >
      <defs>
        <linearGradient id="foil-corner-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={GOLD_LIGHT} />
          <stop offset="1" stopColor={GOLD} />
        </linearGradient>
      </defs>
      {/* Navy card body — top-right corner sliced for the fold. */}
      <path
        d="M 9.5 4 H 17 L 26 13 V 24.5 A 3.5 3.5 0 0 1 22.5 28 H 9.5 A 3.5 3.5 0 0 1 6 24.5 V 7.5 A 3.5 3.5 0 0 1 9.5 4 Z"
        fill={NAVY}
      />
      {/* Fold underside — the revealed corner (upper-right triangle), darker gold. */}
      <path d="M 17 4 H 26 V 13 Z" fill={GOLD_DARK} />
      {/* Folded flap lying on the card (lower-left triangle), bright gold + sheen. */}
      <path d="M 17 4 L 26 13 H 17 Z" fill="url(#foil-corner-sheen)" />
    </svg>
  );
}

/**
 * The FoilTCG wordmark lockup: foil-corner mark + "Foil" + gold-sheen "TCG",
 * set in Fredoka (font-wordmark). `tone` flips "Foil" navy↔cream for cream vs
 * navy/dark surfaces; "TCG" is always gold. Whole lockup is one accessible
 * name: "FoilTCG home" (no em dash — Gate 12).
 */
export function Logo({
  size = "md",
  tone = "onCream",
  withMark = true,
}: {
  size?: Size;
  tone?: Tone;
  withMark?: boolean;
}) {
  const foilColor = tone === "onNavy" ? "text-foil-cream" : "text-foil-navy";
  return (
    <span
      aria-label="FoilTCG home"
      className={`font-wordmark inline-flex items-center font-bold leading-none tracking-tight ${GAP_CLASS[size]}`}
    >
      {withMark && <FoilCornerMark px={MARK_PX[size]} />}
      <span aria-hidden className={`inline-flex items-baseline ${WORDMARK_CLASS[size]}`}>
        <span className={foilColor}>Foil</span>
        {/* "TCG" gold with a restrained vertical sheen (gold→light→gold),
            clipped to the text. A solid-gold fallback color shows for the
            brief moment before background-clip paints + anywhere clip is
            unsupported. */}
        <span
          className="bg-clip-text text-transparent"
          style={{
            color: GOLD,
            backgroundImage: `linear-gradient(180deg, ${GOLD} 0%, ${GOLD_LIGHT} 50%, ${GOLD} 100%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
        >
          TCG
        </span>
      </span>
    </span>
  );
}
