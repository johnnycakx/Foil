"use client";

// The ONE first-open micro-moment (ADR-093): a ~300ms settle of the binder
// grid on the FIRST visit only (localStorage flag). Motion-safe — the
// animation class is gated behind Tailwind's `motion-safe:` variant, so
// prefers-reduced-motion users get a plain instant render. NO loading gate,
// no splash: the grid is server-rendered and visible immediately; the settle
// is a transform-only easing on top.

import { useEffect, useState, type ReactNode } from "react";

const SEEN_KEY = "foil-vault-opened";

export function VaultSettle({ children }: { children: ReactNode }) {
  const [settle, setSettle] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) {
        window.localStorage.setItem(SEEN_KEY, "1");
        setSettle(true);
        const t = setTimeout(() => setSettle(false), 400);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage unavailable → no moment; the page just renders */
    }
  }, []);

  return (
    <div
      className={
        settle
          ? "motion-safe:animate-[vault-settle_300ms_ease-out]"
          : undefined
      }
    >
      {children}
    </div>
  );
}
