// ADR-038 — navy pixel Pokeball brand glyph + "Foil" wordmark.
//
// Session 47.1 replaced the holofoil "spark" (ADR-036) with an 8-bit
// pixel Pokeball rendered entirely in foil-navy: top half + center band
// (with a cream button) at full navy, bottom half at 75% navy for a
// two-tone read. No red, no white — it stays on the cream/navy/gold
// palette (the only non-navy is the cream button, which reads as the
// Pokeball's clasp). `shape-rendering: crispEdges` keeps the pixels sharp
// at every size, including the 16px favicon.
//
// Sizes ladder (sm/md/lg) so the same glyph serves footer (sm), header
// (md), and hero/marquee (lg). PokeballMark is exported standalone for
// reuse as an inline bullet (the hero pills) at an arbitrary px size.

type Size = "sm" | "md" | "lg";

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

/** The pixel Pokeball, drawn on a 7×7 grid. Reusable at any px size. */
export function PokeballMark({ px = 14 }: { px?: number }) {
  return (
    <svg
      viewBox="0 0 7 7"
      width={px}
      height={px}
      role="presentation"
      aria-hidden
      shapeRendering="crispEdges"
      className="inline-block shrink-0"
    >
      {/* top half + center band — full navy */}
      <g fill="#0f1e3a">
        <rect x="2" y="0" width="3" height="1" />
        <rect x="1" y="1" width="5" height="1" />
        <rect x="0" y="2" width="7" height="1" />
        <rect x="0" y="3" width="7" height="1" />
      </g>
      {/* bottom half — navy at 75% for the two-tone read */}
      <g fill="#0f1e3a" opacity="0.75">
        <rect x="0" y="4" width="7" height="1" />
        <rect x="1" y="5" width="5" height="1" />
        <rect x="2" y="6" width="3" height="1" />
      </g>
      {/* center button (clasp) */}
      <rect x="3" y="3" width="1" height="1" fill="#f8f5f0" />
    </svg>
  );
}

export function LogoGlyph({ size = "md" }: { size?: Size }) {
  const px = GLYPH_PX[size];
  return (
    <span aria-hidden className="inline-block shrink-0" style={{ width: px, height: px }}>
      <PokeballMark px={px} />
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
