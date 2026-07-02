"use client";

// /start onboarding form — Client component (Task #20 / Session 38).
//
// Debounced card-name search (300ms) → top 8 results from the Pokemon TCG
// SDK via /api/cards/search → user selects multiple → optional per-card
// target price → email + newsletter opt-in → POST /api/start.
//
// Only cards in CARD_CATALOG (server-provided `cataloguedIds`) are
// selectable for watchlist. Non-catalogued hits show a "Not yet tracked"
// badge — the user is still encouraged to subscribe to the newsletter so
// they hear about additions.

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CardTypeahead, type CardSearchHit } from "@/components/cards/card-typeahead";

type SearchHit = CardSearchHit;

type Selected = SearchHit & {
  targetPriceUsd: string; // user-input dollars, empty = "any drop"
};

type Submission =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; count: number; vaultUrl: string | null; vaultLinkEmailed: boolean }
  | { state: "error"; message: string };

const MAX_SELECTED = 50;

// One-tap example chase cards for the empty state (fable-design-overhaul §2):
// three community grails a cold visitor recognizes on sight. Images are the
// self-hosted hero webps (ADR-056); each chip only renders if the card is
// actually in the catalog (no dead adds).
const CHASE_EXAMPLES: SearchHit[] = [
  {
    id: "swsh7-215",
    name: "Umbreon VMAX (Moonbreon)",
    setName: "Evolving Skies",
    setId: "swsh7",
    number: "215",
    image: "/hero/swsh7-215.webp",
  },
  {
    id: "base1-4",
    name: "Charizard",
    setName: "Base Set",
    setId: "base1",
    number: "4",
    image: "/hero/base1-4.webp",
  },
  {
    id: "swsh11-186",
    name: "Giratina V (alt art)",
    setName: "Lost Origin",
    setId: "swsh11",
    number: "186",
    image: "/hero/swsh11-186.webp",
  },
];

export function StartPageForm({ cataloguedIds }: { cataloguedIds: string[] }) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [email, setEmail] = useState("");
  const [optInNewsletter, setOptInNewsletter] = useState(true);
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });
  // Honeypot — humans never see or fill this (rendered off-screen below).
  const [website, setWebsite] = useState("");

  // Inbound channel attribution (ADR-084/ADR-090 — same pattern as
  // EmailCapture). Read the landing URL's utm_* (or a single ?src= alias)
  // after hydration; POSTed with the form so the route persists src on every
  // watchlists row + utm on the subscriber record. Client-side
  // window.location — no useSearchParams, to avoid a Suspense boundary.
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

  const selectedIds = useMemo(() => selected.map((s) => s.id), [selected]);

  function addCard(hit: SearchHit) {
    if (selected.length >= MAX_SELECTED) return;
    setSelected((prev) =>
      prev.some((s) => s.id === hit.id) ? prev : [...prev, { ...hit, targetPriceUsd: "" }],
    );
  }

  function removeCard(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  function updateTarget(id: string, value: string) {
    setSelected((prev) =>
      prev.map((s) => (s.id === id ? { ...s, targetPriceUsd: value } : s)),
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submission.state === "submitting") return;
    if (selected.length === 0) {
      setSubmission({ state: "error", message: "Pick at least one card to track." });
      return;
    }
    if (!email.trim()) {
      setSubmission({ state: "error", message: "Email is required." });
      return;
    }
    setSubmission({ state: "submitting" });
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          opt_in_newsletter: optInNewsletter,
          cards: selected.map((s) => ({
            pokemon_tcg_id: s.id,
            name: s.name,
            set_name: s.setName,
            set_id: s.setId,
            number: s.number,
            target_price_cents:
              s.targetPriceUsd.trim() === ""
                ? null
                : Math.round(parseFloat(s.targetPriceUsd) * 100),
          })),
          // Attribution (ADR-084/ADR-090): src lands on every watchlists row;
          // utm on the subscriber record. Empty strings → undefined so the
          // payload stays clean when there's no inbound tag.
          src: utm.source || undefined,
          utm:
            utm.source || utm.medium || utm.campaign
              ? {
                  source: utm.source || null,
                  medium: utm.medium || null,
                  campaign: utm.campaign || null,
                }
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
          message: body.error === "invalid_payload" ? "Form data didn't validate. Try again." : "Something broke. Try again, or email john.c.craig24@gmail.com.",
        });
        return;
      }
      setSubmission({
        state: "success",
        count: body.count ?? selected.length,
        vaultUrl: body.vault_url ?? null,
        vaultLinkEmailed: body.vault_link_emailed ?? false,
      });
    } catch {
      setSubmission({
        state: "error",
        message: "Network hiccup. Try again.",
      });
    }
  }

  if (submission.state === "success") {
    return (
      <section className="rounded-3xl border border-foil-vermillion/40 bg-foil-cream p-8 shadow-xl shadow-foil-navy/10 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-vermillion">
          You&apos;re tracking {submission.count} cards
        </p>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-[-0.02em] text-foil-navy sm:text-3xl">
          We&apos;ve got it from here.
        </h2>
        <p className="mt-4 text-base text-foil-slate">
          Foil checks eBay every hour. The first time one of your cards drops to a price worth buying, the email lands. <span className="text-foil-slate/80">Add <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 text-sm text-foil-navy">alerts@foiltcg.com</code> to your contacts so Gmail doesn&apos;t hide it.</span>
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {submission.vaultUrl ? (
            <a
              href={submission.vaultUrl}
              className="inline-flex items-center justify-center rounded-xl bg-foil-navy px-5 py-2.5 text-sm font-semibold text-foil-cream transition hover:bg-foil-vermillion"
            >
              Open your vault →
            </a>
          ) : (
            <a
              href="/cards"
              className="inline-flex items-center justify-center rounded-xl bg-foil-navy px-5 py-2.5 text-sm font-semibold text-foil-cream transition hover:bg-foil-vermillion"
            >
              Browse the catalog →
            </a>
          )}
          {/* Retention hook (fable-design-overhaul §2): watch your inbox —
              meanwhile, this week's best drops. */}
          <a
            href="/deals?src=start-success"
            className="text-sm text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-vermillion"
          >
            Meanwhile, see this week&apos;s best drops →
          </a>
        </div>
        {submission.vaultUrl && (
          <p className="mt-3 text-xs text-foil-slate">
            Your vault is the private page with everything you track — the link is also in
            your welcome email. Keep it handy.
          </p>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8">
      {/* Honeypot (ADR-090) — off-screen, never announced, never tabbable.
          Humans can't reach it; naive bots fill every field. The route
          fake-succeeds when it's non-empty. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {/* SEARCH — the shared type-ahead (ADR-093; extracted so the vault's
          add-in-place uses the same component, never a fork). */}
      <CardTypeahead
        cataloguedIds={cataloguedIds}
        pickedIds={selectedIds}
        onPick={addCard}
        autoFocus
      />

      {/* EMPTY STATE — one-tap chase-card chips so a cold visitor never faces
          a blank form (fable-design-overhaul §2). Disappears once anything is
          picked. */}
      {selected.length === 0 && (
        <div className="mt-4">
          <p className="text-xs text-foil-slate">Not sure how to spell it? Start with a grail:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHASE_EXAMPLES.filter((c) => cataloguedIds.includes(c.id)).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCard(c)}
                className="inline-flex items-center gap-2 rounded-full border border-foil-navy/15 bg-foil-cream py-1 pr-3 pl-1 text-xs font-medium text-foil-navy transition hover:border-foil-vermillion/60 hover:bg-foil-vermillion/5"
              >
                <Image
                  src={c.image}
                  alt=""
                  width={24}
                  height={34}
                  className="h-8 w-6 rounded object-cover ring-1 ring-foil-navy/10"
                />
                {c.name}
                <span aria-hidden className="text-foil-vermillion">+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SELECTED CARDS — section header (no number). Only renders once
          the user has picked at least one card. */}
      {selected.length > 0 && (
        <div className="mt-8">
          <p className="font-display text-base font-bold text-foil-navy">
            Set target prices
          </p>
          <p className="mt-1 text-sm text-foil-slate">
            No price in mind? Leave it blank and we&apos;ll email you when the
            card dips well below what it usually sells for.
          </p>
          <ul className="mt-3 space-y-2">
            {selected.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-foil-navy/10 bg-foil-cream px-3 py-2 shadow-sm shadow-foil-navy/5"
              >
                <Image
                  src={s.image}
                  alt={`${s.name} (${s.setName})`}
                  width={40}
                  height={56}
                  unoptimized
                  className="h-14 w-10 rounded-md object-cover ring-1 ring-foil-navy/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foil-navy">{s.name}</p>
                  <p className="truncate text-xs text-foil-slate">
                    {s.setName} · #{s.number}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-foil-slate">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={1}
                    value={s.targetPriceUsd}
                    onChange={(e) => updateTarget(s.id, e.target.value)}
                    placeholder="any"
                    className="w-20 rounded-lg border border-foil-navy/15 bg-foil-cream px-2 py-1.5 text-right text-sm text-foil-navy placeholder:text-foil-slate/60 outline-none focus:border-foil-vermillion focus:ring-2 focus:ring-foil-vermillion/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCard(s.id)}
                  aria-label={`Remove ${s.name}`}
                  className="ml-1 rounded-md p-1 text-foil-slate transition hover:bg-foil-navy/5 hover:text-foil-navy"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* EMAIL + OPT-IN — section header (no number). */}
      <div className="mt-8">
        <label className="block">
          <span className="font-display text-base font-bold text-foil-navy">Where to email you</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@gmail.com"
            required
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-vermillion focus:ring-2 focus:ring-foil-vermillion/30"
          />
        </label>
        <label className="mt-4 flex items-start gap-3 text-sm text-foil-slate">
          <input
            type="checkbox"
            checked={optInNewsletter}
            onChange={(e) => setOptInNewsletter(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-foil-navy/20 bg-foil-cream text-foil-vermillion focus:ring-foil-vermillion focus:ring-offset-0"
          />
          <span>
            Also send me Foil&apos;s weekly deals newsletter (~1 email/week, unsubscribe anytime)
          </span>
        </label>
      </div>

      {/* SUBMIT */}
      <button
        type="submit"
        disabled={submission.state === "submitting" || selected.length === 0}
        className="mt-8 w-full rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-vermillion hover:shadow-lg hover:shadow-foil-navy/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy"
      >
        {submission.state === "submitting"
          ? "Setting up…"
          : `Track ${selected.length || 0} ${selected.length === 1 ? "card" : "cards"} →`}
      </button>

      {submission.state === "error" && (
        <p role="alert" className="mt-3 text-sm text-foil-coral">
          {submission.message}
        </p>
      )}
    </form>
  );
}
