// ADR-036 — holofoil "spark" brand glyph + "Foil" wordmark.
//
// Session 46 retired the gold rhombus (ADR-032): a rotated square read
// as a folder/placeholder at favicon size. The replacement is a
// four-point sparkle with two smaller shimmer accents — a "spark of
// holofoil" that reads unmistakably as a *mark* at 16px and nods to the
// holographic-card glint collectors chase. NOT a Pokeball, NOT a square.
// Filled with the same three-stop holofoil gold gradient so it stays on
// the locked cream/navy/gold palette (gold only; no coral).
//
// Sizes ladder (sm/md/lg) so the same glyph serves footer (sm), header
// (md), and any hero/marquee surface (lg) without per-instance tweaks.

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

export function LogoGlyph({ size = "md" }: { size?: Size }) {
  const px = GLYPH_PX[size];
  // SVG over CSS so the mark is a single visual unit and a clean favicon
  // primitive we can serve from /public/favicon.svg. The main sparkle is
  // filled (legible at 16px); the two accents suggest holofoil shimmer.
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{ width: px, height: px }}
    >
      <svg viewBox="0 0 24 24" width={px} height={px} role="presentation" fill="none">
        <defs>
          <linearGradient id="foil-spark-gradient" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            {/* Holofoil shimmer: deeper gold top-left → cream-gold
                highlight mid → brand gold. Same stops as the favicon. */}
            <stop offset="0%" stopColor="#a07d2c" />
            <stop offset="50%" stopColor="#e6c170" />
            <stop offset="100%" stopColor="#c9a24b" />
          </linearGradient>
        </defs>
        {/* Main four-point sparkle — concave-sided star, centred. */}
        <path
          d="M12 2 C 12.5 8.5, 15.5 11.5, 22 12 C 15.5 12.5, 12.5 15.5, 12 22 C 11.5 15.5, 8.5 12.5, 2 12 C 8.5 11.5, 11.5 8.5, 12 2 Z"
          fill="url(#foil-spark-gradient)"
        />
        {/* Shimmer accents — small sparkles top-right + lower-left. */}
        <path
          d="M20 2.3 C 20.2 3.8, 20.7 4.3, 22.2 4.5 C 20.7 4.7, 20.2 5.2, 20 6.7 C 19.8 5.2, 19.3 4.7, 17.8 4.5 C 19.3 4.3, 19.8 3.8, 20 2.3 Z"
          fill="#c9a24b"
          opacity="0.85"
        />
        <path
          d="M4.7 15.9 C 4.85 17.1, 5.3 17.5, 6.5 17.6 C 5.3 17.7, 4.85 18.1, 4.7 19.3 C 4.55 18.1, 4.1 17.7, 2.9 17.6 C 4.1 17.5, 4.55 17.1, 4.7 15.9 Z"
          fill="#c9a24b"
          opacity="0.7"
        />
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
