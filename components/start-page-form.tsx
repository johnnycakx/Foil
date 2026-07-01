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

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type SearchHit = {
  id: string;
  name: string;
  setName: string;
  setId: string;
  number: string;
  image: string;
};

type Selected = SearchHit & {
  targetPriceUsd: string; // user-input dollars, empty = "any drop"
};

type Submission =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; count: number }
  | { state: "error"; message: string };

const MAX_SELECTED = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function StartPageForm({ cataloguedIds }: { cataloguedIds: string[] }) {
  const cataloguedSet = useMemo(() => new Set(cataloguedIds), [cataloguedIds]);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      lastQueryRef.current = q;
      setSearching(true);
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const body = (await res.json()) as { hits?: SearchHit[] };
        // Only update if this is still the latest query — protects against
        // out-of-order responses on slow networks.
        if (lastQueryRef.current === q) {
          setSearchResults(Array.isArray(body.hits) ? body.hits : []);
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setSearchResults([]);
        }
      } finally {
        if (lastQueryRef.current === q) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  function addCard(hit: SearchHit) {
    if (selectedIds.has(hit.id)) return;
    if (selected.length >= MAX_SELECTED) return;
    if (!cataloguedSet.has(hit.id)) return;
    setSelected((prev) => [...prev, { ...hit, targetPriceUsd: "" }]);
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
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; count?: number };
      if (!res.ok || !body.ok) {
        setSubmission({
          state: "error",
          message: body.error === "invalid_payload" ? "Form data didn't validate. Try again." : "Something broke. Try again, or email john.c.craig24@gmail.com.",
        });
        return;
      }
      setSubmission({ state: "success", count: body.count ?? selected.length });
    } catch {
      setSubmission({
        state: "error",
        message: "Network hiccup. Try again.",
      });
    }
  }

  if (submission.state === "success") {
    return (
      <section className="rounded-3xl border border-foil-gold/40 bg-foil-cream p-8 shadow-xl shadow-foil-navy/10 sm:p-10">
        <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">
          You&apos;re tracking {submission.count} cards
        </p>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-[-0.02em] text-foil-navy sm:text-3xl">
          We&apos;ve got it from here.
        </h2>
        <p className="mt-4 text-base text-foil-slate">
          Foil checks eBay every hour. The first time one of your cards drops to a price worth buying, the email lands. <span className="text-foil-slate/80">Add <code className="rounded bg-foil-navy/10 px-1.5 py-0.5 text-sm text-foil-navy">alerts@foiltcg.com</code> to your contacts so Gmail doesn&apos;t hide it.</span>
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="/cards"
            className="inline-flex items-center justify-center rounded-xl bg-foil-navy px-5 py-2.5 text-sm font-semibold text-foil-cream transition hover:bg-foil-coral"
          >
            Browse the catalog →
          </a>
          <a
            href="/newsletter"
            className="text-sm text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold"
          >
            Or read the newsletter
          </a>
        </div>
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

      {/* SEARCH — section header (ADR-029: dropped numeric prefix). */}
      <label className="block">
        <span className="font-display text-base font-bold text-foil-navy">Tell me a card</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="charizard, pikachu, lugia…"
          className="mt-2 w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30"
          autoFocus
        />
      </label>

      {/* RESULTS */}
      {(searching || searchResults.length > 0) && (
        <ul className="mt-4 space-y-2">
          {searching && searchResults.length === 0 && (
            <li className="text-sm text-foil-slate">Searching…</li>
          )}
          {searchResults.map((hit) => {
            const isCatalogued = cataloguedSet.has(hit.id);
            const isSelected = selectedIds.has(hit.id);
            return (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => isCatalogued && addCard(hit)}
                  disabled={!isCatalogued || isSelected}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    isSelected
                      ? "border-foil-gold/40 bg-foil-gold/5 opacity-60"
                      : isCatalogued
                        ? "border-foil-navy/10 bg-foil-cream hover:border-foil-gold/50 hover:bg-foil-gold/5"
                        : "border-foil-navy/5 bg-foil-cream/50 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Image
                    src={hit.image}
                    alt={`${hit.name} (${hit.setName})`}
                    width={48}
                    height={67}
                    unoptimized
                    className="h-16 w-12 rounded-md object-cover ring-1 ring-foil-navy/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foil-navy">{hit.name}</p>
                    <p className="truncate text-xs text-foil-slate">
                      {hit.setName} · #{hit.number}
                    </p>
                  </div>
                  {isSelected ? (
                    <span className="text-xs font-medium text-foil-gold">Selected ✓</span>
                  ) : isCatalogued ? (
                    <span className="text-xs font-medium text-foil-navy">+ Track</span>
                  ) : (
                    <span className="text-xs text-foil-slate">Not yet tracked</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* SELECTED CARDS — section header (no number). Only renders once
          the user has picked at least one card. */}
      {selected.length > 0 && (
        <div className="mt-8">
          <p className="font-display text-base font-bold text-foil-navy">
            Set target prices <span className="font-sans text-sm font-normal text-foil-slate">(leave blank for &ldquo;any drop&rdquo;)</span>
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
                    className="w-20 rounded-lg border border-foil-navy/15 bg-foil-cream px-2 py-1.5 text-right text-sm text-foil-navy placeholder:text-foil-slate/60 outline-none focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30"
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
            className="mt-2 w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-gold focus:ring-2 focus:ring-foil-gold/30"
          />
        </label>
        <label className="mt-4 flex items-start gap-3 text-sm text-foil-slate">
          <input
            type="checkbox"
            checked={optInNewsletter}
            onChange={(e) => setOptInNewsletter(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-foil-navy/20 bg-foil-cream text-foil-gold focus:ring-foil-gold focus:ring-offset-0"
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
        className="mt-8 w-full rounded-xl bg-foil-navy px-6 py-3.5 text-base font-semibold text-foil-cream shadow-md shadow-foil-navy/20 transition-all hover:-translate-y-0.5 hover:bg-foil-coral hover:shadow-lg hover:shadow-foil-navy/30 hover:ring-2 hover:ring-foil-gold/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-foil-navy disabled:hover:ring-0"
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
