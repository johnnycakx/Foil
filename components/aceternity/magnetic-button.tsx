"use client";

// Magnetic Button — Aceternity-pattern, code-owned (see ADR-028, retuned
// per ADR-029).
//
// CSS-only — the button shifts up to ~12px toward the pointer when the
// cursor is within ~80px, smoothing back to rest on pointer-leave. The
// magnetic motion IS the engagement-lift; on top of it Session 39 adds
// a gold hover-ring + shadow expansion via Tailwind `hover:` so the
// affordance reads as "premium / foil" rather than "generic SaaS CTA."
//
// Best for primary CTAs where a small extra micro-interaction lifts
// engagement (per docs/STRATEGY-AUDIENCE-MOAT.md, "every gram of
// friction removed at the signup gate is worth disproportionately
// a lot" — this is the inverse: a small *positive* friction that
// rewards intent).

import React, { useRef } from "react";

// Class set applied to both Button + Link siblings. Caller still controls
// bg/text/padding/rounded via the `className` prop; these defaults are
// purely additive (shadow + ring + transition).
const MAGNETIC_DEFAULTS =
  "inline-flex items-center justify-center shadow-md shadow-foil-navy/15 transition-all duration-200 ease-out will-change-transform hover:shadow-lg hover:shadow-foil-navy/25 hover:ring-2 hover:ring-foil-gold/40";

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
    // Reduced-motion: leave the button at rest (ADR-029 / WCAG-AA).
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
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
    // Subtract a small constant lift on the Y axis so the button rises
    // a touch in addition to leaning toward the pointer (ADR-029).
    el.style.transform = `translate(${dx * factor}px, ${dy * factor - 2}px)`;
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
      className={`${MAGNETIC_DEFAULTS} ${className ?? ""}`}
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
    // Reduced-motion: leave the link at rest (ADR-029 / WCAG-AA).
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
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
    el.style.transform = `translate(${dx * factor}px, ${dy * factor - 2}px)`;
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
      className={`${MAGNETIC_DEFAULTS} ${className ?? ""}`}
      {...anchorProps}
    >
      {children}
    </a>
  );
}
