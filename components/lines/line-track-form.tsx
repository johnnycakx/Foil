"use client";

// Per-card "Track this card" for the line tracker (eve-line-tracker, ADR-095).
// Posts a single card into the existing /api/start endpoint with the line's
// `src` (e.g. "line-umbreon") so the whole tri-store + vault-welcome + hydration
// pipeline (ADR-090/092/093) runs, and the signup is attributable. Inline: a
// target price is optional (blank = the market-basis alert from ADR-091).

import { useState } from "react";

type State =
  | { s: "idle" }
  | { s: "open" }
  | { s: "submitting" }
  | { s: "done"; vaultUrl: string | null; emailed: boolean }
  | { s: "error"; msg: string };

export function LineTrackForm({
  card,
  src,
}: {
  card: { pokemon_tcg_id: string; name: string; set_name: string; set_id: string; number: string };
  /** Attribution tag, e.g. "line-umbreon". */
  src: string;
}) {
  const [state, setState] = useState<State>({ s: "idle" });
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");

  async function submit() {
    if (!email.trim()) {
      setState({ s: "error", msg: "Enter your email." });
      return;
    }
    setState({ s: "submitting" });
    try {
      const utmSource = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("utm_source") : null;
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          opt_in_newsletter: true,
          cards: [
            {
              pokemon_tcg_id: card.pokemon_tcg_id,
              name: card.name,
              set_name: card.set_name,
              set_id: card.set_id,
              number: card.number,
              target_price_cents: target.trim() === "" ? null : Math.round(parseFloat(target) * 100),
            },
          ],
          src,
          utm: utmSource ? { source: utmSource } : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; vault_url?: string; vault_link_emailed?: boolean };
      if (!res.ok || !body.ok) {
        setState({ s: "error", msg: "Couldn't set that up. Try again." });
        return;
      }
      setState({ s: "done", vaultUrl: body.vault_url ?? null, emailed: body.vault_link_emailed ?? false });
    } catch {
      setState({ s: "error", msg: "Network hiccup. Try again." });
    }
  }

  if (state.s === "done") {
    return (
      <p className="mt-2 text-xs text-foil-navy">
        Tracking {card.name} — we&apos;ll email you when it&apos;s a good buy.
        {state.vaultUrl ? (
          <>
            {" "}
            <a href={state.vaultUrl} className="font-medium underline decoration-foil-sakura/50 underline-offset-2 hover:decoration-foil-sakura">
              Open your vault →
            </a>
          </>
        ) : state.emailed ? (
          <> Your vault link is in your inbox.</>
        ) : null}
      </p>
    );
  }

  if (state.s === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState({ s: "open" })}
        className="mt-2 inline-flex items-center rounded-lg border border-foil-navy/15 bg-foil-cream px-3 py-1.5 text-xs font-semibold text-foil-navy transition hover:border-foil-sakura/50 hover:bg-foil-sakura-wash"
      >
        Track this card
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gmail.com"
          autoComplete="email"
          className="min-w-0 flex-1 rounded-lg border border-foil-navy/15 bg-white/70 px-2.5 py-1.5 text-xs text-foil-navy placeholder:text-foil-slate/60 outline-none focus:border-foil-sakura focus:ring-1 focus:ring-foil-sakura/40"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-foil-slate">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            step={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="any"
            aria-label={`Target price for ${card.name}`}
            className="w-16 rounded-lg border border-foil-navy/15 bg-white/70 px-2 py-1.5 text-right text-xs text-foil-navy placeholder:text-foil-slate/60 outline-none focus:border-foil-sakura focus:ring-1 focus:ring-foil-sakura/40"
          />
        </div>
        <button
          type="button"
          disabled={state.s === "submitting"}
          onClick={submit}
          className="rounded-lg bg-foil-navy px-3 py-1.5 text-xs font-semibold text-foil-cream transition hover:bg-foil-sakura disabled:opacity-60"
        >
          {state.s === "submitting" ? "…" : "Watch it"}
        </button>
      </div>
      <p className="text-[11px] text-foil-slate">
        Leave the price blank and we&apos;ll tell you when it&apos;s a genuinely good buy. No account needed.
      </p>
      {state.s === "error" && <p className="text-[11px] text-foil-coral">{state.msg}</p>}
    </div>
  );
}
