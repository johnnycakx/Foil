"use client";

// THE BOOSTER PACK — the "don't know where to start?" path (cycle 2, beat 4).
//
// Not a suggestions button: a drag RIPS the foil wrapper (the most
// dopamine-encoded gesture in the hobby) and the pack deals a hand of today's
// genuinely most-chased cards. The surprise is WHICH chase cards are hot, and
// every one is real: the hand comes from the same sale-count-ranked deck the
// binder trusts, dealt ONCE at rip time so the pack never quietly refills.
//
// One pack per visit; it re-seals on reload (component state — cute, and it
// prevents rip-spam). Honest note in-world: "today's most-chased."
//
// Choreography (emil-design-eng): the drag maps 1:1 to the pointer with no
// transition (transitions fight the hand); a flick rips on velocity, not just
// distance; release below threshold snaps back fast (200ms ease-out, the
// asymmetric-timing rule); the dealt cards stagger in from scale(0.97) and
// never from scale(0). Keyboard opens the pack directly — keyboard actions
// don't get gesture theatre. Reduced motion strips movement, keeps fades.

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { dealPack, soldLine, type BinderCard } from "@/lib/start/binder";

/** Drag distance that completes the rip. */
const RIP_PX = 96;
/** A flick past this velocity (px/ms) rips even short of the distance. */
const RIP_VELOCITY = 0.11;

type Stage = "sealed" | "ripping" | "ripped";

export function BoosterPack({
  deck,
  filledIds,
  slotsLeft,
  onPick,
}: {
  deck: BinderCard[];
  filledIds: string[];
  slotsLeft: number;
  onPick: (card: BinderCard) => void;
}) {
  const [stage, setStage] = useState<Stage>("sealed");
  // The hand is dealt ONCE, at rip time. Seated cards leave it; nothing enters.
  const [hand, setHand] = useState<BinderCard[]>([]);
  const [dragX, setDragX] = useState(0);
  const [hint, setHint] = useState(false);

  const drag = useRef<{ id: number; startX: number; startedAt: number } | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // The strip flies, THEN the hand deals — one beat, not a cut.
  const rip = useCallback(() => {
    setHand(dealPack(deck, filledIds));
    setStage("ripping");
    window.setTimeout(() => setStage("ripped"), 260);
  }, [deck, filledIds]);

  // A pack too thin to deal a real hand stays off the desk entirely (an
  // honest absence beats a sad three-card rip).
  const sealable = dealPack(deck, filledIds);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (stage !== "sealed" || drag.current) return; // multi-touch protection, no re-rip
    drag.current = { id: e.pointerId, startX: e.clientX, startedAt: performance.now() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    const dx = e.clientX - drag.current.startX;
    // Rightward tear only; leftward gets friction, not a wall.
    setDragX(dx >= 0 ? Math.min(dx, RIP_PX * 1.25) : dx / 4);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current || e.pointerId !== drag.current.id) return;
    const dx = e.clientX - drag.current.startX;
    const elapsed = Math.max(1, performance.now() - drag.current.startedAt);
    const velocity = Math.abs(dx) / elapsed;
    drag.current = null;
    if (dx >= RIP_PX * 0.7 || (dx > 20 && velocity > RIP_VELOCITY)) {
      rip();
      return;
    }
    setDragX(0); // snap back, fast (the release is always snappy)
    if (Math.abs(dx) < 6) {
      // A tap isn't a rip. Whisper the gesture instead of stealing it.
      setHint(true);
      window.setTimeout(() => setHint(false), 2200);
    }
  };

  /** Keyboard path: open directly. No gesture theatre on keyboard actions. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      rip();
    }
  };

  if (stage !== "ripped") {
    if (stage === "sealed" && sealable.length === 0) return null;
    return (
      <div className="pack-area">
        <button
          type="button"
          className={`pack${stage === "ripping" ? " pack-ripping" : ""}`}
          style={dragX !== 0 ? { ["--tear" as string]: `${dragX}px` } : undefined}
          data-tearing={drag.current ? "true" : "false"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setDragX(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="FOIL today's pack. Drag the tab to rip it open, or press Enter."
        >
          {/* The tear affordance must be legible AT REST (cycle-3 A1): a
              lighter strip, a perforation line, and a pull-tab that says
              "grab here" without the aria-label. One glint pass on load is
              the single cue; reduced motion gets the static tab. */}
          <span aria-hidden className="pack-strip">
            <span className="pack-tab">
              <span className="pack-tab-arrow">≫</span>
            </span>
            <span className="pack-glint" />
            <span className="pack-notch" />
          </span>
          <span aria-hidden className="pack-perforation" />
          <span aria-hidden className="pack-body">
            <span className="pack-sheen" />
            <span className="pack-wordmark">FOIL</span>
            <span className="pack-sub">today&apos;s pack</span>
          </span>
        </button>
        {/* The pack's own caption (cycle-3 A6): a label, not a floating
            whisper — it points at the object it belongs to. */}
        <p className="pack-caption">
          Not sure where to start? Foil packed today&apos;s most-chased.
        </p>
        <p className={`pack-hint ${hint ? "pack-hint-on" : ""}`} aria-hidden>
          hold the tab and pull →
        </p>
      </div>
    );
  }

  const dealt = hand.filter((c) => !filledIds.includes(c.id));

  return (
    <div className="pack-area pack-area-open">
      <p className="pack-caption">
        {dealt.length > 0
          ? "Fresh from the wrapper. Tap one to sleeve it."
          : "The whole hand is in your binder."}
      </p>
      {dealt.length > 0 && (
        <ul className="pack-hand">
          {dealt.map((card, i) => (
            <li key={card.id} className="pack-card" style={{ ["--i" as string]: String(i) }}>
              <button
                type="button"
                className="pack-card-btn"
                disabled={slotsLeft <= 0}
                onClick={() => onPick(card)}
                aria-label={`Sleeve ${card.name}, ${card.setName}. ${soldLine(card)}`}
              >
                <Image
                  src={card.image}
                  alt=""
                  width={245}
                  height={342}
                  sizes="76px"
                  className="pack-card-art"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="pack-note">
        Today&apos;s most-chased. Ranked by real sales, not by what Foil wants to sell you.
      </p>
    </div>
  );
}
