// Site-ambient sakura (binder-aesthetic-pass, 2026-07-02). The /lines petal
// machinery (notched-teardrop SVG, two depth layers, per-petal breeze/sway/
// wobble physics via CSS custom properties — lines-petals-and-type) rendered
// at AMBIENT density on the charcoal surfaces. /lines stays the densest
// surface of the motif (28 petals — the flagship); the homepage runs ~16
// (atmosphere, not weather); /deals + the vault headers run 9, far-layer
// only. Same constraints throughout: deterministic hand-varied specs (no
// runtime randomness — it would hydration-mismatch and the guards forbid it),
// transform/opacity only, motion-safe: gated (reduced-motion = static
// scatter), pointer-events-none + z-under content so legibility never pays.
//
// Skill trace (per the standing protocol): impeccable-quieter set the
// density ladder (28 → 16 → 9: "if a screenshot reads as confetti, thin
// it"); soft-skill kept the physics (mass-plausible drift, no linear
// motion); frontend-design kept the motif meaningful — petals mark the
// binder-aesthetic surfaces eve's audience walks, not random decoration.

import { Petal } from "./lines/sakura-petals";

type AmbientSpec = {
  left: string;
  top: string;
  delay: string;
  dur: string;
  sway: string;
  amp: string;
  wob: string;
  breeze: string;
  size: number;
  rot: number;
  tint: number;
  layer: "near" | "far";
};

// Homepage (charcoal): 16 petals — 6 near / 10 far, concentrated over the
// hero band, thinning toward the fold. Tints run HIGHER than /lines' cream
// values: the petal ink needs more presence against #0d0d0e to read at all,
// while the far layer stays a whisper.
const NIGHT_PETALS: readonly AmbientSpec[] = [
  { left: "5%",  top: "8%",  delay: "0s",    dur: "17s", sway: "5.6s",  amp: "13px", wob: "17deg", breeze: "4vw",   size: 19, rot: -28, tint: 0.9,  layer: "near" },
  { left: "17%", top: "20%", delay: "-7s",   dur: "19s", sway: "6.6s",  amp: "10px", wob: "21deg", breeze: "3vw",   size: 14, rot: 44,  tint: 0.75, layer: "near" },
  { left: "38%", top: "5%",  delay: "-3s",   dur: "16s", sway: "5.9s",  amp: "15px", wob: "14deg", breeze: "5vw",   size: 21, rot: 15,  tint: 0.95, layer: "near" },
  { left: "62%", top: "12%", delay: "-11s",  dur: "18s", sway: "6.2s",  amp: "12px", wob: "19deg", breeze: "3.5vw", size: 16, rot: -52, tint: 0.8,  layer: "near" },
  { left: "81%", top: "7%",  delay: "-5s",   dur: "17s", sway: "5.4s",  amp: "14px", wob: "23deg", breeze: "2.5vw", size: 18, rot: 66,  tint: 0.85, layer: "near" },
  { left: "92%", top: "24%", delay: "-13s",  dur: "20s", sway: "7s",    amp: "11px", wob: "16deg", breeze: "4.5vw", size: 13, rot: -38, tint: 0.7,  layer: "near" },
  { left: "10%", top: "34%", delay: "-4s",   dur: "23s", sway: "8.2s",  amp: "8px",  wob: "12deg", breeze: "5.5vw", size: 11, rot: 30,  tint: 0.5,  layer: "far" },
  { left: "26%", top: "11%", delay: "-16s",  dur: "25s", sway: "8.8s",  amp: "7px",  wob: "10deg", breeze: "4vw",   size: 9,  rot: -20, tint: 0.45, layer: "far" },
  { left: "47%", top: "27%", delay: "-9s",   dur: "24s", sway: "8.4s",  amp: "8px",  wob: "13deg", breeze: "6vw",   size: 10, rot: 58,  tint: 0.48, layer: "far" },
  { left: "55%", top: "9%",  delay: "-20s",  dur: "26s", sway: "9.2s",  amp: "6px",  wob: "9deg",  breeze: "3vw",   size: 9,  rot: -64, tint: 0.42, layer: "far" },
  { left: "71%", top: "30%", delay: "-14s",  dur: "24s", sway: "8.6s",  amp: "9px",  wob: "14deg", breeze: "5vw",   size: 11, rot: 40,  tint: 0.5,  layer: "far" },
  { left: "87%", top: "15%", delay: "-22s",  dur: "27s", sway: "9.6s",  amp: "7px",  wob: "11deg", breeze: "3.5vw", size: 10, rot: -46, tint: 0.44, layer: "far" },
  { left: "33%", top: "42%", delay: "-18s",  dur: "27s", sway: "9.8s",  amp: "7px",  wob: "10deg", breeze: "4.5vw", size: 9,  rot: 24,  tint: 0.38, layer: "far" },
  { left: "60%", top: "48%", delay: "-8s",   dur: "26s", sway: "9.4s",  amp: "8px",  wob: "12deg", breeze: "5.5vw", size: 10, rot: -70, tint: 0.36, layer: "far" },
  { left: "20%", top: "56%", delay: "-24s",  dur: "28s", sway: "10.2s", amp: "6px",  wob: "9deg",  breeze: "4vw",   size: 9,  rot: 50,  tint: 0.32, layer: "far" },
  { left: "78%", top: "52%", delay: "-12s",  dur: "28s", sway: "10s",   amp: "7px",  wob: "11deg", breeze: "6vw",   size: 9,  rot: -32, tint: 0.34, layer: "far" },
];

// /deals + vault headers: 9 petals, FAR layer only — pure atmosphere over
// the header band, never competing with data rows.
const HEADER_PETALS: readonly AmbientSpec[] = [
  { left: "8%",  top: "12%", delay: "-2s",  dur: "24s", sway: "8.4s",  amp: "7px", wob: "11deg", breeze: "4vw",   size: 10, rot: -26, tint: 0.42, layer: "far" },
  { left: "22%", top: "30%", delay: "-9s",  dur: "26s", sway: "9s",    amp: "6px", wob: "9deg",  breeze: "5vw",   size: 9,  rot: 38,  tint: 0.36, layer: "far" },
  { left: "37%", top: "8%",  delay: "-15s", dur: "25s", sway: "8.8s",  amp: "8px", wob: "12deg", breeze: "3.5vw", size: 11, rot: 62,  tint: 0.44, layer: "far" },
  { left: "52%", top: "26%", delay: "-5s",  dur: "27s", sway: "9.4s",  amp: "6px", wob: "10deg", breeze: "5.5vw", size: 9,  rot: -50, tint: 0.38, layer: "far" },
  { left: "66%", top: "10%", delay: "-19s", dur: "25s", sway: "8.6s",  amp: "7px", wob: "13deg", breeze: "4.5vw", size: 10, rot: 20,  tint: 0.42, layer: "far" },
  { left: "79%", top: "32%", delay: "-11s", dur: "27s", sway: "9.6s",  amp: "6px", wob: "9deg",  breeze: "3vw",   size: 9,  rot: -66, tint: 0.34, layer: "far" },
  { left: "90%", top: "16%", delay: "-23s", dur: "26s", sway: "9.2s",  amp: "7px", wob: "11deg", breeze: "6vw",   size: 10, rot: 46,  tint: 0.4,  layer: "far" },
  { left: "45%", top: "44%", delay: "-7s",  dur: "28s", sway: "10s",   amp: "6px", wob: "8deg",  breeze: "4vw",   size: 9,  rot: -14, tint: 0.3,  layer: "far" },
  { left: "14%", top: "50%", delay: "-17s", dur: "28s", sway: "10.4s", amp: "6px", wob: "10deg", breeze: "5vw",   size: 9,  rot: 70,  tint: 0.3,  layer: "far" },
];

export function SakuraAmbience({ mode }: { mode: "night" | "header" }) {
  const petals = mode === "night" ? NIGHT_PETALS : HEADER_PETALS;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {petals.map((p, i) => (
        <span
          key={i}
          className={`absolute motion-safe:animate-[sakura-fall_var(--dur)_linear_var(--delay)_infinite] ${
            p.layer === "far" ? "blur-[2px]" : ""
          }`}
          style={
            {
              left: p.left,
              top: p.top,
              "--dur": p.dur,
              "--delay": p.delay,
              "--breeze": p.breeze,
            } as React.CSSProperties
          }
        >
          <span
            className="block motion-safe:animate-[sakura-sway_var(--sway)_ease-in-out_var(--delay)_infinite_alternate]"
            style={{ "--sway": p.sway, "--amp": p.amp, "--wob": p.wob } as React.CSSProperties}
          >
            <Petal size={p.size} rot={p.rot} tint={p.tint} />
          </span>
        </span>
      ))}
    </div>
  );
}
