"use client";

// Sparkles — Aceternity-pattern accent, code-owned (see ADR-028).
// Renders N small twinkling dots over its container. CSS-only — no
// framer-motion. Each sparkle has a randomized starting offset + delay
// + duration so the cluster never reads as a regular grid.
//
// Best used behind/under a headline to add holographic shimmer without
// stealing focus. Pointer-events:none so it never interferes with click.

import { useMemo } from "react";

type Props = {
  /** Number of sparkles. Default 30. */
  count?: number;
  /** RGB color triplet (no rgb() wrapper). Default Foil primary. */
  color?: string;
  /** Container className passthrough. */
  className?: string;
  /** Sparkle size range in px. Default 1–3. */
  minSize?: number;
  maxSize?: number;
};

export function Sparkles({
  count = 30,
  color = "255, 107, 92", // #FF6B5C
  className,
  minSize = 1,
  maxSize = 3,
}: Props) {
  // Pre-compute random offsets so they're stable across rerenders within
  // the same client mount. Each sparkle is a div positioned absolutely.
  const sparkles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const seed = (i * 9301 + 49297) % 233280; // deterministic PRNG per index
      const rand = (n: number) => {
        const s = (seed * (n + 1)) % 233280;
        return s / 233280;
      };
      return {
        id: i,
        top: `${rand(1) * 100}%`,
        left: `${rand(2) * 100}%`,
        size: minSize + rand(3) * (maxSize - minSize),
        delay: rand(4) * 4,
        duration: 1.5 + rand(5) * 2,
      };
    });
  }, [count, minSize, maxSize]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: `rgb(${color})`,
            boxShadow: `0 0 ${s.size * 3}px rgba(${color}, 0.85)`,
            opacity: 0,
            animation: `foilSparkleTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes foilSparkleTwinkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0.4);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
