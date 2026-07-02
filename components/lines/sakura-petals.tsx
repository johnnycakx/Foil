// Sakura petal accent for the line-tracker hero (eve-line-tracker, ADR-095).
// The ONE signature flourish on the surface. Petals are deterministic (fixed
// positions/delays — no Math.random, which the harness bans and which would
// hydration-mismatch anyway). Motion lives entirely in the `motion-safe:`
// animate class, so prefers-reduced-motion users see static petals scattered
// in the hero, never a moving one.

const PETALS = [
  { left: "6%", delay: "0s", dur: "13s", size: 13, tint: 0.9 },
  { left: "18%", delay: "4s", dur: "16s", size: 9, tint: 0.7 },
  { left: "31%", delay: "8s", dur: "14s", size: 11, tint: 0.8 },
  { left: "47%", delay: "2s", dur: "18s", size: 8, tint: 0.6 },
  { left: "63%", delay: "6s", dur: "15s", size: 12, tint: 0.85 },
  { left: "76%", delay: "10s", dur: "17s", size: 10, tint: 0.7 },
  { left: "88%", delay: "1s", dur: "14s", size: 9, tint: 0.75 },
] as const;

/** A single cherry-blossom petal — a soft rounded lobe via border-radius. */
function Petal({ size, tint }: { size: number; tint: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "block",
        width: size,
        height: size * 0.82,
        background: "var(--color-foil-sakura)",
        opacity: tint,
        borderRadius: "70% 30% 62% 38% / 62% 40% 60% 38%",
      }}
    />
  );
}

export function SakuraPetals() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 motion-safe:animate-[sakura-fall_var(--dur)_linear_var(--delay)_infinite]"
          style={
            {
              left: p.left,
              // Static (reduced-motion): petals rest scattered down the hero.
              top: `${(i * 11) % 70}%`,
              "--dur": p.dur,
              "--delay": p.delay,
            } as React.CSSProperties
          }
        >
          <Petal size={p.size} tint={p.tint} />
        </span>
      ))}
    </div>
  );
}
