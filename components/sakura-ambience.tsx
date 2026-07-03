// Site-ambient sakura (binder-aesthetic-pass, 2026-07-02; petal-fidelity-pass
// same day: shared shape library + gradient petals + 3x density). The /lines
// petal machinery rendered at AMBIENT density on the charcoal surfaces.
// /lines stays the densest surface of the motif (84 petals — the flagship);
// the homepage runs 48 (atmosphere, not weather); /deals + the vault headers
// run 30 (25 far + 5 sharp anchors). Same constraints throughout: deterministic seeded
// fields (no runtime randomness — the guards forbid Math.random),
// transform/opacity only, motion-safe: gated (reduced-motion = static
// scatter), pointer-events-none + z-under content so legibility never pays.
//
// Skill trace (per the standing protocol): impeccable set the density ladder
// and the shape-read bar ("a static screenshot at 100% must say cherry
// blossom"); frontend-design drove the two-stop gradient geometry in
// petal-shapes.ts; emil-design-eng kept the physics (far layer slower than
// near — parallax mass, no linear same-phase motion).

import { PetalField } from "./lines/sakura-petals";
import { buildPetalField, type BlossomSpec, type PetalZone } from "./lines/petal-shapes";

// Homepage (charcoal): 48 petals — 15 near / 33 far, concentrated over the
// hero sky band and the margins around the card fan, thinning toward the
// fold. Tints run HIGHER than /lines' cream values: the petal ink needs more
// presence against #0d0d0e to read at all, while the far layer stays a
// whisper.
const NIGHT_ZONES: readonly PetalZone[] = [
  // The sky band above the fan.
  { count: 7, left: [2, 96], top: [1, 14], layer: "near", size: [18, 32], tint: [0.6, 0.95] },
  { count: 9, left: [3, 97], top: [1, 15], layer: "far", size: [10, 16], tint: [0.34, 0.5] },
  // Margins either side of the fan — gated to sm+ (the mobile headline spans
  // full width; petals never sit over body text at rest).
  { count: 3, left: [0, 9], top: [16, 54], layer: "near", size: [18, 28], tint: [0.5, 0.8], hideBelowSm: true },
  { count: 7, left: [0, 10], top: [16, 56], layer: "far", size: [10, 15], tint: [0.3, 0.46], hideBelowSm: true },
  { count: 3, left: [90, 99], top: [16, 54], layer: "near", size: [18, 28], tint: [0.5, 0.8], hideBelowSm: true },
  { count: 7, left: [89, 99], top: [16, 56], layer: "far", size: [10, 15], tint: [0.3, 0.46], hideBelowSm: true },
  // Depth behind the fan (fan renders above; these read through the gaps).
  { count: 2, left: [14, 86], top: [18, 38], layer: "near", size: [18, 24], tint: [0.4, 0.6] },
  { count: 6, left: [13, 87], top: [18, 42], layer: "far", size: [10, 14], tint: [0.28, 0.42] },
  // Fold thinning.
  { count: 4, left: [10, 90], top: [46, 60], layer: "far", size: [10, 14], tint: [0.26, 0.38] },
];

const NIGHT_PETALS = buildPetalField(20260703, NIGHT_ZONES);

// ONE blossom on the homepage viewport (the sparing-accent cap).
const NIGHT_BLOSSOMS: readonly BlossomSpec[] = [
  { left: "84%", top: "6%", delay: "-11s", dur: "27s", fall: "b", sway: "a", swayDur: "9.6s", size: 28, rot: 22, tint: 0.8 },
];

// /deals + vault headers: 30 petals — 25 far atmosphere + a 5-petal SHARP
// minority in the side margins. The iter-1 shot proved a far-only field on
// charcoal reads as blurred smudges (the pink-dot bug back again): with no
// sharp petal anchoring the motif, blur+distance is all the eye gets. The
// sharp five live in the margins, clear of the centered header text. No
// blossom (restraint). Verdict-1 (shape read) outranks far-layer purity.
const HEADER_ZONES: readonly PetalZone[] = [
  { count: 3, left: [2, 22], top: [4, 46], layer: "near", size: [16, 24], tint: [0.5, 0.72], hideBelowSm: true },
  { count: 2, left: [78, 97], top: [4, 46], layer: "near", size: [16, 24], tint: [0.5, 0.72], hideBelowSm: true },
  { count: 11, left: [2, 97], top: [2, 30], layer: "far", size: [10, 16], tint: [0.32, 0.46] },
  { count: 9, left: [3, 96], top: [30, 58], layer: "far", size: [10, 15], tint: [0.28, 0.42] },
  { count: 5, left: [5, 94], top: [58, 88], layer: "far", size: [10, 14], tint: [0.24, 0.36] },
];

const HEADER_PETALS = buildPetalField(20260704, HEADER_ZONES);

export function SakuraAmbience({ mode }: { mode: "night" | "header" }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {mode === "night" ? (
        <PetalField petals={NIGHT_PETALS} blossoms={NIGHT_BLOSSOMS} tone="night" />
      ) : (
        <PetalField petals={HEADER_PETALS} tone="night" />
      )}
    </div>
  );
}
