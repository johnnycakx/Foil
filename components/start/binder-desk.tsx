"use client";

// THE DESK — /start as a place, not a form (start-binder-delight, 2026-07-12).
//
// The scene: a kid's desk under a warm lamp, a nine-pocket binder page open on
// it, and a sealed booster pack within reach. Filling a pocket IS adding a
// watch. The taste anchor is baothiento.com (walked live, 2026-07-12); the
// PRINCIPLES borrowed, never the assets:
//
//   · dormant → wakes on attention (his pond saturates; our desk lamp warms)
//   · autonomous life on a four-beat loop: idle → notice → react → settle,
//     settling to a NEW arrangement rather than snapping back (his ants scatter
//     from the glass and regroup somewhere else — that's what reads as alive)
//   · the cursor becomes a real tool doing real work (his magnifier magnifies;
//     our cursor CARRIES the card to the pocket, with paper tilt + inertia)
//   · inputs are demoted and in-world ("say something to the ants…" →
//     "know the exact card? type it")
//   · delight is QUIET — no bursts, no confetti, no sound
//
// The idle behavior we own that nobody else can: seated cards catch a SHIMMER
// pass, exactly like real holos in a real binder when the light moves. We are
// literally named Foil.
//
// Honesty rules that outrank the scene: every card is real, every figure is a
// real sold average with its sale count (or an honest absence), the free cap is
// furniture (visible Pro sleeves) and never a trap, and nothing here is a dark
// pattern — no streaks, no timers, no fake scarcity.

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FREE_POCKETS,
  POCKETS_PER_PAGE,
  freeSlotsLeft,
  layoutPockets,
  soldLine,
  suggestNeighbor,
  suggestionLine,
  tagLine,
  type BinderCard,
  type Suggestion,
} from "@/lib/start/binder";
import { CardTypeahead, type CardSearchHit } from "@/components/cards/card-typeahead";

type Submission =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "done"; count: number; vaultUrl: string | null; vaultLinkEmailed: boolean }
  | { state: "error"; message: string; code?: string };

export function BinderDesk({
  deck,
  cataloguedIds,
  signedInEmail,
  isPro,
}: {
  deck: BinderCard[];
  cataloguedIds: string[];
  /** Signed-in visitors never retype their address (stranger-run defect). */
  signedInEmail: string | null;
  isPro: boolean;
}) {
  const [filled, setFilled] = useState<BinderCard[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [email, setEmail] = useState(signedInEmail ?? "");
  const [optIn, setOptIn] = useState(true);
  const [website, setWebsite] = useState(""); // honeypot
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });

  // The fan: an open sleeve is "picking" — real card art fanned in your hand.
  const [fanOpen, setFanOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<{ s: Suggestion; after: BinderCard } | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [seating, setSeating] = useState<string | null>(null);
  const [awake, setAwake] = useState(false);
  const [typedOpen, setTypedOpen] = useState(false);

  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setUtm({
      source: p.get("utm_source") ?? p.get("src") ?? "",
      medium: p.get("utm_medium") ?? "",
      campaign: p.get("utm_campaign") ?? "",
    });
  }, []);

  const filledIds = useMemo(() => filled.map((c) => c.id), [filled]);
  const pockets = useMemo(() => layoutPockets(filled, targets), [filled, targets]);
  const capacity = isPro ? POCKETS_PER_PAGE : FREE_POCKETS;
  const slotsLeft = isPro ? POCKETS_PER_PAGE - filled.length : freeSlotsLeft(filled.length);

  /** The hand you can pick from — real cards, minus what's already seated.
   *  Nine: one binder page's worth, and the most a hand can fan without the
   *  arc collapsing into a stack. */
  const hand = useMemo(
    () => deck.filter((c) => !filledIds.includes(c.id)).slice(0, 9),
    [deck, filledIds],
  );

  // The fan must land IN VIEW next to the binder — on first render it opened
  // below the fold, which severed it from the page it belongs to.
  const fanRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!fanOpen) return;
    fanRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [fanOpen]);

  const seat = useCallback(
    (card: BinderCard) => {
      if (filled.length >= capacity) return;
      setAwake(true);
      setFanOpen(false);
      setFilled((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
      setSeating(card.id);
      window.setTimeout(() => setSeating(null), 700);
      // The one-more loop: ONE quiet neighbor, never a feed.
      const next = suggestNeighbor(card, deck, [...filledIds, card.id, ...dismissed]);
      setSuggestion(next ? { s: next, after: card } : null);
    },
    [filled.length, capacity, deck, filledIds, dismissed],
  );

  const unseat = (id: string) => {
    setFilled((prev) => prev.filter((c) => c.id !== id));
    setSuggestion(null);
  };

  const setTarget = (id: string, value: string) =>
    setTargets((prev) => ({ ...prev, [id]: value }));

  /** The typed fallback resolves through the same catalog the fan uses. */
  const seatFromSearch = (hit: CardSearchHit) => {
    const known = deck.find((c) => c.id === hit.id);
    seat(
      known ?? {
        id: hit.id,
        slug: "",
        name: hit.name,
        setName: hit.setName,
        // The typeahead carries the full identity; /api/start requires it.
        setId: hit.setId,
        number: hit.number,
        image: hit.image,
        soldCents: null,
        saleCount: 0,
      },
    );
    setTypedOpen(false);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submission.state === "submitting") return;
    if (filled.length === 0) {
      setSubmission({ state: "error", message: "Put at least one card in a sleeve first." });
      return;
    }
    if (!email.trim()) {
      setSubmission({ state: "error", message: "Foil needs somewhere to write you." });
      return;
    }
    setSubmission({ state: "submitting" });
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          opt_in_newsletter: optIn,
          cards: filled.map((c) => {
            const raw = (targets[c.id] ?? "").trim();
            const n = parseFloat(raw);
            return {
              pokemon_tcg_id: c.id,
              name: c.name,
              set_name: c.setName,
              set_id: c.setId,
              number: c.number,
              target_price_cents: raw && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null,
            };
          }),
          src: utm.source || undefined,
          utm:
            utm.source || utm.medium || utm.campaign
              ? { source: utm.source || null, medium: utm.medium || null, campaign: utm.campaign || null }
              : undefined,
          website: website || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        count?: number;
        vault_url?: string;
        vault_link_emailed?: boolean;
      };
      if (!res.ok || !body.ok) {
        setSubmission({
          state: "error",
          code: body.error,
          message:
            body.error === "watch_limit_free"
              ? "Free fills 3 sleeves, and yours are full. Pro fills the whole page and checks hourly."
              : "Something broke. Try again, or email john.c.craig24@gmail.com.",
        });
        return;
      }
      setSubmission({
        state: "done",
        count: body.count ?? filled.length,
        vaultUrl: body.vault_url ?? null,
        // An EXISTING vault is never echoed back inline (that was a HIGH
        // finding — knowing an email would have meant reading its watchlist).
        // It goes to the inbox instead, and the success state must say so
        // rather than going quiet.
        vaultLinkEmailed: body.vault_link_emailed === true,
      });
    } catch {
      setSubmission({ state: "error", message: "Network hiccup. Try again." });
    }
  }

  if (submission.state === "done") {
    return (
      <section className="desk-scene rounded-3xl border border-foil-cream/12 bg-foil-night-2 p-8 text-center sm:p-10">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-accent">
          Foil is watching {submission.count} {submission.count === 1 ? "card" : "cards"} for you
        </p>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-[-0.02em] text-foil-cream sm:text-3xl">
          The binder is yours. Foil takes the watching.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base text-foil-cream/70">
          {isPro
            ? "Foil checks your cards every hour. The first time one drops to a price worth buying, the email lands."
            : "Foil checks your cards once a day. The first time one drops to a price worth buying, the email lands."}{" "}
          <span className="text-foil-cream/60">
            Add <code className="rounded bg-foil-cream/10 px-1.5 py-0.5 text-sm">alerts@foiltcg.com</code> to your
            contacts so Gmail doesn&apos;t hide it.
          </span>
        </p>
        {submission.vaultUrl ? (
          <a
            href={submission.vaultUrl}
            className="mt-6 inline-block rounded-xl bg-foil-cream px-6 py-3 text-base font-semibold text-foil-navy transition hover:ring-2 hover:ring-foil-accent/60"
          >
            Open your vault →
          </a>
        ) : submission.vaultLinkEmailed ? (
          <p className="mt-6 text-sm text-foil-cream/70">
            Your private vault link is in your inbox. It&apos;s the one page with everything you track.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      onMouseEnter={() => setAwake(true)}
      onFocus={() => setAwake(true)}
      data-awake={awake ? "true" : "false"}
      className="desk-scene relative"
    >
      {/* THE DESK — lamp light, warm and dormant until you lean in. */}
      <div aria-hidden className="desk-lamp" />

      {/* Honeypot. */}
      <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {/* THE BINDER — a nine-pocket page. Filling a pocket is adding a watch. */}
      <div className="binder relative rounded-2xl border border-foil-cream/12 bg-foil-night-2/70 p-4 sm:p-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <p className="font-display text-base font-bold text-foil-cream">Your binder page</p>
          <p className="text-xs text-foil-cream/55">
            {slotsLeft > 0
              ? `${slotsLeft} ${slotsLeft === 1 ? "sleeve" : "sleeves"} open`
              : isPro
                ? "page full"
                : "page full on free"}
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          {pockets.map((pocket, i) => {
            if (pocket.kind === "filled") {
              const card = pocket.card;
              const isSeating = seating === card.id;
              return (
                <li key={card.id} className="pocket pocket-filled">
                  <div className={`sleeve ${isSeating ? "sleeve-seating" : ""}`}>
                    <Image
                      src={card.image}
                      alt={`${card.name} (${card.setName})`}
                      width={245}
                      height={342}
                      unoptimized
                      className="sleeve-card"
                    />
                    {/* The shimmer — a real holo catching the lamp. Ours alone. */}
                    <span aria-hidden className="sleeve-shimmer" />
                    <button
                      type="button"
                      onClick={() => unseat(card.id)}
                      aria-label={`Take ${card.name} out of the binder`}
                      className="sleeve-remove"
                    >
                      ×
                    </button>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-medium text-foil-cream" title={card.name}>
                    {card.name}
                  </p>
                  <p className="truncate text-[10px] text-foil-cream/55">{soldLine(card)}</p>

                  {/* THE PRICE TAG — pencil on paper, tied to the card. */}
                  <label className="tag mt-1.5">
                    <span className="sr-only">Target price for {card.name}</span>
                    <span aria-hidden className="tag-string" />
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      step={1}
                      placeholder="any good price"
                      value={pocket.targetUsd}
                      onChange={(e) => setTarget(card.id, e.target.value)}
                      className="tag-input"
                    />
                  </label>
                  {pocket.targetUsd.trim() && (
                    <p className="tag-read" aria-hidden>
                      {tagLine(pocket.targetUsd)}
                    </p>
                  )}
                </li>
              );
            }

            if (pocket.kind === "locked") {
              return (
                <li key={`locked-${i}`} className="pocket">
                  {/* The free cap as FURNITURE — visible, honest, inviting.
                      Never an error, never a modal. */}
                  <a href="/pro" className="sleeve sleeve-locked" aria-label="Pro fills the rest of the page">
                    <span className="sleeve-locked-mark" aria-hidden>
                      ✦
                    </span>
                    <span className="sleeve-locked-copy">Pro sleeve</span>
                  </a>
                </li>
              );
            }

            return (
              <li key={`empty-${i}`} className="pocket">
                <button
                  type="button"
                  onClick={() => {
                    setAwake(true);
                    setFanOpen(true);
                  }}
                  className="sleeve sleeve-empty"
                  aria-label="Fill this sleeve with a card you're chasing"
                >
                  <span className="sleeve-empty-copy">
                    {filled.length === 0 && i === 0 ? "Start here" : "Empty"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* The one-more loop: ONE quiet neighbor, dismissible, never a feed. */}
        {suggestion && slotsLeft > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-foil-accent/25 bg-foil-accent/[0.06] px-3 py-2">
            <Image
              src={suggestion.s.card.image}
              alt=""
              width={40}
              height={56}
              unoptimized
              className="h-12 w-9 rounded object-cover ring-1 ring-foil-cream/10"
            />
            <p className="min-w-0 flex-1 text-xs text-foil-cream/75">
              <span className="font-medium text-foil-cream">{suggestion.s.card.name}</span>{" "}
              {suggestionLine(suggestion.s, suggestion.after)}
            </p>
            <button
              type="button"
              onClick={() => seat(suggestion.s.card)}
              className="rounded-lg border border-foil-cream/20 px-2.5 py-1 text-xs font-medium text-foil-cream transition hover:border-foil-accent/60"
            >
              Sleeve it
            </button>
            <button
              type="button"
              onClick={() => {
                setDismissed((p) => [...p, suggestion.s.card.id]);
                setSuggestion(null);
              }}
              aria-label="Not this one"
              className="text-xs text-foil-cream/45 transition hover:text-foil-cream"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* THE FAN — real card art fanned in your hand. Not a dropdown. */}
      {fanOpen && (
        <div ref={fanRef} className="fan-wrap" role="dialog" aria-label="Pick a card">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-sm font-medium text-foil-cream">Which one are you chasing?</p>
            <button
              type="button"
              onClick={() => setFanOpen(false)}
              className="text-xs text-foil-cream/50 transition hover:text-foil-cream"
            >
              close
            </button>
          </div>
          <ul className="fan">
            {hand.map((card, i) => (
              <li key={card.id} className="fan-card" style={{ ["--i" as string]: String(i) }}>
                <button
                  type="button"
                  onClick={() => seat(card)}
                  className="fan-btn"
                  aria-label={`${card.name}, ${card.setName}. ${soldLine(card)}`}
                >
                  <Image
                    src={card.image}
                    alt=""
                    width={245}
                    height={342}
                    unoptimized
                    className="fan-art"
                  />
                  <span className="fan-meta">
                    <span className="fan-name">{card.name}</span>
                    <span className="fan-sold">{soldLine(card)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-[11px] text-foil-cream/45">
            These are the cards trading most right now. Real sold prices, not asking prices.
          </p>
        </div>
      )}

      {/* The typed path — DEMOTED to a whisper, kept for power users + a11y. */}
      <div className="mt-4 text-center">
        {typedOpen ? (
          <div className="mx-auto max-w-md rounded-xl border border-foil-cream/12 bg-foil-night-2/70 p-4 text-left [&_label>span]:text-foil-cream [&_li:only-child]:text-foil-cream/60">
            <CardTypeahead
              cataloguedIds={cataloguedIds}
              pickedIds={filledIds}
              onPick={seatFromSearch}
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setTypedOpen(true)}
            className="text-xs text-foil-cream/50 underline decoration-foil-cream/25 underline-offset-4 transition hover:text-foil-cream"
          >
            know the exact card? type it
          </button>
        )}
      </div>

      {/* THE STICKY NOTE — where should Foil write you? */}
      <div className="sticky-note mt-8">
        <label className="block">
          <span className="note-label">Where should Foil write you?</span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={Boolean(signedInEmail)}
            className="note-input"
          />
        </label>
        {signedInEmail ? (
          <p className="note-sub">Signed in. Foil writes here.</p>
        ) : (
          <label className="note-check">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
            <span>Also send the weekly digest (one email a week, unsubscribe anytime)</span>
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={submission.state === "submitting" || filled.length === 0}
        className="mt-6 w-full rounded-xl bg-foil-cream px-6 py-4 text-base font-semibold text-foil-navy transition hover:ring-2 hover:ring-foil-accent/60 disabled:opacity-50"
      >
        {submission.state === "submitting"
          ? "Setting up…"
          : filled.length === 0
            ? "Fill a sleeve to start"
            : `Foil watches ${filled.length} ${filled.length === 1 ? "card" : "cards"} →`}
      </button>

      {submission.state === "error" && (
        <p role="alert" className="mt-3 text-center text-sm text-foil-coral">
          {submission.message}
          {submission.code === "watch_limit_free" && (
            <>
              {" "}
              <a href="/pro" className="font-semibold text-foil-cream underline underline-offset-2">
                Start your 30-day free trial →
              </a>
            </>
          )}
        </p>
      )}
    </form>
  );
}
