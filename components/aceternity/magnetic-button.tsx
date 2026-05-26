"use client";

// Magnetic Button — Aceternity-pattern, code-owned (see ADR-028).
// CSS-only — the button shifts up to ~12px toward the pointer when the
// cursor is within ~80px, smoothing back to rest on pointer-leave.
//
// Best for primary CTAs where a small extra micro-interaction lifts
// engagement (per docs/STRATEGY-AUDIENCE-MOAT.md, "every gram of
// friction removed at the signup gate is worth disproportionately
// a lot" — this is the inverse: a small *positive* friction that
// rewards intent).

import React, { useRef } from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Maximum displacement in px. Default 12. */
  strength?: number;
  /** Radius (in px) within which the magnet engages. Default 80. */
  radius?: number;
};

export function MagneticButton({
  children,
  className,
  strength = 12,
  radius = 80,
  ...buttonProps
}: Props) {
  const ref = useRef<HTMLButtonElement | null>(null);

  const onMouseMove: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      el.style.transform = "translate(0, 0)";
      return;
    }
    const factor = strength / radius;
    el.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
  };

  const onMouseLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0, 0)";
  };

  return (
    <button
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`inline-flex items-center justify-center transition-transform duration-200 ease-out will-change-transform ${className ?? ""}`}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

/**
 * Same magnetic behavior on an <a> tag instead of a <button> — for
 * navigation CTAs where the link is the semantic primitive (SEO,
 * right-click open-in-new-tab, etc.).
 */
export function MagneticLink({
  children,
  className,
  strength = 12,
  radius = 80,
  href,
  ...anchorProps
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  strength?: number;
  radius?: number;
  href: string;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  const onMouseMove: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      el.style.transform = "translate(0, 0)";
      return;
    }
    const factor = strength / radius;
    el.style.transform = `translate(${dx * factor}px, ${dy * factor}px)`;
  };

  const onMouseLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate(0, 0)";
  };

  return (
    <a
      ref={ref}
      href={href}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={`inline-flex items-center justify-center transition-transform duration-200 ease-out will-change-transform ${className ?? ""}`}
      {...anchorProps}
    >
      {children}
    </a>
  );
}
