"use client";

// HoloCard — THE signature depth effect (fable-design-overhaul Tier 2,
// built in the overnight-design-loop). Pointer-tracked 3D tilt + a foil-sheen
// highlight that follows the cursor across the card art: the pokemon-cards-css
// technique (Simon Goellner's poke-holo approach) adapted in-house — layered
// gradients + a blend mode driven by --hx/--hy custom properties. The CSS
// lives in globals.css (.holo-card / .holo-sheen).
//
// Budget rules honored:
// - transform/opacity only, no per-frame layout reads (rect is read once per
//   pointerenter, not per move).
// - prefers-reduced-motion: listeners never attach → static card, no sheen.
// - touch: no tilt; :active plays the sheen once (tap-shimmer) via CSS.

import Image from "next/image";
import { useCallback, useRef } from "react";

export function HoloCard({
  src,
  alt,
  width = 400,
  height = 560,
  sizes,
  className = "",
  imgClassName = "",
  eager = false,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = useRef<DOMRect | null>(null);
  const frame = useRef(0);
  const motionOk = useRef<boolean | null>(null);

  const allowsMotion = () => {
    if (motionOk.current === null) {
      motionOk.current =
        typeof window !== "undefined" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return motionOk.current;
  };

  const onEnter = useCallback(() => {
    if (!allowsMotion()) return;
    rect.current = ref.current?.getBoundingClientRect() ?? null;
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!allowsMotion() || e.pointerType === "touch") return;
    const r = rect.current;
    const el = ref.current;
    if (!r || !el) return;
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--hx", x.toFixed(3));
      el.style.setProperty("--hy", y.toFixed(3));
    });
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--hx", "0.5");
    el.style.setProperty("--hy", "0.5");
  }, []);

  return (
    <div
      ref={ref}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`holo-card relative ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={`h-full w-full object-cover ${imgClassName}`}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
      />
      <span aria-hidden className="holo-sheen rounded-[inherit]" />
    </div>
  );
}
