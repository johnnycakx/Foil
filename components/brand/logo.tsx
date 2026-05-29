// ADR-040 — Pokeball brand glyph + "Foil" wordmark.
//
// The glyph is an 8-bit pixel Pokeball on a 16×16 grid (same geometry as
// the "How it works" section pattern, just at brand-mark scale). It has
// two tones:
//   - "classic" (the brand mark / favicon / app icons): classic Pokémon
//     red top (#e63946), white bottom, navy "black" outline + center band,
//     white center button. Per ADR-040 the brand glyph is the one place
//     the cream/navy/gold palette discipline is relaxed — the Pokeball
//     reads as a Pokeball only in red/white.
//   - "navy" (default; the inline pill bullets): navy dome + white bottom,
//     monochrome, so the small text accents stay on-palette.
// navy (#0f1e3a) stands in for "black" (the brand's near-black) on the
// outline/band/button-ring. `shape-rendering: crispEdges` keeps the
// pixels sharp at every size, including the 16px favicon.

type Size = "sm" | "md" | "lg";
type Tone = "navy" | "classic";

const GLYPH_PX: Record<Size, number> = {
  sm: 12,
  md: 14,
  lg: 22,
};

const WORDMARK_CLASS: Record<Size, string> = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
};

const GAP_CLASS: Record<Size, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-2.5",
};

/**
 * The pixel Pokeball, on a 16×16 grid. `tone="classic"` = red/white brand
 * mark; `tone="navy"` (default) = navy monochrome for inline bullets.
 */
export function PokeballMark({ px = 14, tone = "navy" }: { px?: number; tone?: Tone }) {
  const topFill = tone === "classic" ? "#e63946" : "#0f1e3a";
  return (
    <svg
      viewBox="0 0 16 16"
      width={px}
      height={px}
      role="presentation"
      aria-hidden
      shapeRendering="crispEdges"
      className="inline-block shrink-0"
    >
      {/* navy disc = outline + center band ("black") */}
      <g fill="#0f1e3a">
        <rect x="6" y="0" width="4" height="1" />
        <rect x="4" y="1" width="8" height="1" />
        <rect x="3" y="2" width="10" height="1" />
        <rect x="2" y="3" width="12" height="1" />
        <rect x="2" y="4" width="12" height="1" />
        <rect x="1" y="5" width="14" height="1" />
        <rect x="1" y="6" width="14" height="1" />
        <rect x="0" y="7" width="16" height="1" />
        <rect x="0" y="8" width="16" height="1" />
        <rect x="1" y="9" width="14" height="1" />
        <rect x="1" y="10" width="14" height="1" />
        <rect x="2" y="11" width="12" height="1" />
        <rect x="2" y="12" width="12" height="1" />
        <rect x="3" y="13" width="10" height="1" />
        <rect x="4" y="14" width="8" height="1" />
        <rect x="6" y="15" width="4" height="1" />
      </g>
      {/* top dome interior — red (classic) or navy (navy tone) */}
      <g fill={topFill}>
        <rect x="5" y="1" width="6" height="1" />
        <rect x="4" y="2" width="8" height="1" />
        <rect x="3" y="3" width="10" height="1" />
        <rect x="3" y="4" width="10" height="1" />
        <rect x="2" y="5" width="12" height="1" />
        <rect x="2" y="6" width="12" height="1" />
      </g>
      {/* white bottom interior — inset 1px so the navy outline survives */}
      <g fill="#ffffff">
        <rect x="3" y="11" width="10" height="1" />
        <rect x="3" y="12" width="10" height="1" />
        <rect x="4" y="13" width="8" height="1" />
        <rect x="5" y="14" width="6" height="1" />
        <rect x="7" y="15" width="2" height="1" />
      </g>
      {/* white center button (clasp), ringed by the navy band */}
      <rect x="7" y="8" width="2" height="2" fill="#ffffff" />
    </svg>
  );
}

export function LogoGlyph({ size = "md" }: { size?: Size }) {
  const px = GLYPH_PX[size];
  return (
    <span aria-hidden className="inline-block shrink-0" style={{ width: px, height: px }}>
      <PokeballMark px={px} tone="classic" />
    </span>
  );
}

export function Logo({
  size = "md",
  withWordmark = true,
}: {
  size?: Size;
  withWordmark?: boolean;
}) {
  return (
    <span className={`font-display inline-flex items-center font-bold tracking-tight text-foil-navy ${GAP_CLASS[size]}`}>
      <LogoGlyph size={size} />
      {withWordmark && <span className={WORDMARK_CLASS[size]}>Foil</span>}
    </span>
  );
}
