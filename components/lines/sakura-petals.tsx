// Sakura petal accent for the line-tracker hero (eve-line-tracker, ADR-095;
// reshaped in design-round3-fixes §3 — hanami, not screen dust).
// The ONE signature flourish on the surface. Petals are deterministic (fixed
// positions/delays — no Math.random, which the harness bans and which would
// hydration-mismatch anyway). Motion lives entirely in `motion-safe:` animate
// classes (fall + sway), so prefers-reduced-motion users see a static petal
// scatter in the hero, never a moving one. Negative delays phase the infinite
// loop so the sky is already mid-bloom on first paint.

type PetalSpec = {
  /** Horizontal lane. Density is a gradient: concentrated over the headline +
   *  "Made for @possiblyeve" dedication (left half / top band), sparse below. */
  left: string;
  /** Static resting spot — the reduced-motion scatter AND the fall anchor. */
  top: string;
  /** Negative = start mid-cycle (no empty sky on load). */
  delay: string;
  dur: string;
  sway: string;
  /** Sway amplitude (px) — varied per petal so no two paths match. */
  amp: string;
  /** Rotation wobble (deg) inside the sway cycle. */
  wob: string;
  /** Net horizontal breeze drift over the whole descent (the wind). */
  breeze: string;
  size: number;
  rot: number;
  tint: number;
  /** near = sharp foreground petal; far = smaller, blurred, quieter (depth). */
  layer: "near" | "far";
};

// 28 petals (lines-petals-and-type: John's density verdict — 14 read sparse).
// The far/blurred layer carries the majority (18) so the density reads as
// atmosphere, not clutter; the near layer stays a minority (10) of sharp
// hero petals. Density gradient holds: concentrated over the hero band +
// dedication chip, sparse below the fold. Every value hand-varied —
// deterministic (no Math.random), no two fall paths alike.
const PETALS: readonly PetalSpec[] = [
  // NEAR layer — sharp, 13-23px, dense around the hero band + dedication chip.
  { left: "4%",  top: "6%",  delay: "0s",     dur: "15s", sway: "5.2s", amp: "14px", wob: "18deg", breeze: "4vw",    size: 20, rot: -24, tint: 0.85, layer: "near" },
  { left: "11%", top: "18%", delay: "-6s",    dur: "18s", sway: "6.4s", amp: "9px",  wob: "22deg", breeze: "2.5vw",  size: 15, rot: 40,  tint: 0.7,  layer: "near" },
  { left: "21%", top: "4%",  delay: "-2.5s",  dur: "16s", sway: "5.8s", amp: "17px", wob: "14deg", breeze: "5vw",    size: 23, rot: 12,  tint: 0.9,  layer: "near" },
  { left: "33%", top: "12%", delay: "-9s",    dur: "19s", sway: "7s",   amp: "11px", wob: "26deg", breeze: "3vw",    size: 14, rot: -60, tint: 0.65, layer: "near" },
  { left: "46%", top: "8%",  delay: "-4s",    dur: "17s", sway: "6s",   amp: "15px", wob: "16deg", breeze: "4.5vw",  size: 18, rot: 75,  tint: 0.8,  layer: "near" },
  { left: "58%", top: "20%", delay: "-12s",   dur: "18s", sway: "6.6s", amp: "12px", wob: "20deg", breeze: "3.5vw",  size: 17, rot: -48, tint: 0.75, layer: "near" },
  { left: "68%", top: "14%", delay: "-1s",    dur: "16s", sway: "5.5s", amp: "16px", wob: "24deg", breeze: "2vw",    size: 21, rot: -35, tint: 0.85, layer: "near" },
  { left: "84%", top: "5%",  delay: "-7.5s",  dur: "18s", sway: "6.8s", amp: "10px", wob: "15deg", breeze: "4vw",    size: 16, rot: 20,  tint: 0.75, layer: "near" },
  { left: "93%", top: "26%", delay: "-11s",   dur: "20s", sway: "7.4s", amp: "13px", wob: "19deg", breeze: "3vw",    size: 13, rot: 55,  tint: 0.6,  layer: "near" },
  { left: "15%", top: "44%", delay: "-15s",   dur: "21s", sway: "7.2s", amp: "14px", wob: "17deg", breeze: "5vw",    size: 14, rot: 66,  tint: 0.55, layer: "near" },
  // FAR layer — 9-12px, blur-[2px], low opacity; carries the hanami density
  // as depth, not noise.
  { left: "8%",  top: "34%", delay: "-3s",    dur: "22s", sway: "8s",   amp: "8px",  wob: "12deg", breeze: "6vw",    size: 12, rot: 30,  tint: 0.45, layer: "far" },
  { left: "18%", top: "9%",  delay: "-17s",   dur: "25s", sway: "8.8s", amp: "6px",  wob: "10deg", breeze: "4vw",    size: 9,  rot: -22, tint: 0.4,  layer: "far" },
  { left: "27%", top: "22%", delay: "-10s",   dur: "24s", sway: "8.6s", amp: "7px",  wob: "14deg", breeze: "5.5vw",  size: 10, rot: -50, tint: 0.4,  layer: "far" },
  { left: "36%", top: "3%",  delay: "-19s",   dur: "26s", sway: "9.2s", amp: "9px",  wob: "11deg", breeze: "3vw",    size: 11, rot: 42,  tint: 0.42, layer: "far" },
  { left: "41%", top: "30%", delay: "-5.5s",  dur: "23s", sway: "7.8s", amp: "8px",  wob: "13deg", breeze: "6.5vw",  size: 11, rot: 65,  tint: 0.42, layer: "far" },
  { left: "50%", top: "16%", delay: "-21s",   dur: "27s", sway: "9.6s", amp: "6px",  wob: "9deg",  breeze: "4.5vw",  size: 9,  rot: -38, tint: 0.36, layer: "far" },
  { left: "57%", top: "10%", delay: "-8s",    dur: "25s", sway: "9s",   amp: "7px",  wob: "12deg", breeze: "5vw",    size: 10, rot: -15, tint: 0.38, layer: "far" },
  { left: "64%", top: "28%", delay: "-16s",   dur: "24s", sway: "8.4s", amp: "9px",  wob: "15deg", breeze: "3.5vw",  size: 12, rot: 58,  tint: 0.44, layer: "far" },
  { left: "72%", top: "6%",  delay: "-23s",   dur: "26s", sway: "9.8s", amp: "6px",  wob: "10deg", breeze: "6vw",    size: 9,  rot: -64, tint: 0.35, layer: "far" },
  { left: "76%", top: "38%", delay: "-13s",   dur: "23s", sway: "8.2s", amp: "8px",  wob: "13deg", breeze: "4vw",    size: 12, rot: 48,  tint: 0.45, layer: "far" },
  { left: "81%", top: "18%", delay: "-20s",   dur: "27s", sway: "9.4s", amp: "7px",  wob: "11deg", breeze: "5.5vw",  size: 10, rot: 26,  tint: 0.38, layer: "far" },
  { left: "89%", top: "12%", delay: "-9.5s",  dur: "25s", sway: "8.9s", amp: "8px",  wob: "14deg", breeze: "3vw",    size: 11, rot: -44, tint: 0.4,  layer: "far" },
  { left: "96%", top: "40%", delay: "-18s",   dur: "26s", sway: "9.1s", amp: "6px",  wob: "9deg",  breeze: "4.5vw",  size: 9,  rot: 70,  tint: 0.34, layer: "far" },
  { left: "31%", top: "48%", delay: "-24s",   dur: "28s", sway: "10s",  amp: "7px",  wob: "12deg", breeze: "5vw",    size: 10, rot: -30, tint: 0.32, layer: "far" },
  { left: "53%", top: "56%", delay: "-14s",   dur: "26s", sway: "9.4s", amp: "8px",  wob: "10deg", breeze: "6vw",    size: 10, rot: -70, tint: 0.35, layer: "far" },
  { left: "70%", top: "60%", delay: "-22s",   dur: "28s", sway: "10.2s", amp: "6px", wob: "8deg",  breeze: "4vw",    size: 9,  rot: 36,  tint: 0.3,  layer: "far" },
  { left: "23%", top: "64%", delay: "-25s",   dur: "29s", sway: "10.6s", amp: "7px", wob: "11deg", breeze: "5.5vw",  size: 9,  rot: -18, tint: 0.3,  layer: "far" },
  { left: "88%", top: "52%", delay: "-12.5s", dur: "27s", sway: "9.7s", amp: "8px",  wob: "13deg", breeze: "3.5vw",  size: 10, rot: 52,  tint: 0.33, layer: "far" },
] as const;

/** A single cherry-blossom petal — a real notched-teardrop SVG silhouette. */
function Petal({ size, rot, tint }: { size: number; rot: number; tint: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 20 20"
      style={{ display: "block", opacity: tint, transform: `rotate(${rot}deg)` }}
    >
      <path
        d="M10 2.6 L8.7 0.8 C5.2 3.9 3.1 8.6 4.6 13 C5.7 16.3 8 18.5 10 19.2 C12 18.5 14.3 16.3 15.4 13 C16.9 8.6 14.8 3.9 11.3 0.8 L10 2.6 Z"
        fill="var(--color-foil-sakura)"
      />
    </svg>
  );
}

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
      {PETALS.map((p, i) => (
        <span
          key={i}
          className={`absolute motion-safe:animate-[sakura-fall_var(--dur)_linear_var(--delay)_infinite] ${
            p.layer === "far" ? "blur-[2px]" : ""
          }`}
          style={
            {
              left: p.left,
              // Static (reduced-motion): petals rest scattered across the hero.
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
