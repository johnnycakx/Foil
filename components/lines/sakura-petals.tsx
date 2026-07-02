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
  size: number;
  rot: number;
  tint: number;
  /** near = sharp foreground petal; far = smaller, blurred, quieter (depth). */
  layer: "near" | "far";
};

const PETALS: readonly PetalSpec[] = [
  // NEAR layer — sharp, 13-23px, dense around the hero band + dedication chip.
  { left: "4%", top: "6%", delay: "0s", dur: "15s", sway: "5.2s", size: 20, rot: -24, tint: 0.85, layer: "near" },
  { left: "11%", top: "18%", delay: "-6s", dur: "18s", sway: "6.4s", size: 15, rot: 40, tint: 0.7, layer: "near" },
  { left: "21%", top: "4%", delay: "-2.5s", dur: "16s", sway: "5.8s", size: 23, rot: 12, tint: 0.9, layer: "near" },
  { left: "33%", top: "12%", delay: "-9s", dur: "19s", sway: "7s", size: 14, rot: -60, tint: 0.65, layer: "near" },
  { left: "46%", top: "8%", delay: "-4s", dur: "17s", sway: "6s", size: 18, rot: 75, tint: 0.8, layer: "near" },
  { left: "68%", top: "14%", delay: "-1s", dur: "16s", sway: "5.5s", size: 21, rot: -35, tint: 0.85, layer: "near" },
  { left: "84%", top: "5%", delay: "-7.5s", dur: "18s", sway: "6.8s", size: 16, rot: 20, tint: 0.75, layer: "near" },
  { left: "93%", top: "26%", delay: "-11s", dur: "20s", sway: "7.4s", size: 13, rot: 55, tint: 0.6, layer: "near" },
  // FAR layer — 10-12px, blur-[2px], low opacity; reads as depth, not more noise.
  { left: "8%", top: "34%", delay: "-3s", dur: "22s", sway: "8s", size: 12, rot: 30, tint: 0.45, layer: "far" },
  { left: "27%", top: "22%", delay: "-10s", dur: "24s", sway: "8.6s", size: 10, rot: -50, tint: 0.4, layer: "far" },
  { left: "41%", top: "30%", delay: "-5.5s", dur: "23s", sway: "7.8s", size: 11, rot: 65, tint: 0.42, layer: "far" },
  { left: "57%", top: "10%", delay: "-8s", dur: "25s", sway: "9s", size: 10, rot: -15, tint: 0.38, layer: "far" },
  { left: "76%", top: "38%", delay: "-13s", dur: "23s", sway: "8.2s", size: 12, rot: 48, tint: 0.45, layer: "far" },
  { left: "63%", top: "52%", delay: "-14s", dur: "26s", sway: "9.4s", size: 10, rot: -70, tint: 0.35, layer: "far" },
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
            } as React.CSSProperties
          }
        >
          <span
            className="block motion-safe:animate-[sakura-sway_var(--sway)_ease-in-out_var(--delay)_infinite_alternate]"
            style={{ "--sway": p.sway } as React.CSSProperties}
          >
            <Petal size={p.size} rot={p.rot} tint={p.tint} />
          </span>
        </span>
      ))}
    </div>
  );
}
