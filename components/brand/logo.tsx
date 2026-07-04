// ADR-094 — the Foil "hanko" seal mark + "Foil" wordmark (Bricolage Grotesque).
//
// Supersedes ADR-055's foil-corner card mark + gold "FoilTCG" wordmark. Two
// forcing functions (John, 2026-07-01): (1) the gold accent is being retired
// (fable-design-overhaul palette revision), which kills the gold-sheen "TCG"
// treatment; (2) the brand needed a single owned mark that IS also the accent-
// color decision. John's Stage-1 pick: "C1 — the hanko, carved straight" — a
// vermillion carved seal, a card slotting into a pocket knocked out in negative
// space, centered on the seal's vertical axis. The hanko vermillion (#D85A30)
// is the coral that succeeds gold.
//
// Master geometry: 24×24 grid (John's canonical SVG, optically refined). The
// seal SQUARE is the mark — favicons/avatars render it full-bleed (rounded
// square, not circle-cropped). Knockout = cream (#f8f5f0) on vermillion. A
// navy monochrome variant exists for single-ink contexts (print, embeds).
//
// Wordmark: seal + "Foil" in Bricolage Grotesque 600, navy ink. "TCG" is
// dropped from the display wordmark (the domain keeps it). Font pinned in
// app/layout.tsx as the `--font-wordmark` next/font var.

type Size = "sm" | "md" | "lg";
/** "onCream" (default, header): navy "Foil". "onNavy" (footer/dark/OG): cream "Foil".
 *  "chrome": follows the shared header/footer tone via var(--chrome-ink), so the
 *  lockup flips with the chrome on night-toned pages (overnight-design-loop). */
type Tone = "onCream" | "onNavy" | "chrome";
type MarkVariant = "vermillion" | "mono";
/** "carved" (default): Bricolage Grotesque (ADR-094). "bubble": Shrikhand —
 *  the balloon-letter identity cut from John's round-2 verdict (closest OFL
 *  match to the personal-use-only Skylens Italic taste ref), live text only. */
type Face = "carved" | "bubble";

const MARK_PX: Record<Size, number> = { sm: 18, md: 22, lg: 32 };
const WORDMARK_CLASS: Record<Size, string> = { sm: "text-base", md: "text-xl", lg: "text-3xl" };
const GAP_CLASS: Record<Size, string> = { sm: "gap-1.5", md: "gap-2", lg: "gap-2.5" };

export const SEAL_VERMILLION = "#D85A30";
const CREAM = "#f8f5f0";
const NAVY = "#0f1e3a";

/**
 * The Foil hanko seal mark (ADR-094). A vermillion carved seal: a card
 * (cream outline) slotting into a pocket (cream bar), knocked out in negative
 * space. `variant="mono"` renders it in a single navy ink for contexts where
 * the vermillion is unavailable. Transparent outside the seal square, so it
 * drops into any lockup or renders full-bleed as a favicon/avatar.
 *
 * Geometry is the John-approved 24×24 master — refine optically, do not
 * redesign. At ≤16px the card stroke thickens (~1.8) so the slot stays legible.
 */
export function SealMark({
  px = 22,
  variant = "vermillion",
}: {
  px?: number;
  variant?: MarkVariant;
}) {
  const cardStroke = px <= 16 ? 1.8 : 1.5;
  const ink = variant === "mono" ? NAVY : CREAM;
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      role="presentation"
      aria-hidden
      className="inline-block shrink-0"
    >
      {/* The seal square: solid vermillion, or a navy outline in mono. */}
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        rx="4.6"
        fill={variant === "mono" ? "none" : SEAL_VERMILLION}
        stroke={variant === "mono" ? NAVY : "none"}
        strokeWidth={variant === "mono" ? 1.4 : 0}
      />
      {/* The card — an outline knocked into the seal. */}
      <rect x="8.9" y="5.4" width="6.2" height="9.6" rx="1.1" fill="none" stroke={ink} strokeWidth={cardStroke} />
      {/* The pocket bar the card slots into. */}
      <path d="M6 14.4h12v1.5a2.9 2.9 0 0 1-2.9 2.9H8.9A2.9 2.9 0 0 1 6 15.9z" fill={ink} />
    </svg>
  );
}

/**
 * Deprecated alias for the pre-ADR-094 name. Kept so existing call sites don't
 * break; renders the new seal mark. Prefer `SealMark`.
 */
export function FoilCornerMark({ px = 22 }: { px?: number }) {
  return <SealMark px={px} />;
}

/**
 * The FoilTCG wordmark lockup (ADR-094, amended by the blackout-brand goal):
 * the hanko seal + bold "Foil" (white/cream on night chrome, navy ink on
 * cream) + "TCG" in metallic gold — the `.wordmark-tcg` ramp anchored on the
 * real gold #856a00 (globals.css), the ONLY gold on any night surface.
 * John's verdict (2026-07-03) deliberately reverses ADR-094's TCG drop.
 * "TCG" is the SAME font CUT as "Foil" (John, 2026-07-04): it inherits the
 * lockup's face and weight, and only shrinks to a suffix cap height. It does
 * NOT force its own family — the earlier `font-wordmark` override made "TCG"
 * render Bricolage next to the Shrikhand bubble "Foil" in the chrome, which
 * read as a different, thinner typeface. Inheriting keeps them one face in
 * every context (bubble → both Shrikhand, carved → both Bricolage). The gold
 * `.wordmark-tcg` shimmer clips over whatever face renders. One accessible
 * name: "FoilTCG home".
 */
export function Logo({
  size = "md",
  tone = "onCream",
  withMark = true,
  face = "carved",
}: {
  size?: Size;
  tone?: Tone;
  withMark?: boolean;
  face?: Face;
}) {
  const foilColor =
    tone === "chrome"
      ? "text-[var(--chrome-ink)]"
      : tone === "onNavy"
        ? "text-foil-cream"
        : "text-foil-navy";
  const faceClass = face === "bubble" ? "font-wordmark-bubble font-normal" : "font-wordmark";
  // Round-3 fix 5: the bubble wordmark is pure lettering at presence size —
  // one step up from the carved ladder (md chrome renders ~24px), identical
  // treatment on night and cream.
  const wordmarkClass =
    face === "bubble" && size === "md" ? "text-2xl" : WORDMARK_CLASS[size];
  return (
    <span
      aria-label="FoilTCG home"
      className={`${faceClass} inline-flex items-center font-semibold leading-none tracking-tight ${GAP_CLASS[size]}`}
    >
      {withMark && <SealMark px={MARK_PX[size]} />}
      <span aria-hidden className={`${wordmarkClass} inline-flex items-baseline gap-[0.28em]`}>
        <span className={foilColor}>Foil</span>
        {/* Same face + weight as "Foil" (inherited from the lockup); the cap
            height shrinks to a confident suffix (John, 2026-07-04: 0.5em read
            too small) and a hair of tracking keeps the small caps legible. The
            gold shimmer clips over this face. */}
        <span className="wordmark-tcg text-[0.62em] tracking-[0.03em]">TCG</span>
      </span>
    </span>
  );
}
