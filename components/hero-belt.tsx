"use client";

// The hero chase belt (hero-chase-belt, ADR-102): a continuously drifting
// wheel of the top ~200 chase cards, each a real link to its market page.
// The statement: "everything you'd chase, we're already watching."
//
// Virtualization (the 200-card trick): NODE_COUNT fixed slots; faces recycle.
// A single virtual `offset` advances at DRIFT_PX_S; the track's transform
// carries only the fractional slot progress, and whenever a full slot wraps,
// the face mapping shifts by one (pool[(k + i) % pool.length]). The rendered
// scene is identical across the wrap instant — a face never visibly morphs;
// only the node re-entering off the right edge takes a new (already-mounted,
// hence preloaded) image. React reconciliation touches exactly that one node.
//
// Motion doctrine (emil-design-eng, traced in ITERATION-LOG iter-25):
//   - constant motion => LINEAR. No easing on the drift itself.
//   - pause is a DECELERATION, not a stop: hover/focus tweens a speed factor
//     to 0 over ~0.4s (power2.out); resume tweens back to 1. Nothing in the
//     real world halts instantly.
//   - transform-only, written straight to the track element by GSAP's ticker
//     (no per-frame CSS vars / React state — I-011).
//   - hover shine gated behind (hover:hover) and (pointer:fine) in CSS.
//
// Loop engine: GSAP core ticker + gsap.to on a speed proxy. The official
// `horizontalLoop` helper (GSAP docs, Helper Functions) informed the wrap
// arithmetic; this implementation is written independently against our
// windowed-recycling design. NO code from simeydotme/pokemon-cards-css
// (GPL-3.0) — the shine is an original two-layer gradient (ADR-102 notes
// provenance for both).
//
// Off-screen / hidden-tab: IntersectionObserver + visibilitychange both gate
// the drift entirely (speed target 0, ticker sleeps when idle).
//
// prefers-reduced-motion: this component renders motion-safe only (the
// server renders the static fan alongside, CSS-gated) AND belt motion also
// checks matchMedia before ever starting — belt markup without drift for
// safety if the CSS gate is bypassed.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { BeltCard } from "@/lib/hero-belt/pool";
// GSAP EXECUTION is device-gated in the effect below (mobile-static-hero): the
// ticker/animation only boots on desktop-motion, so phones never pay the ~1s
// GSAP boot / main-thread cost (the biggest slice of the mobile hero LCP per the
// prod LCP breakdown). GSAP is still statically imported so the desktop belt
// animation is rock-solid; the module is downloaded-but-idle on mobile.

// Uniform card box: the loop math depends on it (face width variance would
// break the wrap arithmetic). Art fills the 5/7 box.
export const NODE_COUNT = 26; // covers 2560px viewports + 2 spare slots
const CARD_W = 232; // px at lg; scaled down via CSS on small screens
const CARD_GAP = 28;
const SLOT_PX = CARD_W + CARD_GAP;
const DRIFT_PX_S = 48; // gallery walk, not a ticker (goal: 40-60)

export function HeroBelt({ pool }: { pool: BeltCard[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // k = how many whole slots have wrapped; faces derive from it.
  const [k, setK] = useState(0);

  const faces = useMemo(() => {
    if (pool.length === 0) return [];
    return Array.from({ length: NODE_COUNT }, (_, i) => pool[(k + i) % pool.length]);
  }, [pool, k]);

  useEffect(() => {
    const track = trackRef.current;
    const root = rootRef.current;
    if (!track || !root || pool.length === 0) return;
    // DEVICE-GATED MOTION (mobile-static-hero, ADR-102 amendment): the belt +
    // GSAP boot ONLY on desktop-motion. On mobile OR reduced-motion the static
    // fan is the hero (CSS-gated in page.tsx: the belt container is
    // `lg:motion-safe:block`), so GSAP is never needed here — and because it's
    // dynamically imported below (not module-scope), phones never download or
    // execute it. `lg` = 1024px, matching that CSS gate exactly so DOM + JS agree.
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let offset = 0;
    let wraps = 0;
    // The pause-is-deceleration proxy: hover/focus/offscreen tween this
    // toward 0; resume tweens back to 1. The drift itself stays linear.
    const speed = { v: 1 };
    let visible = true;
    let engaged = false; // hover or focus-within

    const speedTarget = () => (visible && !engaged && !document.hidden ? 1 : 0);
    const retune = () => {
      gsap.to(speed, { v: speedTarget(), duration: 0.45, ease: "power2.out", overwrite: true });
    };

    const tick = (_t: number, dt: number) => {
      if (speed.v <= 0.001) return;
      offset += (DRIFT_PX_S * speed.v * dt) / 1000;
      const newWraps = Math.floor(offset / SLOT_PX);
      if (newWraps !== wraps) {
        wraps = newWraps;
        setK(newWraps); // one node re-faces off-screen; the scene is unchanged
      }
      gsap.set(track, { x: -(offset % SLOT_PX) });
    };

    gsap.ticker.add(tick);

    const onEnter = () => { engaged = true; retune(); };
    const onLeave = () => { engaged = false; retune(); };
    root.addEventListener("mouseenter", onEnter);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("focusin", onEnter);
    root.addEventListener("focusout", onLeave);

    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      retune();
    });
    io.observe(root);
    const onVis = () => retune();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      gsap.ticker.remove(tick);
      root.removeEventListener("mouseenter", onEnter);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("focusin", onEnter);
      root.removeEventListener("focusout", onLeave);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [pool]);

  if (faces.length === 0) return null;

  return (
    <div
      ref={rootRef}
      className="group/belt relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]"
      aria-label="The chase wheel: cards Foil is watching right now"
    >
      <div ref={trackRef} className="flex w-max items-center will-change-transform" style={{ gap: CARD_GAP }}>
        {faces.map((card, i) => (
          <Link
            key={i}
            href={`/cards/${card.slug}`}
            aria-label={`${card.name}, ${card.setName} — sold prices and live listings`}
            className="belt-card group/card relative block shrink-0 overflow-hidden rounded-xl ring-1 ring-foil-cream/12 transition-shadow duration-200 focus-visible:ring-2 focus-visible:ring-foil-accent focus-visible:outline-none"
            style={{ width: CARD_W }}
          >
            {/* Uniform 5/7 box; explicit dimensions = zero CLS. The belt is now
                DESKTOP-ONLY (mobile-static-hero): it's `display:none` on mobile,
                where the static fan is the hero. So ALL belt faces are `lazy` —
                on mobile that means the hidden belt images never download (eager
                images load even under display:none, which was wasting ~170KB on
                the conversion-critical mobile path); on desktop the first faces
                are in the initial viewport, so `lazy` loads them promptly anyway.
                srcset still serves a 300px variant to low-DPR screens. */}
            <img
              src={card.img}
              srcSet={`${card.img.replace(/\.webp$/, "-sm.webp")} 300w, ${card.img} 480w`}
              sizes="232px"
              alt={card.name}
              width={480}
              height={672}
              loading="lazy"
              decoding="async"
              className="aspect-[5/7] w-full object-cover"
            />
            {/* Holo shine (independent implementation, ADR-102): a soft
                diagonal light band that sweeps on hover. Two layers — a warm
                sheen + a sakura tint — transform/opacity only. */}
            <span
              aria-hidden
              className="belt-shine pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
