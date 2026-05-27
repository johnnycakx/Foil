// ADR-032 — gold rhombus brand glyph + "Foil" wordmark.
//
// The rhombus is a foil-facet shorthand: a single rotated parallelogram
// reads as a tilted card corner, a holofoil facet, a refracted-light
// glint. Replaces the gold round dot used between Sessions 39-42 — the
// dot read as "indie SaaS template," the rhombus reads as collector-
// niche.
//
// Sizes ladder (sm/md/lg) so the same glyph appears at header (md),
// footer (sm), and any future hero/marquee surface (lg) without
// per-instance tweaks.

type Size = "sm" | "md" | "lg";

const GLYPH_PX: Record<Size, number> = {
  sm: 10,
  md: 12,
  lg: 20,
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

export function LogoGlyph({ size = "md" }: { size?: Size }) {
  const px = GLYPH_PX[size];
  // Outer wrapper is rotated 15° so the rhombus tilts; inner SVG is
  // axis-aligned so the inner shimmer-gradient + gold-fill stay crisp.
  // SVG over CSS so we get a single visual unit + a clean favicon
  // primitive we can serve from /public/favicon.svg.
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: px, height: px, transform: "rotate(15deg)" }}
    >
      <svg viewBox="0 0 12 12" width={px} height={px} role="presentation">
        <defs>
          <linearGradient id="foil-rhombus-gradient" x1="0" y1="0" x2="12" y2="12" gradientUnits="userSpaceOnUse">
            {/* Holofoil shimmer suggestion: deeper gold at top-left
                edge → cream-tinted highlight bottom-right → back to
                gold. Three stops keep the file small enough to inline
                in the favicon. */}
            <stop offset="0%" stopColor="#a07d2c" />
            <stop offset="50%" stopColor="#e6c170" />
            <stop offset="100%" stopColor="#c9a24b" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="12" height="12" fill="url(#foil-rhombus-gradient)" />
      </svg>
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
