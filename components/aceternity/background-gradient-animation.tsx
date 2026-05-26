"use client";

// Background gradient animation — Aceternity-pattern, code-owned MIT
// (see ADR-028). Renders four blurred color "blobs" that drift across
// the container on slow CSS keyframe loops, plus a noise overlay for
// texture. CSS-only — no framer-motion dependency.
//
// Tuned to Foil's brand: `#FF6B5C` accent + `#0B1428` deep navy + a hint
// of holographic iridescence via teal/violet secondary blobs. The result
// reads as "holographic foil card under a light" — which is the niche
// signal the strategy doc wants us to land.

import { useEffect, useRef } from "react";

type Props = {
  /** Override the dominant gradient stops. Defaults pick Foil brand. */
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  /** Solid container background under the blobs. */
  containerBg?: string;
  className?: string;
  children?: React.ReactNode;
  /** Interactive blob that tracks the pointer. Default true. */
  interactive?: boolean;
};

export function BackgroundGradientAnimation({
  firstColor = "255, 107, 92", // #FF6B5C — Foil primary
  secondColor = "100, 220, 200", // teal — holo highlight
  thirdColor = "180, 130, 255", // violet — holo secondary
  fourthColor = "255, 200, 120", // amber — warm accent
  containerBg = "#0B1428",
  className,
  children,
  interactive = true,
}: Props) {
  const interactiveRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!interactive) return;
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
  }, [interactive]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
      style={{ background: containerBg }}
    >
      {/* SVG filter — gooey effect for the blobs to merge instead of overlap. */}
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
      <div
        className="absolute inset-0"
        style={{
          filter: "url(#foil-blob-goo) blur(40px)",
        }}
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

      <style jsx>{`
        @keyframes foilBlobVertical {
          0% {
            transform: translateY(-50%);
          }
          50% {
            transform: translateY(50%);
          }
          100% {
            transform: translateY(-50%);
          }
        }
        @keyframes foilBlobHorizontal {
          0% {
            transform: translateX(-50%) translateY(-10%);
          }
          50% {
            transform: translateX(50%) translateY(10%);
          }
          100% {
            transform: translateX(-50%) translateY(-10%);
          }
        }
        @keyframes foilBlobOrbit {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
