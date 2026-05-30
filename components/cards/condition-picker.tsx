"use client";

// Condition picker (Session 49b / ADR-043).
//
// Lets a buyer pick the grade/raw condition their watchlist alert should
// target. State lives in the URL (?c=<token>), the same pattern as the variant
// selector's ?v= — "No state libraries; Server Components + URL state + Server
// Actions" (CLAUDE.md). The watchlist form (lower on the page) reads the same
// ?c via useSearchParams, so the two stay in sync through a soft navigation
// (router.replace) that preserves the email the user has already typed.
//
// Two groups: Raw (Any / NM / LP / MP / HP / DMG) and Graded (Any / PSA / BGS /
// CGC ladders). Pills follow DESIGN.md: cream/navy at rest, a gold ring + gold
// tint when selected, coral never resting. Rendered as a radiogroup for a11y.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  RAW_CONDITION_TOKENS,
  GRADED_CONDITION_TOKENS,
  CONDITION_LABELS,
  DEFAULT_CONDITION,
  isValidConditionToken,
} from "@/lib/cards/conditions";

function Pill({
  token,
  selected,
  onSelect,
}: {
  token: string;
  selected: boolean;
  onSelect: (t: string) => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(token)}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        selected
          ? "border-foil-gold/50 bg-foil-gold/10 text-foil-navy ring-1 ring-foil-gold/30"
          : "border-foil-navy/15 bg-foil-cream text-foil-slate hover:border-foil-gold/40 hover:bg-foil-gold/5 hover:text-foil-navy"
      }`}
    >
      {CONDITION_LABELS[token as keyof typeof CONDITION_LABELS] ?? token}
    </button>
  );
}

export function ConditionPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get("c");
  const selected = raw && isValidConditionToken(raw) ? raw : DEFAULT_CONDITION;

  function select(token: string) {
    const next = new URLSearchParams(params.toString());
    if (token === DEFAULT_CONDITION) {
      next.delete("c");
    } else {
      next.set("c", token);
    }
    const qs = next.toString();
    // Soft nav (replace) so the email already typed in the watchlist form is
    // preserved; scroll:false keeps the reader in place.
    router.replace(`${pathname}${qs ? `?${qs}` : ""}#sold-history-heading`, { scroll: false });
  }

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-wide text-foil-slate">Alert condition</p>
      <div className="mt-2 space-y-3">
        <div role="radiogroup" aria-label="Raw condition">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-foil-slate/80">Raw</p>
          <div className="flex flex-wrap gap-2">
            {RAW_CONDITION_TOKENS.map((t) => (
              <Pill key={t} token={t} selected={selected === t} onSelect={select} />
            ))}
          </div>
        </div>
        <details className="group" open>
          <summary className="mb-1.5 cursor-pointer list-none text-[11px] font-medium uppercase tracking-wider text-foil-slate/80 marker:content-none">
            Graded <span className="text-foil-slate/50 group-open:hidden">(tap to expand)</span>
          </summary>
          <div role="radiogroup" aria-label="Graded condition" className="flex flex-wrap gap-2">
            {GRADED_CONDITION_TOKENS.map((t) => (
              <Pill key={t} token={t} selected={selected === t} onSelect={select} />
            ))}
          </div>
        </details>
      </div>
      <p className="mt-2 text-[11px] text-foil-slate">Used for your price alert below.</p>
    </div>
  );
}
