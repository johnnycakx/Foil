"use client";

// Shared card type-ahead — the ONE debounced search + pick pattern
// (watchlist-web-app, ADR-093). Extracted from components/start-page-form.tsx
// so /start and the vault's add-in-place use the same component instead of a
// fork. Owns query/results/searching state; the host owns what "picking a
// card" means via `onPick`.
//
// P0-4 (quality-bar-fixes, 2026-07-13): 200ms debounce against a local-first
// server path (the route answers from the baked catalog instantly; upstream
// is a time-boxed supplement), near-miss "did you mean" rows on a true miss,
// and the fail state CONVERTS — query + email become a card_requests row
// ("Foil will hunt this one down") instead of a dead end.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export type CardSearchHit = {
  id: string;
  name: string;
  setName: string;
  setId: string;
  number: string;
  image: string;
  /** Foil catalog slug when the card is tracked (mirrors lib/cards/sdk.ts —
   *  the pocket brain hydrates its live listing with it). */
  slug?: string;
};

const SEARCH_DEBOUNCE_MS = 200;

export function CardTypeahead({
  cataloguedIds,
  pickedIds,
  onPick,
  // Agent dress (offer item 4a): one prompt-style box, Foil in third person.
  placeholder = "Tell Foil what you're chasing…",
  label = "What are you chasing?",
  autoFocus = false,
  pickedBadge = "Selected ✓",
  pickCta = "+ Track",
  requesterEmail = "",
}: {
  /** Pokemon TCG ids present in CARD_CATALOG — only these are pickable. */
  cataloguedIds: string[];
  /** Ids already picked/tracked — rendered disabled with the picked badge. */
  pickedIds: string[];
  onPick: (hit: CardSearchHit) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  pickedBadge?: string;
  pickCta?: string;
  /** Prefill for the fail-state request capture (the host's email field). */
  requesterEmail?: string;
}) {
  const cataloguedSet = useMemo(() => new Set(cataloguedIds), [cataloguedIds]);
  const pickedSet = useMemo(() => new Set(pickedIds), [pickedIds]);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  // Null-over-guess (offer 4a): a completed search with no hits ASKS for more
  // detail instead of silently showing nothing (or a wrong guess).
  const [searchedEmpty, setSearchedEmpty] = useState(false);
  // Near-miss corrections from the server on a true miss (P0-4).
  const [suggestions, setSuggestions] = useState<CardSearchHit[]>([]);
  // The request-capture leg: idle → sending → sent (per failed query).
  const [requestEmail, setRequestEmail] = useState(requesterEmail);
  const [requestState, setRequestState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setSearchedEmpty(false);
      setSuggestions([]);
      setRequestState("idle");
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
        const body = (await res.json()) as {
          hits?: CardSearchHit[];
          suggestions?: CardSearchHit[];
        };
        // Only update if this is still the latest query — protects against
        // out-of-order responses on slow networks.
        if (lastQueryRef.current === q) {
          const hits = Array.isArray(body.hits) ? body.hits : [];
          setSearchResults(hits);
          setSearchedEmpty(hits.length === 0);
          setSuggestions(hits.length === 0 && Array.isArray(body.suggestions) ? body.suggestions : []);
          setRequestState("idle");
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

  async function submitRequest(): Promise<void> {
    const email = requestEmail.trim();
    const q = query.trim();
    if (!email || !q || requestState === "sending") return;
    setRequestState("sending");
    try {
      const res = await fetch("/api/card-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, email, website: "" }),
      });
      setRequestState(res.ok ? "sent" : "error");
    } catch {
      setRequestState("error");
    }
  }

  return (
    <div>
      <label className="block">
        <span className="font-display text-base font-bold text-foil-navy">{label}</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-3 text-base text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-accent-deep focus:ring-2 focus:ring-foil-accent-deep/30"
          autoFocus={autoFocus}
        />
      </label>

      {(searching || searchResults.length > 0 || searchedEmpty) && (
        <ul className="mt-4 space-y-2">
          {searching && searchResults.length === 0 && (
            <li className="text-sm text-foil-slate">Searching…</li>
          )}
          {!searching && searchedEmpty && searchResults.length === 0 && (
            <li>
              {/* The converting fail state (P0-4): never a dead end. Closest
                  real matches first, then the hunt-it capture. */}
              <p className="text-sm text-foil-slate">
                Foil doesn&apos;t recognize that one yet.
                {suggestions.length > 0 ? " Closest cards Foil knows:" : ""}
              </p>
              {suggestions.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {suggestions.map((hit) => {
                    const suggestable = cataloguedSet.has(hit.id) && !pickedSet.has(hit.id);
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onClick={() => suggestable && onPick(hit)}
                          disabled={!suggestable}
                          className="flex w-full items-center gap-3 rounded-xl border border-foil-navy/10 bg-foil-cream px-3 py-2 text-left transition hover:border-foil-accent-deep/50 hover:bg-foil-accent-deep/5 disabled:opacity-50"
                        >
                          <Image
                            src={hit.image}
                            alt={`${hit.name} (${hit.setName})`}
                            width={48}
                            height={67}
                            unoptimized
                            className="h-16 w-12 rounded-md object-cover ring-1 ring-foil-navy/10"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foil-navy">{hit.name}</p>
                            <p className="truncate text-xs text-foil-slate">
                              {hit.setName} · #{hit.number}
                            </p>
                          </div>
                          <span className="text-xs font-medium text-foil-navy">{pickCta}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {/* Self-contained cream card: the typeahead mounts on night
                  AND cream hosts, so the capture box carries its own paper. */}
              <div className="mt-3 rounded-xl border border-foil-navy/10 bg-foil-cream p-3">
                {requestState === "sent" ? (
                  <p className="text-sm text-foil-navy">
                    Foil is on it. You&apos;ll get one email when it has data on that card.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-foil-navy">
                      Want it anyway? Foil will hunt this one down and write you when it has the
                      data.
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={requestEmail}
                        onChange={(e) => setRequestEmail(e.target.value)}
                        placeholder="you@example.com"
                        aria-label="Email for the card request"
                        className="min-w-0 flex-1 rounded-lg border border-foil-navy/15 bg-foil-cream px-3 py-2 text-sm text-foil-navy placeholder:text-foil-slate/60 outline-none transition focus:border-foil-accent-deep focus:ring-2 focus:ring-foil-accent-deep/30"
                      />
                      <button
                        type="button"
                        onClick={() => void submitRequest()}
                        disabled={requestState === "sending" || !requestEmail.trim()}
                        className="shrink-0 rounded-lg bg-foil-navy px-4 py-2 text-sm font-semibold text-foil-cream transition hover:bg-foil-accent-deep disabled:opacity-50"
                      >
                        {requestState === "sending" ? "Asking…" : "Ask Foil to hunt it"}
                      </button>
                    </div>
                    {requestState === "error" && (
                      <p className="mt-2 text-xs text-foil-coral">
                        That didn&apos;t save. Give it a second and try again.
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          )}
          {searchResults.map((hit) => {
            const isCatalogued = cataloguedSet.has(hit.id);
            const isPicked = pickedSet.has(hit.id);
            return (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => isCatalogued && !isPicked && onPick(hit)}
                  disabled={!isCatalogued || isPicked}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    isPicked
                      ? "border-foil-accent-deep/40 bg-foil-accent-deep/5 opacity-60"
                      : isCatalogued
                        ? "border-foil-navy/10 bg-foil-cream hover:border-foil-accent-deep/50 hover:bg-foil-accent-deep/5"
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
                  {isPicked ? (
                    <span className="text-xs font-medium text-foil-accent-deep">{pickedBadge}</span>
                  ) : isCatalogued ? (
                    <span className="text-xs font-medium text-foil-navy">{pickCta}</span>
                  ) : (
                    <span className="text-xs text-foil-slate">Not yet tracked</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
