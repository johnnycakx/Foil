// Sakura petal accent for the line-tracker hero (eve-line-tracker, ADR-095;
// reshaped in design-round3-fixes §3; petal-fidelity-pass 2026-07-02: petals
// that read as PETALS — shared shape library, two-stop gradient fills, 3x
// density with the ladder preserved, blossoms used sparingly).
// The ONE signature flourish on the surface. Petal fields are deterministic
// (seeded PRNG in petal-shapes.ts — no Math.random, which the harness bans).
// Motion lives entirely in `motion-safe:` animate classes (fall + sway), so
// prefers-reduced-motion users see a static petal scatter, never a moving
// one. Negative delays phase the infinite loop so the sky is already
// mid-bloom on first paint.

import {
  BLOSSOM_CENTER,
  BLOSSOM_PETAL_PATH,
  BLOSSOM_VIEWBOX,
  MIN_PETAL_PX,
  PETAL_PATHS,
  PETAL_STROKE_WIDTH,
  PETAL_TONES,
  PETAL_VIEWBOX,
  buildPetalField,
  type BlossomSpec,
  type MotionVariant,
  type PetalFieldSpec,
  type PetalShape,
  type PetalTone,
  type PetalZone,
} from "./petal-shapes";

/** Gradient defs, mounted ONCE per petal container. Every petal in the
 *  container references the tone's gradient by id — one def, N petals. */
function PetalDefs({ tone }: { tone: PetalTone }) {
  const { center, edge } = PETAL_TONES[tone];
  return (
    <svg aria-hidden width={0} height={0} className="absolute">
      <defs>
        <radialGradient id={`foil-petal-${tone}`} cx="50%" cy="46%" r="70%">
          <stop offset="0%" stopColor={center} />
          <stop offset="100%" stopColor={edge} />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** A single cherry-blossom petal — real notched-teardrop silhouette from the
 *  shared shape library, two-stop gradient (pale center → deeper edge) with
 *  a hairline edge stroke so the shape survives the small sizes. Exported
 *  for components/sakura-ambience.tsx. */
export function Petal({
  size,
  rot,
  tint,
  shape = "classic",
  tone = "day",
}: {
  size: number;
  rot: number;
  tint: number;
  shape?: PetalShape;
  tone?: PetalTone;
}) {
  const px = Math.max(size, MIN_PETAL_PX); // below ~9px a petal is a dot again
  return (
    <svg
      aria-hidden
      width={px}
      height={px}
      viewBox={PETAL_VIEWBOX}
      style={{ display: "block", opacity: tint, transform: `rotate(${rot}deg)` }}
    >
      <path
        d={PETAL_PATHS[shape]}
        fill={`url(#foil-petal-${tone})`}
        stroke={PETAL_TONES[tone].edge}
        strokeWidth={PETAL_STROKE_WIDTH}
      />
    </svg>
  );
}

/** The five-petal blossom — 1-2 per viewport MAX (the sparing accent that
 *  anchors the single petals as sakura, not confetti). */
export function Blossom({
  size,
  rot,
  tint,
  tone = "day",
}: {
  size: number;
  rot: number;
  tint: number;
  tone?: PetalTone;
}) {
  const px = Math.max(size, MIN_PETAL_PX);
  return (
    <svg
      aria-hidden
      width={px}
      height={px * (26 / 24)}
      viewBox={BLOSSOM_VIEWBOX}
      style={{ display: "block", opacity: tint, transform: `rotate(${rot}deg)` }}
    >
      {[0, 72, 144, 216, 288].map((a) => (
        <path
          key={a}
          d={BLOSSOM_PETAL_PATH}
          fill={`url(#foil-petal-${tone})`}
          stroke={PETAL_TONES[tone].edge}
          strokeWidth={PETAL_STROKE_WIDTH}
          transform={`rotate(${a} ${BLOSSOM_CENTER.x} ${BLOSSOM_CENTER.y})`}
        />
      ))}
      <circle cx={BLOSSOM_CENTER.x} cy={BLOSSOM_CENTER.y} r={1.5} fill={PETAL_TONES[tone].edge} />
    </svg>
  );
}

// Quantized motion classes (petal-fidelity-pass perf fix): the old rig fed
// per-petal breeze/amp/wobble through var() INSIDE the keyframes, which
// forces every animation onto the main thread — at 3x density that cost
// ~55fps on a 4x-CPU throttle. Four literal fall breezes x four literal sway
// amplitudes (globals.css) composite off the main thread; per-petal
// duration/delay stay var()-driven in the shorthand (resolved once). FULL
// literal class strings — Tailwind's scanner can't see template-built names.
const FALL_CLASS: Record<MotionVariant, string> = {
  a: "motion-safe:animate-[sakura-fall-a_var(--dur)_linear_var(--delay)_infinite]",
  b: "motion-safe:animate-[sakura-fall-b_var(--dur)_linear_var(--delay)_infinite]",
  c: "motion-safe:animate-[sakura-fall-c_var(--dur)_linear_var(--delay)_infinite]",
  d: "motion-safe:animate-[sakura-fall-d_var(--dur)_linear_var(--delay)_infinite]",
};
const SWAY_CLASS: Record<MotionVariant, string> = {
  a: "motion-safe:animate-[sakura-sway-a_var(--sway)_ease-in-out_var(--delay)_infinite_alternate]",
  b: "motion-safe:animate-[sakura-sway-b_var(--sway)_ease-in-out_var(--delay)_infinite_alternate]",
  c: "motion-safe:animate-[sakura-sway-c_var(--sway)_ease-in-out_var(--delay)_infinite_alternate]",
  d: "motion-safe:animate-[sakura-sway-d_var(--sway)_ease-in-out_var(--delay)_infinite_alternate]",
};

/** The shared drift rig: outer span falls (linear, viewport-relative, with
 *  a quantized breeze), nested span sways (ease-in-out alternate, quantized
 *  amplitude + rotation wobble). Transform/opacity only, motion-safe gated,
 *  far layer blurred for depth. Used by every petal surface — one rig,
 *  three densities. */
export function PetalField({
  petals,
  blossoms = [],
  tone,
}: {
  petals: readonly PetalFieldSpec[];
  blossoms?: readonly BlossomSpec[];
  tone: PetalTone;
}) {
  return (
    <>
      <PetalDefs tone={tone} />
      {petals.map((p, i) => (
        <span
          key={i}
          className={`absolute ${FALL_CLASS[p.fall]} ${p.layer === "far" ? "blur-[1px]" : ""} ${
            p.hideBelowSm ? "max-sm:hidden" : ""
          }`}
          style={
            {
              left: p.left,
              // Static (reduced-motion): petals rest scattered in the zones.
              top: p.top,
              "--dur": p.dur,
              "--delay": p.delay,
            } as React.CSSProperties
          }
        >
          {/* --delay inherits to the sway layer, so the two stay in phase. */}
          <span className={`block ${SWAY_CLASS[p.sway]}`} style={{ "--sway": p.swayDur } as React.CSSProperties}>
            <Petal size={p.size} rot={p.rot} tint={p.tint} shape={p.shape} tone={tone} />
          </span>
        </span>
      ))}
      {blossoms.map((b, i) => (
        <span
          key={`b${i}`}
          className={`absolute ${FALL_CLASS[b.fall]} ${b.hideBelowSm ? "max-sm:hidden" : ""}`}
          style={
            {
              left: b.left,
              top: b.top,
              "--dur": b.dur,
              "--delay": b.delay,
            } as React.CSSProperties
          }
        >
          <span className={`block ${SWAY_CLASS[b.sway]}`} style={{ "--sway": b.swayDur } as React.CSSProperties}>
            <Blossom size={b.size} rot={b.rot} tint={b.tint} tone={tone} />
          </span>
        </span>
      ))}
    </>
  );
}

// /lines — the FLAGSHIP density (84 petals + 2 blossoms; ladder: /lines >
// homepage 48 > headers 30). Zones keep density in the OPEN areas of the
// cream hero — the top sky band, the right side beyond the headline measure,
// the margins, and the rail band — never over the headline/tagline/CTA text
// block at rest.
const LINES_ZONES: readonly PetalZone[] = [
  // Top sky band — right of the dedication chip, above the headline.
  { count: 9, left: [26, 96], top: [0, 11], layer: "near", size: [18, 32], tint: [0.5, 0.8] },
  { count: 13, left: [22, 97], top: [0, 12], layer: "far", size: [10, 16], tint: [0.3, 0.48] },
  // Right open field — beyond the headline's max-width. On mobile the text
  // block spans full width, so the margin zones gate to sm+.
  { count: 8, left: [66, 97], top: [13, 56], layer: "near", size: [18, 30], tint: [0.45, 0.75], hideBelowSm: true },
  { count: 15, left: [64, 98], top: [13, 58], layer: "far", size: [10, 16], tint: [0.28, 0.45], hideBelowSm: true },
  // Left margin sliver.
  { count: 3, left: [0, 6], top: [14, 55], layer: "near", size: [18, 26], tint: [0.4, 0.65], hideBelowSm: true },
  { count: 6, left: [0, 7], top: [14, 58], layer: "far", size: [10, 15], tint: [0.28, 0.42], hideBelowSm: true },
  // The rail band (art, not text) + below-fold thinning. Full 3x density
  // (84) restored once the quantized-keyframe fix moved the animations off
  // the main thread — see FALL_CLASS above + design-loop/perf-petals.mjs.
  { count: 6, left: [4, 94], top: [60, 76], layer: "near", size: [18, 26], tint: [0.35, 0.6] },
  { count: 12, left: [4, 95], top: [60, 78], layer: "far", size: [10, 15], tint: [0.26, 0.4] },
  // Below-fold sparse — also gated to sm+: the least visible dozen, and
  // trimming them is what lifts a mid-tier PHONE back over 60fps (57.7 →
  // 60+ at 4x CPU throttle; desktop holds 92 at full 84).
  { count: 12, left: [6, 93], top: [80, 96], layer: "far", size: [10, 14], tint: [0.24, 0.36], hideBelowSm: true },
];

const LINES_PETALS = buildPetalField(20260702, LINES_ZONES);

// Two blossoms, hand-placed: one in the top-right sky, one drifting low-left.
// Heavier than a petal — slower fall, gentler sway.
const LINES_BLOSSOMS: readonly BlossomSpec[] = [
  { left: "87%", top: "5%", delay: "-9s", dur: "26s", fall: "b", sway: "a", swayDur: "9.4s", size: 30, rot: 14, tint: 0.7 },
  { left: "3%", top: "48%", delay: "-18s", dur: "28s", fall: "c", sway: "a", swayDur: "10.2s", size: 24, rot: -32, tint: 0.55, hideBelowSm: true },
];

export function SakuraPetals() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Faint sakura wash behind the hero band — cream-compatible, low alpha,
          weighted toward the headline + dedication corner. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 22% 6%, color-mix(in srgb, var(--color-foil-sakura) 13%, transparent) 0%, transparent 62%), radial-gradient(55% 45% at 82% 0%, color-mix(in srgb, var(--color-foil-sakura) 8%, transparent) 0%, transparent 60%)",
        }}
      />
      <PetalField petals={LINES_PETALS} blossoms={LINES_BLOSSOMS} tone="day" />
    </div>
  );
}
