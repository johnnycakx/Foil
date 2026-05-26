"use client";

// Background gradient animation — Aceternity-pattern, code-owned MIT
// (see ADR-028, retuned per ADR-029).
//
// Session 39 retune: the previous full-page rainbow blob read as "indie
// SaaS template" against the new cream/navy/gold collector palette. The
// component now defaults to `variant="corner-shimmer"` — a restrained
// holographic glint pinned to the bottom-right corner — so the cards on
// the page become visual interest, not the background. The legacy
// `variant="full"` mode is kept for backwards-compat (no caller uses it
// today, but it's cheap to preserve and tests pin its shape).
//
// CSS-only — no framer-motion dependency.

import { useEffect, useRef } from "react";

type Variant = "corner-shimmer" | "full";

type Props = {
  /** Visual mode. Default `"corner-shimmer"` per ADR-029. */
  variant?: Variant;
  /** Override the gold/navy gradient stops. RGB triplets only. */
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  /** Solid container background under the blobs. Default cream. */
  containerBg?: string;
  className?: string;
  children?: React.ReactNode;
  /** Interactive blob that tracks the pointer. Default true (full mode only). */
  interactive?: boolean;
};

export function BackgroundGradientAnimation({
  variant = "corner-shimmer",
  firstColor = "201, 162, 75", // #C9A24B — Foil gold
  secondColor = "15, 30, 58", // #0F1E3A — Foil navy
  thirdColor = "201, 162, 75", // gold echo
  fourthColor = "15, 30, 58", // navy echo
  containerBg = "#F8F5F0",
  className,
  children,
  interactive = true,
}: Props) {
  const interactiveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!interactive || variant !== "full") return;
    const el = interactiveRef.current;
    if (!el) return;
    let curX = 0;
    let curY = 0;
    let tgX = 0;
    let tgY = 0;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect) return;
      tgX = e.clientX - rect.left;
      tgY = e.clientY - rect.top;
    };
    const tick = () => {
      curX = curX + (tgX - curX) / 20;
      curY = curY + (tgY - curY) / 20;
      el.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [interactive, variant]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
      style={{ background: containerBg }}
    >
      {/* SVG filter — gooey effect so the blobs merge instead of overlap. */}
      <svg className="hidden">
        <defs>
          <filter id="foil-blob-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {variant === "corner-shimmer" ? (
        // Restrained bottom-right glint. Two blobs, low opacity, anchored
        // to the corner — reads as "light catching a foil card" rather
        // than "rainbow gradient background."
        <div
          className="pointer-events-none absolute inset-0"
          style={{ filter: "url(#foil-blob-goo) blur(48px)" }}
        >
          <div
            className="absolute h-[28%] w-[28%] opacity-40"
            style={{
              background: `radial-gradient(circle at center, rgba(${firstColor}, 0.55) 0, rgba(${firstColor}, 0) 60%) no-repeat`,
              bottom: "-6%",
              right: "-6%",
              animation: "foilBlobOrbit 60s linear infinite",
            }}
          />
          <div
            className="absolute h-[22%] w-[22%] opacity-25"
            style={{
              background: `radial-gradient(circle at center, rgba(${secondColor}, 0.5) 0, rgba(${secondColor}, 0) 60%) no-repeat`,
              bottom: "4%",
              right: "10%",
              animation: "foilBlobHorizontal 50s ease-in-out infinite",
            }}
          />
        </div>
      ) : (
        // Legacy full mode (no caller uses today; preserved for back-compat).
        <div
          className="absolute inset-0"
          style={{ filter: "url(#foil-blob-goo) blur(40px)" }}
        >
          <div
            className="absolute h-[80%] w-[80%] [mix-blend-mode:hard-light] opacity-100"
            style={{
              background: `radial-gradient(circle at center, rgba(${firstColor}, 0.8) 0, rgba(${firstColor}, 0) 50%) no-repeat`,
              top: "calc(50% - 40%)",
              left: "calc(50% - 40%)",
              transformOrigin: "center center",
              animation: "foilBlobVertical 30s ease infinite",
            }}
          />
          <div
            className="absolute h-[80%] w-[80%] [mix-blend-mode:hard-light] opacity-100"
            style={{
              background: `radial-gradient(circle at center, rgba(${secondColor}, 0.65) 0, rgba(${secondColor}, 0) 50%) no-repeat`,
              top: "calc(50% - 40%)",
              left: "calc(50% - 40%)",
              transformOrigin: "calc(50% - 400px)",
              animation: "foilBlobOrbit 20s reverse infinite",
            }}
          />
          <div
            className="absolute h-[80%] w-[80%] [mix-blend-mode:hard-light] opacity-100"
            style={{
              background: `radial-gradient(circle at center, rgba(${thirdColor}, 0.65) 0, rgba(${thirdColor}, 0) 50%) no-repeat`,
              top: "calc(50% - 40% + 200px)",
              left: "calc(50% - 40% - 500px)",
              transformOrigin: "calc(50% + 400px)",
              animation: "foilBlobOrbit 40s linear infinite",
            }}
          />
          <div
            className="absolute h-[80%] w-[80%] [mix-blend-mode:hard-light] opacity-70"
            style={{
              background: `radial-gradient(circle at center, rgba(${fourthColor}, 0.65) 0, rgba(${fourthColor}, 0) 50%) no-repeat`,
              top: "calc(50% - 40%)",
              left: "calc(50% - 40%)",
              transformOrigin: "calc(50% - 200px)",
              animation: "foilBlobHorizontal 40s ease infinite",
            }}
          />
          {interactive && (
            <div
              ref={interactiveRef}
              className="absolute -top-1/2 -left-1/2 h-full w-full [mix-blend-mode:hard-light] opacity-70"
              style={{
                background: `radial-gradient(circle at center, rgba(${firstColor}, 0.8) 0, rgba(${firstColor}, 0) 50%) no-repeat`,
              }}
            />
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes foilBlobVertical {
          0% { transform: translateY(-50%); }
          50% { transform: translateY(50%); }
          100% { transform: translateY(-50%); }
        }
        @keyframes foilBlobHorizontal {
          0% { transform: translateX(-10%) translateY(-5%); }
          50% { transform: translateX(10%) translateY(5%); }
          100% { transform: translateX(-10%) translateY(-5%); }
        }
        @keyframes foilBlobOrbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
