# Spec: Sleeve Search ("write the name")

**Beat:** cycle 3.5, start-binder-delight. **Date:** 2026-07-12. **Author:** Claude (co-pilot), John's verdict from the cycle-3 tour.
**Verdict being fixed:** the picking panel's fan is great, but finding a card NOT in the fan is buried behind the "know the exact card? type it" whisper — and the existing `CardTypeahead` presentation is cream-register form UI (ADR-093 era) that visually predates the night register and the analog-object direction. Do not paste it into the panel as-is.

---

## 1. Concept

The picking panel is the dealer's counter: the fan is "here's what everyone's chasing." Search is the customer saying a name — so it renders as **writing on the counter, not filling a form**. One pencil-line input (no box), and results deal into a **mini card tray** (small card fronts, like the fan) instead of a list of form rows. Same object language end to end: fan → written line → dealt results → card seats in sleeve.

**Architecture rule:** split `CardTypeahead` into (a) `useCardSearch()` — the hook owning query/debounce/abort/out-of-order/searchedEmpty state, byte-compatible behavior, moved to `lib/` or colocated; and (b) presentation components. The existing `CardTypeahead` becomes a thin cream-register skin over the hook (vault + watchlist-form keep working, ZERO visual change to them this beat — their re-skin is a later migration). The new `SleeveSearch` is the night-register skin used only in the picking panel.

## 2. Anatomy & placement

Inside the picking panel ("Which one are you chasing?"), under the fan:

```
[ fan of today's most-chased ....................... ]
[ caption: real sold prices line .................... ]
        or write it: __________________________       ← pencil-line input
[ results tray: up to 6 mini card fronts, one row ]   ← only when typing
[ state line: searching… / not-recognized copy    ]
```

- The current "know the exact card? type it" link is REPLACED by the input. The input at rest IS the affordance — no separate link, no second CTA.
- Search never replaces the fan; the fan stays mounted above. Closing/clearing the query collapses the tray back to fan-only. The panel grows downward; no layout shift of the fan itself (reserve tray height only while results exist — `min-height` on the tray container while `query.length ≥ 2`).

## 3. Visual spec (night register tokens only)

**Input — "the written line":**
- No box, no fill. `background: transparent`. Bottom border only: 1px `foil-cream/25` at rest.
- Text: Geist, **16px minimum** (iOS no-zoom), `text-foil-cream`. Placeholder: `foil-slate/60`... use exact existing copy: `"Tell Foil what you're chasing…"`.
- Leading affordance: the pencil glyph from the tag component family (`.tag-pencil` lineage), 16px, `foil-cream/40` at rest — this is the "or write it" cue. No magnifying-glass icon anywhere (that's database language).
- Focus: bottom border transitions to `foil-accent` (#d98aa0) and thickens to 2px (no ring box — rings are for boxed inputs; this is a line on the counter). Pencil glyph warms to `foil-accent`. Transition ≤150ms, opacity/border-color only.
- Label for a11y: visually hidden `<label>` "Search for a card by name" — the placeholder + pencil carry the visual weight.
- NO gold, NO coral, NO vermillion (wordmark-only / hover-only / hanko-only rules hold).

**Results tray — "dealt cards":**
- Up to **6** hits (down from 8: one row of mini fronts at 390px), rendered as mini card fronts: image at ~72×100 (2:2.79 card ratio), `rounded-md` (6px, inline-thumbnail tier), `ring-1 ring-foil-cream/10`.
- Caption under each front: name (Geist 12px medium, `foil-cream`, truncate) over set·number (11px, `foil-slate`, truncate). Max caption width = card width.
- Hover/focus (desktop): front lifts −2px + `ring-foil-accent/50`; flat at rest (Flat-At-Rest holds — attention lifts, rest doesn't).
- Picked-already: front at 60% opacity, caption swaps to "In a sleeve ✓" in `foil-accent`.
- Not-in-catalog ("Not yet tracked"): front at 40% opacity, grayscale(0.4), caption "Not yet tracked" in `foil-slate`. Not focusable as a pick; still visible (honesty: we show what we found and say what we can't do).
- Tray is horizontally scrollable at 390px if >3 hits (scroll-snap, no scrollbar chrome; overflow fade masks at both edges, `foil-night-2` to transparent).

**State lines (one at a time, under the tray):**
- Searching: "Foil is checking the binder…" — `foil-slate`, 13px, with the existing live-dot ping (accent, 6px) to its left. No spinners.
- Empty (null-over-guess, keep copy VERBATIM from the current component): "Foil doesn't recognize that one yet. Try the full card name, or add the set name."
- These replace each other in place; no layout jump (fixed 20px line height slot).

## 4. Motion

- Results **deal in**: each front translates up 6px + fades in, 40ms stagger left-to-right, transform/opacity only. One deal per result-set; re-querying re-deals.
- On pick: the mini front does the existing seat animation path (whatever cycle 2/3 uses for fan→sleeve). If a shared "seat" primitive doesn't exist, the front scales to 0.9 + fades at its origin and the sleeve's existing seat animation takes over. Do NOT invent a new flight path this beat.
- `prefers-reduced-motion`: no deal stagger, no lifts — instant render, opacity changes only. Ping dot static.
- Nothing here animates at rest. One signature per page is still the holo/rip — search motion is response-only.

## 5. Behavior (unchanged contract)

- Hook keeps: 300ms debounce, min 2 chars, AbortController per request, out-of-order guard, top hits from `/api/cards/search`, catalogued-only picks, pickedIds disabled.
- `onPick` seats the card in the open sleeve; page-full (9) still enforced — picking while full is impossible because the picker opens from an open sleeve, but guard anyway (no-op + the existing page-full message if state races).
- Input clears after a successful pick; tray collapses; focus returns to the seated sleeve (a11y: `aria-live="polite"` announces "«name» sleeved").

## 6. Mobile (390×844 harness must pass)

- Input ≥16px font; tap target full row width, ≥44px height.
- Tray: one row, scroll-snap, momentum scroll; fronts ≥72px wide (thumb-tappable).
- Keyboard: panel must not be occluded by the on-screen keyboard — the input scrolls into view on focus (`scrollIntoView({block:"center"})`, guard reduced-motion with `behavior:"auto"`).

## 7. A11y

- Combobox pattern: `role="combobox"` on input, `aria-expanded`, results in `role="listbox"` with `role="option"` fronts; arrow-key navigation across fronts, Enter picks, Escape clears + returns focus to input.
- Every front's accessible name: "«Card name», «Set» #«number»" (+ ", not yet tracked" / ", already in a sleeve" when applicable).
- Focus visible: the accent ring on fronts doubles as focus ring (`:focus-visible`).

## 8. Out of scope this beat

- Restyling `CardTypeahead` call sites (vault add-in-place, watchlist-form, /cards) — they keep the cream skin via the shared hook. File an IDEAS entry: "night-register skin migration for remaining typeahead surfaces."
- Set/number filter chips, fuzzy-match tuning, recent-searches memory — later.
- Any change to `/api/cards/search`.

## 9. Acceptance & gates

Tests: hook extraction is behavior-identical (existing typeahead tests keep passing untouched or with import-path-only edits) · SleeveSearch renders in the picking panel · typing ≥2 chars deals results · pick seats card in the open sleeve and clears query · picked/uncatalogued states render + are unpickable · empty-state copy exact-match · combobox keyboard path (arrow/Enter/Escape) · 390px harness: full search→pick→seat loop.
Gates: all cycle-3 gates (tsc, suite 0 fail, design:lint 0 new, security no High/Med, Lighthouse mobile ≥ cycle-3's 91, CLS 0). Commit on branch, NO PUSH — John tours, then pushes.

**Tour checklist (John):** pencil line reads as "write here" without instructions · type "articuno" → fronts deal in, feel like cards not rows · pick one → it seats · type gibberish → the honest no-guess line · phone: no zoom on focus, keyboard doesn't bury the tray, thumb-scroll the tray.
