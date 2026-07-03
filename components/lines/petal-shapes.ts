// The ONE petal source of truth (petal-fidelity-pass, 2026-07-02).
//
// John's verdict on the banner + live homepage: the old single teardrop path
// read as PINK DOTS. The root fix is geometry, not density: a petal reads as
// a sakura petal only when the silhouette carries (a) a narrow wedge base,
// (b) swelling shoulders, and (c) the notched tip — the V cut between two
// lobes that is THE cherry-blossom identifier. Below ~9px rendered no
// silhouette survives; MIN_PETAL_PX enforces the floor.
//
// Every petal rendering in the project derives from this module: the /lines
// hero (components/lines/sakura-petals.tsx), the site ambience
// (components/sakura-ambience.tsx), the lines OG card (via petalMarkup), the
// favicon/icon glyph, and the X-banner artifact (design-loop/banner). The
// visual-regression suite pins each consumer to these paths so a second
// petal implementation can never drift in again.
//
// Skill trace: frontend-design set the "botanical fact, not particle dust"
// bar and the two-stop gradient (pale center → deeper edge, how a lit petal
// actually shades); impeccable's shape-read check picked the winning
// geometry off a static screenshot grid (2-stop gradient + hairline edge
// stroke reads at 20px; the 3-stop wash went gray); emil-design-eng kept the
// motion rig transform/opacity-only with far-layer-slower parallax.

export const PETAL_VIEWBOX = "0 0 24 24";

export type PetalShape = "classic" | "curl" | "slender";

/** Three distinct single-petal silhouettes, stem-down / notched-tip-up in a
 *  24x24 box. Rotation + scale variance does the rest — no two petals on a
 *  surface should look stamped from the same die. */
export const PETAL_PATHS: Record<PetalShape, string> = {
  // The classic sakura petal: symmetric wedge base, deep V notch between two
  // tip lobes. Carries the shape read; the majority shape on every surface.
  classic:
    "M12 22.4 C10.4 20.8 7.4 17.6 6.5 13.4 C5.6 9.2 7.4 4.9 9.9 2.1 C10.8 3.4 11.5 4.8 12 6.6 C12.5 4.8 13.2 3.4 14.1 2.1 C16.6 4.9 18.4 9.2 17.5 13.4 C16.6 17.6 13.6 20.8 12 22.4 Z",
  // Wind-curled: one shoulder fuller, the silhouette leans — a petal seen
  // mid-tumble rather than pressed flat.
  curl: "M11 22.4 C9 20.4 6.6 16.8 6.4 12.6 C6.2 8.4 8.2 4.3 10.9 1.7 C11.5 3 12 4.3 12.3 5.9 C13.2 4 14.6 2.4 16.3 1.5 C17.9 4.6 18.5 9 17.3 13.1 C16.1 17.2 13.4 20.7 11 22.4 Z",
  // Slender: a folded petal edge-on. Minority shape; adds fall variety.
  slender:
    "M12 22.6 C10.8 21 8.9 17.7 8.5 13.2 C8.1 8.8 9.6 4.4 11.2 1.8 C11.6 3 11.8 4.2 12 5.6 C12.2 4.2 12.4 3 12.8 1.8 C14.4 4.4 15.9 8.8 15.5 13.2 C15.1 17.7 13.2 21 12 22.6 Z",
};

/** One petal of the five-petal blossom; base at the flower center (12,13),
 *  rotated 5 x 72deg by the consumers. The blossom is used SPARINGLY —
 *  1-2 per viewport max, never on the header surfaces. */
export const BLOSSOM_PETAL_PATH =
  "M12 13 C10.2 11.8 9 9.4 9.4 6.8 C9.7 4.9 10.5 3.1 11.1 2.2 C11.5 2.9 11.8 3.7 12 4.6 C12.2 3.7 12.5 2.9 12.9 2.2 C13.5 3.1 14.3 4.9 14.6 6.8 C15 9.4 13.8 11.8 12 13 Z";
export const BLOSSOM_VIEWBOX = "0 0 24 26";
export const BLOSSOM_CENTER = { x: 12, y: 13 } as const;

export type PetalTone = "night" | "day";

/** Two-stop gradient stops (pale center → deeper pink edge) per ground.
 *  `night` sits on the charcoal (#0d0d0e) surfaces; `day` sits on the cream
 *  /lines hero and needs the deeper pair to hold contrast. Both stay in the
 *  --color-foil-sakura (#d98aa0) family. Literal hexes on purpose: this
 *  module is consumed by Satori (OG) and static-asset scripts where CSS
 *  variables never resolve. */
export const PETAL_TONES: Record<PetalTone, { center: string; edge: string }> = {
  night: { center: "#f0c3d0", edge: "#c9718c" },
  day: { center: "#eeb7c8", edge: "#c05a7b" },
};

/** Below this rendered size a petal is a dot again, whatever the geometry. */
export const MIN_PETAL_PX = 9;

/** Hairline edge stroke (viewBox units) — keeps the silhouette legible at
 *  the small end of the far layer. */
export const PETAL_STROKE_WIDTH = 0.7;

// ---------------------------------------------------------------------------
// Static markup helpers — for consumers that can't render React (the lines OG
// template feeds these to Satori as data-URI <img>s; asset scripts embed them
// verbatim). Gradient ids are namespaced per call so multiple petals can sit
// in one document.
// ---------------------------------------------------------------------------

export function petalMarkup(opts: {
  shape: PetalShape;
  size: number;
  rot: number;
  tone: PetalTone;
  id: string;
}): string {
  const { shape, rot, tone, id } = opts;
  const size = Math.max(opts.size, MIN_PETAL_PX);
  const { center, edge } = PETAL_TONES[tone];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${PETAL_VIEWBOX}">` +
    `<defs><radialGradient id="${id}" cx="50%" cy="46%" r="70%">` +
    `<stop offset="0%" stop-color="${center}"/><stop offset="100%" stop-color="${edge}"/>` +
    `</radialGradient></defs>` +
    `<path d="${PETAL_PATHS[shape]}" fill="url(#${id})" stroke="${edge}" stroke-width="${PETAL_STROKE_WIDTH}" transform="rotate(${rot} 12 12)"/>` +
    `</svg>`
  );
}

export function blossomMarkup(opts: { size: number; rot: number; tone: PetalTone; id: string }): string {
  const { rot, tone, id } = opts;
  const size = Math.max(opts.size, MIN_PETAL_PX);
  const { center, edge } = PETAL_TONES[tone];
  const petals = [0, 72, 144, 216, 288]
    .map(
      (a) =>
        `<path d="${BLOSSOM_PETAL_PATH}" fill="url(#${id})" stroke="${edge}" stroke-width="${PETAL_STROKE_WIDTH}" transform="rotate(${a + rot} ${BLOSSOM_CENTER.x} ${BLOSSOM_CENTER.y})"/>`,
    )
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * (26 / 24)}" viewBox="${BLOSSOM_VIEWBOX}">` +
    `<defs><radialGradient id="${id}" cx="50%" cy="50%" r="62%">` +
    `<stop offset="0%" stop-color="${center}"/><stop offset="100%" stop-color="${edge}"/>` +
    `</radialGradient></defs>` +
    petals +
    `<circle cx="${BLOSSOM_CENTER.x}" cy="${BLOSSOM_CENTER.y}" r="1.5" fill="${edge}"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// Deterministic field builder — 3x density is ~160 petals across the ladder;
// hand-writing every spec stops scaling. A seeded PRNG keeps the field
// deterministic (same seed → byte-identical specs, server-render stable, no
// Math.random — the guards forbid it) while zones keep the ART DIRECTION
// hand-authored: density clusters into the open zones (hero band, margins,
// around the fan), never over body text at rest.
// ---------------------------------------------------------------------------

export type PetalLayer = "near" | "far";

/** Quantized motion variant — one of four LITERAL keyframe sets in
 *  globals.css (sakura-fall-a…d / sakura-sway-a…d). var() inside a keyframe
 *  forces the animation onto the main thread; literal keyframes composite.
 *  Per-petal duration/delay stay var()-driven in the animation shorthand
 *  (resolved once at style time — compositor-safe). */
export type MotionVariant = "a" | "b" | "c" | "d";

export type PetalFieldSpec = {
  left: string;
  top: string;
  delay: string;
  dur: string;
  /** Fall breeze variant (net horizontal drift over the descent). */
  fall: MotionVariant;
  /** Sway amplitude/wobble variant. */
  sway: MotionVariant;
  swayDur: string;
  size: number;
  rot: number;
  tint: number;
  shape: PetalShape;
  layer: PetalLayer;
  /** Margin zones collide with full-width text on narrow viewports — the
   *  "no petal over body text at rest" rule gates them to sm and up. */
  hideBelowSm?: boolean;
};

/** A hand-authored density zone: `count` petals scattered inside the
 *  left/top percent-rect. The zones ARE the art direction. */
export type PetalZone = {
  count: number;
  left: readonly [number, number];
  top: readonly [number, number];
  layer: PetalLayer;
  /** Rendered px, clamped to MIN_PETAL_PX. Near ~18-32, far ~10-16. */
  size: readonly [number, number];
  tint: readonly [number, number];
  hideBelowSm?: boolean;
};

/** mulberry32 — tiny deterministic PRNG. Seeded per surface. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (r: number, [min, max]: readonly [number, number]) => min + r * (max - min);
const round1 = (n: number) => Math.round(n * 10) / 10;

const FALL_VARIANTS: readonly MotionVariant[] = ["a", "b", "c", "d"];
// Far sways gentler (a/b), near livelier (b/c/d) — mass-plausible depth.
const NEAR_SWAYS: readonly MotionVariant[] = ["b", "c", "d"];
const FAR_SWAYS: readonly MotionVariant[] = ["a", "b"];

export function buildPetalField(seed: number, zones: readonly PetalZone[]): PetalFieldSpec[] {
  const rand = mulberry32(seed);
  const specs: PetalFieldSpec[] = [];
  for (const zone of zones) {
    for (let i = 0; i < zone.count; i++) {
      const near = zone.layer === "near";
      // Far layer falls SLOWER than near (parallax: distant things drift) —
      // mass-plausible depth, not a particle system.
      const dur = near ? 15 + rand() * 5 : 22 + rand() * 7;
      const shapeRoll = rand();
      specs.push({
        left: `${round1(lerp(rand(), zone.left))}%`,
        top: `${round1(lerp(rand(), zone.top))}%`,
        // Negative delay phases the infinite loop — the sky is mid-bloom on
        // first paint, and no two petals share a phase.
        delay: `-${round1(rand() * dur)}s`,
        dur: `${round1(dur)}s`,
        // Breeze is never 0 — petals never drop straight down (every fall
        // variant carries a literal horizontal drift).
        fall: FALL_VARIANTS[Math.floor(rand() * 4)],
        sway: near ? NEAR_SWAYS[Math.floor(rand() * 3)] : FAR_SWAYS[Math.floor(rand() * 2)],
        swayDur: `${round1(near ? 5.2 + rand() * 2.3 : 8 + rand() * 2.6)}s`,
        size: Math.max(Math.round(lerp(rand(), zone.size)), MIN_PETAL_PX),
        rot: Math.round(-85 + rand() * 170),
        tint: Math.round(lerp(rand(), zone.tint) * 100) / 100,
        // Classic carries the read (majority); curl + slender add variety.
        shape: shapeRoll < 0.52 ? "classic" : shapeRoll < 0.8 ? "curl" : "slender",
        layer: zone.layer,
        ...(zone.hideBelowSm ? { hideBelowSm: true } : {}),
      });
    }
  }
  return specs;
}

/** A hand-placed five-petal blossom — the sparing accent (1-2 per viewport
 *  max). Slower, heavier drift than a single petal. */
export type BlossomSpec = {
  left: string;
  top: string;
  delay: string;
  dur: string;
  fall: MotionVariant;
  sway: MotionVariant;
  swayDur: string;
  size: number;
  rot: number;
  tint: number;
  hideBelowSm?: boolean;
};
