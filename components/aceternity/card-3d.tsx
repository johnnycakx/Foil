"use client";

// 3D Card Effect — Aceternity-pattern, code-owned (see ADR-028).
// Pointer-tracked perspective tilt; CSS-only — no framer-motion.
//
// Usage:
//   <Card3D>
//     <Card3DBody>
//       <Card3DItem translateZ={50}>...children with depth...</Card3DItem>
//     </Card3DBody>
//   </Card3D>
//
// The body element receives the perspective transform on pointer-move;
// children with Card3DItem float forward via translateZ for a layered
// 3D feel. Reverts smoothly on pointer-leave.
//
// Niche-fit: Pokemon TCG buyers know the holographic-card hover feel
// from places like binder pages and Cardmarket — this wraps thumbnails
// with that same gesture, signaling "we know the category" without
// being kitsch about it.

import React, { createContext, useContext, useRef, useState } from "react";

const MouseEnterContext = createContext<{ entered: boolean } | undefined>(undefined);

export function Card3D({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const el = containerRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 25;
    const y = (e.clientY - top - height / 2) / 25;
    el.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
  };

  const onMouseEnter = () => setEntered(true);
  const onMouseLeave = () => {
    setEntered(false);
    const el = containerRef.current;
    if (el) el.style.transform = "rotateY(0deg) rotateX(0deg)";
  };

  return (
    <MouseEnterContext.Provider value={{ entered }}>
      <div
        className={`flex items-center justify-center [perspective:1000px] ${className ?? ""}`}
        style={{ transformStyle: "preserve-3d" }}
      >
        <div
          ref={containerRef}
          onMouseEnter={onMouseEnter}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          className="relative transition-transform duration-200 ease-linear [transform-style:preserve-3d]"
        >
          {children}
        </div>
      </div>
    </MouseEnterContext.Provider>
  );
}

export function Card3DBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`[transform-style:preserve-3d] ${className ?? ""}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

/** Lift children forward in 3D space on container hover. translateZ in
 *  px. Honors the parent Card3D's entered state for smooth in/out. */
export function Card3DItem({
  as: Component = "div",
  children,
  className,
  translateZ = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
}: {
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
  translateZ?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
}) {
  const ctx = useContext(MouseEnterContext);
  const entered = ctx?.entered ?? false;
  const transform = entered
    ? `translateZ(${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`
    : `translateZ(0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg)`;
  return (
    <Component
      className={`transition-transform duration-200 ease-linear ${className ?? ""}`}
      style={{ transform, transformStyle: "preserve-3d" }}
    >
      {children}
    </Component>
  );
}
