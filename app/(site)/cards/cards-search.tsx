"use client";

// Live filter for the /cards index. Filters the rendered <li data-card-slug="..."
// data-card-name="..."> nodes in place by toggling `hidden`, plus hides
// entire section groups when none of their cards match. SSR markup stays
// intact (every card-link is in the initial HTML — Google sees everything).

import { useEffect, useRef, useState } from "react";

export type SearchEntry = {
  slug: string;
  name: string;
  setName: string;
};

export function CardsSearch({ index }: { index: SearchEntry[] }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const needle = query.trim().toLowerCase();
    // Build a Set of matching slugs (O(n)).
    const matches = new Set<string>();
    if (needle === "") {
      for (const e of index) matches.add(e.slug);
    } else {
      for (const e of index) {
        if (e.name.toLowerCase().includes(needle) || e.setName.toLowerCase().includes(needle)) {
          matches.add(e.slug);
        }
      }
    }

    // Toggle each set-tile <li>'s hidden state.
    const tiles = document.querySelectorAll<HTMLElement>("li[data-card-slug]");
    tiles.forEach((el) => {
      const slug = el.getAttribute("data-card-slug") ?? "";
      el.hidden = !matches.has(slug);
    });

    // Hide whole era sections (or legacy group sections) whose visible-tile
    // count is 0 — keeps the page from rendering hollow era headers under
    // a tight query.
    const sections = document.querySelectorAll<HTMLElement>(
      "section[data-era], section[aria-labelledby^=group-]",
    );
    sections.forEach((section) => {
      const visible = section.querySelectorAll<HTMLElement>("li[data-card-slug]:not([hidden])").length;
      section.hidden = visible === 0;
    });
  }, [query, index]);

  return (
    <div className="mt-8 max-w-xl">
      <label htmlFor="cards-search" className="sr-only">
        Search cards by name or set
      </label>
      <div className="relative">
        <input
          id="cards-search"
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or set — try “Charizard”, “Base Set”, “Lugia”…"
          className="w-full rounded-2xl border border-white/15 bg-[#101D38] px-5 py-3.5 text-base text-white placeholder-zinc-500 outline-none transition focus:border-[#FF6B5C] focus:bg-[#152549]"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Clear search"
          >
            Clear
          </button>
        )}
      </div>
      {query && (
        <p className="mt-2 text-xs text-zinc-500">
          Filtering on “<span className="text-zinc-300">{query}</span>”
        </p>
      )}
    </div>
  );
}
