"use client";

// Shared card type-ahead — the ONE debounced search + pick pattern
// (watchlist-web-app, ADR-093). Extracted from components/start-page-form.tsx
// so /start and the vault's add-in-place use the same component instead of a
// fork. Owns query/results/searching state; the host owns what "picking a
// card" means via `onPick`.
//
// Behavior kept byte-compatible with the /start original: 300ms debounce,
// AbortController per request, out-of-order response guard, catalogued-only
// picks ("Not yet tracked" badge on the rest), top-8 results from
// /api/cards/search.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

export type CardSearchHit = {
  id: string;
  name: string;
  setName: string;
  setId: string;
  number: string;
  image: string;
};

const SEARCH_DEBOUNCE_MS = 300;

export function CardTypeahead({
  cataloguedIds,
  pickedIds,
  onPick,
  placeholder = "charizard, pikachu, lugia…",
  label = "Tell me a card",
  autoFocus = false,
  pickedBadge = "Selected ✓",
  pickCta = "+ Track",
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
}) {
  const cataloguedSet = useMemo(() => new Set(cataloguedIds), [cataloguedIds]);
  const pickedSet = useMemo(() => new Set(pickedIds), [pickedIds]);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CardSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

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
        const body = (await res.json()) as { hits?: CardSearchHit[] };
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

      {(searching || searchResults.length > 0) && (
        <ul className="mt-4 space-y-2">
          {searching && searchResults.length === 0 && (
            <li className="text-sm text-foil-slate">Searching…</li>
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
