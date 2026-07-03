// /w/[token] — the VAULT: your live watchlist as a page (ADR-093).
//
// The token IS the auth (lib/vault-token.ts, context-separated HMAC): verify →
// email → rows. Every failure renders 404 — the URL space is indistinguishable
// from not-found for a guesser, and nothing discloses whether an email exists.
//
// The binder metaphor is STRUCTURAL (John + Cowork, 2026-07-01): a binder-
// pocket grid (3×3 desktop / 2-col mobile), cards in slots with faint
// plastic-pocket depth, pagination as a page-turn. ONE first-open settle
// (~300ms, first visit only, motion-safe) — NO loading gate: this is a
// daily-visit surface and the sub-second load IS the feature.
//
// Quota discipline (R-012): NO live eBay resolve here. A vault of 9 curated
// cards doing 9 resolves per view would dwarf the card page's budget and slow
// the daily surface. Each pocket shows the alert engine's LAST VERIFIED
// observation (last_seen_price_cents — at most one hourly scan old, honestly
// labeled) + the recent sold average from the movers cache, and links to the
// card page for the live block.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySeededVaultToken, verifyVaultToken } from "@/lib/vault-token";
import { getSeededVault } from "@/lib/vault-seeds";
import { SeededVaultView } from "./seeded-vault-view";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CARD_CATALOG, getCatalogEntry } from "@/lib/cards/catalog";
import { getBakedCardMetadata } from "@/lib/cards/sdk";
import { effectiveTargetCents } from "@/lib/wishlist/alert-decision";
import {
  vaultPauseAll,
  vaultPauseCard,
  vaultRemoveCard,
  vaultResumeAll,
  vaultResumeCard,
  vaultUpdateTarget,
} from "@/app/actions/vault";
import { VaultAddCard } from "@/components/vault/vault-add-card";
import { VaultSettle } from "@/components/vault/vault-settle";
import { SakuraAmbience } from "@/components/sakura-ambience";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The platonic binder page: 9 pockets.
const POCKETS_PER_PAGE = 9;

export const metadata: Metadata = {
  title: "Your vault",
  robots: { index: false, follow: false }, // private URL space — never indexed
  // The token lives in the URL; keep it from leaking cross-origin via Referer
  // even on old/misconfigured UAs (modern default is already origin-only).
  referrer: "same-origin",
};

type VaultRow = {
  id: string;
  card_slug: string;
  target_price_cents: number | null;
  variant: string;
  condition: string;
  alert_state: "armed" | "fired";
  alerts_paused_at: string | null;
  paused_source: string | null;
  last_seen_price_cents: number | null;
};

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function VaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ p?: string; c?: string }>;
}) {
  const { token } = await params;
  const { p, c } = await searchParams;
  const decoded = decodeURIComponent(token);
  const verified = verifyVaultToken(decoded);
  if (!verified.ok) {
    // Not an email-vault token — maybe a SEEDED gift vault (eve-vault,
    // ADR-100; context-separated token, lib/vault-token.ts). Both failing
    // renders the same uniform 404 as before.
    const seeded = verifySeededVaultToken(decoded);
    const seed = seeded.ok ? getSeededVault(seeded.vaultId) : null;
    if (!seeded.ok || !seed) notFound();
    return <SeededVaultView vault={seed} token={decoded} claimFlag={c} />;
  }
  const email = verified.email;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("watchlists")
    .select(
      "id, card_slug, target_price_cents, variant, condition, alert_state, alerts_paused_at, paused_source, last_seen_price_cents",
    )
    .eq("email", email);
  if (error) {
    // Soft-fail to the empty shell rather than 500 — the daily surface must load.
    console.warn(`[vault] rows fetch failed: ${error.message}`);
  }
  const rows = (data ?? []) as VaultRow[];

  // One movers read for the whole vault: slug → recent sold average.
  const soldBySlug = new Map<string, number>();
  if (rows.length > 0) {
    const { data: movers } = await admin
      .from("market_movers")
      .select("card_slug, avg30d")
      .in("card_slug", [...new Set(rows.map((r) => r.card_slug))]);
    for (const m of movers ?? []) {
      if (typeof m.avg30d === "number" && m.avg30d > 0) {
        soldBySlug.set(m.card_slug as string, Math.round((m.avg30d as number) * 100));
      }
    }
  }

  // Enrich + sort by closest-to-target (the alert engine's last verified
  // observation vs the effective target — below/at target floats to the top).
  const pockets = rows
    .map((row) => {
      const entry = getCatalogEntry(row.card_slug);
      const meta = entry ? getBakedCardMetadata(entry.pokemonTcgId) : null;
      const soldCents = soldBySlug.get(row.card_slug) ?? null;
      const effective = effectiveTargetCents(
        row.target_price_cents,
        soldCents
          ? { avg30dCents: soldCents, saleCount: 0, tierLabel: "Near Mint", computedAt: "" }
          : null,
        row.condition,
      );
      const closeness =
        row.last_seen_price_cents != null && effective != null && effective > 0
          ? row.last_seen_price_cents / effective
          : Number.POSITIVE_INFINITY;
      return { row, meta, soldCents, effective, closeness };
    })
    .sort((a, b) => a.closeness - b.closeness);

  const totalPages = Math.max(1, Math.ceil(pockets.length / POCKETS_PER_PAGE));
  const page = Math.min(Math.max(1, Number(p) || 1), totalPages);
  const pagePockets = pockets.slice((page - 1) * POCKETS_PER_PAGE, page * POCKETS_PER_PAGE);
  const pausedCount = rows.filter((r) => r.alerts_paused_at != null).length;
  const allPaused = rows.length > 0 && pausedCount === rows.length;
  const vaultPath = `/w/${encodeURIComponent(token)}`;

  return (
    // design-loop-round2 §4: the vault gets the night register — binder pockets
    // on the night surface, card art as the only bright thing.
    <main data-tone="night" className="relative mx-auto w-full max-w-5xl flex-1 bg-foil-night px-5 pt-10 pb-20 text-foil-cream sm:px-8 sm:pt-14">
      {/* Sparse far-layer hanami over the vault header (binder-aesthetic-pass)
          — the most personal room gets the motif, at whisper density. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden">
        <SakuraAmbience mode="header" />
      </div>
      <header className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-foil-accent">Your vault</p>
          <h1 className="font-display mt-1 text-4xl font-bold tracking-[-0.02em] text-foil-cream sm:text-5xl">
            {rows.length === 0
              ? "Your vault is empty — for now."
              : `You're watching ${rows.length} ${rows.length === 1 ? "card" : "cards"}`}
          </h1>
          <p className="mt-3 max-w-xl text-base text-foil-cream/70 sm:text-lg">
            We check eBay every hour and email you when a card genuinely hits your number.
          </p>
        </div>
        {rows.length > 0 && (
          <form action={allPaused ? vaultResumeAll : vaultPauseAll}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="rounded-xl bg-foil-night-2 px-4 py-2 text-sm font-medium text-foil-cream ring-1 ring-foil-cream/15 transition hover:ring-foil-accent/50"
            >
              {allPaused ? "Resume all alerts" : "Pause all alerts"}
            </button>
          </form>
        )}
      </header>

      {rows.length === 0 ? (
        <section className="mt-10 rounded-3xl bg-foil-night-2 p-8 text-center ring-1 ring-foil-cream/10 sm:p-10">
          {/* Three waiting pockets — the empty binder page as an invitation. */}
          <div aria-hidden className="mx-auto grid max-w-xs grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl bg-foil-night shadow-[inset_0_1px_3px_rgba(4,9,18,0.7),inset_0_-1px_2px_rgba(248,245,240,0.04)] ring-1 ring-foil-cream/10"
                style={{ aspectRatio: "245 / 342" }}
              />
            ))}
          </div>
          <p className="font-display mt-6 text-2xl font-bold text-foil-cream sm:text-3xl">
            Nine pockets, waiting for your first card.
          </p>
          <p className="mx-auto mt-3 max-w-md text-base text-foil-cream/70 sm:text-lg">
            Tell us the card you&apos;re chasing and the price you&apos;d be happy to pay.
            We&apos;ll watch eBay around the clock and email you the moment a verified
            listing hits your number — no tabs left open, no daily scrubbing.
          </p>
        </section>
      ) : (
        <VaultSettle>
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
            {pagePockets.map(({ row, meta, soldCents, effective }) => {
              const paused = row.alerts_paused_at != null;
              const complaintLocked = row.paused_source === "complaint";
              const stateLabel = paused ? "Paused" : row.alert_state === "fired" ? "Alerted" : "Armed";
              return (
                <li
                  key={row.id}
                  // The pocket: faint plastic-sleeve depth on the night panel —
                  // inset ring + a whisper of top-light. Matte at rest; the
                  // card art is the light source (design-loop-round2 §4).
                  className="rounded-2xl bg-foil-night-2 p-3 shadow-[inset_0_1px_3px_rgba(4,9,18,0.7),inset_0_-1px_2px_rgba(248,245,240,0.05)] ring-1 ring-foil-cream/10 transition hover:-translate-y-0.5 hover:ring-foil-cream/30"
                >
                  <div className="relative overflow-hidden rounded-xl bg-foil-cream/5">
                    {meta?.image ? (
                      <Link href={`/cards/${row.card_slug}`}>
                        <Image
                          src={meta.image}
                          alt={`${meta.name} (${meta.setName})`}
                          width={245}
                          height={342}
                          sizes="(min-width: 1024px) 18rem, 44vw"
                          className="aspect-[245/342] w-full"
                        />
                      </Link>
                    ) : (
                      <div aria-hidden className="w-full" style={{ aspectRatio: "245 / 342" }} />
                    )}
                    {/* Alert-state chips: accent = live, cream/10 = paused. A
                        night/85 backing keeps them legible over bright art. */}
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider backdrop-blur-sm ${
                        paused
                          ? "bg-foil-night/85 text-foil-cream/60 ring-1 ring-foil-cream/10"
                          : row.alert_state === "fired"
                            ? "bg-foil-accent/90 text-foil-night"
                            : "bg-foil-night/85 text-foil-accent ring-1 ring-foil-accent/40"
                      }`}
                    >
                      {stateLabel}
                    </span>
                  </div>

                  <div className="mt-3 px-1">
                    <p className="truncate text-sm font-semibold text-foil-cream">
                      {meta?.name ?? row.card_slug}
                    </p>
                    <p className="truncate font-mono text-[11px] uppercase tracking-wider text-foil-cream/50">
                      {meta?.setName ?? ""} {meta?.number ? `· #${meta.number}` : ""}
                    </p>

                    {/* The market brain, set quietly beneath the card. */}
                    <p className="mt-2 text-xs text-foil-cream/60">
                      {row.last_seen_price_cents != null ? (
                        <>Last verified listing: <span className="font-mono tabular-nums text-foil-cream">{usd(row.last_seen_price_cents)}</span></>
                      ) : (
                        <>Not checked yet — first look within the hour.</>
                      )}
                    </p>
                    <p className="text-xs text-foil-cream/60">
                      {soldCents ? (
                        <>Sold for ~<span className="tabular-nums">{usd(soldCents)}</span> recently</>
                      ) : (
                        <>No recent sold data yet</>
                      )}
                      {effective != null && row.target_price_cents == null ? (
                        <> · alerting <span className="tabular-nums">{usd(effective)}</span> or less</>
                      ) : null}
                    </p>

                    <form action={vaultUpdateTarget} className="mt-2 flex items-center gap-1.5">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="row_id" value={row.id} />
                      <span className="text-xs text-foil-cream/60">$</span>
                      <input
                        type="number"
                        name="target_usd"
                        inputMode="decimal"
                        min={1}
                        step={1}
                        defaultValue={
                          row.target_price_cents != null ? (row.target_price_cents / 100).toFixed(0) : ""
                        }
                        placeholder="any"
                        aria-label={`Target price for ${meta?.name ?? row.card_slug}`}
                        className="w-16 rounded-lg border border-foil-cream/15 bg-foil-night px-2 py-1 text-right text-xs tabular-nums text-foil-cream placeholder:text-foil-cream/40 outline-none focus:border-foil-accent focus:ring-1 focus:ring-foil-accent/30"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-foil-cream/15 px-2 py-1 text-[11px] font-medium text-foil-cream transition hover:border-foil-accent/50 hover:bg-foil-accent/10"
                      >
                        Save
                      </button>
                    </form>

                    <div className="mt-2 flex items-center gap-2">
                      {complaintLocked ? (
                        <span className="text-[11px] text-foil-cream/50" title="Alerts for this address were stopped after a spam report; they can't be resumed from this page.">
                          Alerts off
                        </span>
                      ) : (
                        <form action={paused ? vaultResumeCard : vaultPauseCard}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="row_id" value={row.id} />
                          <button
                            type="submit"
                            className="text-[11px] font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-2 transition hover:decoration-foil-accent"
                          >
                            {paused ? "Resume" : "Pause"}
                          </button>
                        </form>
                      )}
                      <form action={vaultRemoveCard}>
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="row_id" value={row.id} />
                        <button
                          type="submit"
                          aria-label={`Remove ${meta?.name ?? row.card_slug} from your vault`}
                          className="text-[11px] text-foil-cream/60 underline decoration-foil-cream/20 underline-offset-2 transition hover:text-foil-cream hover:decoration-foil-accent"
                        >
                          Remove
                        </button>
                      </form>
                      <Link
                        href={`/cards/${row.card_slug}`}
                        className="ml-auto text-[11px] font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-2 transition hover:text-foil-accent hover:decoration-foil-accent"
                      >
                        Live listing →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </VaultSettle>
      )}

      {/* Page-turn pagination — structural binder metaphor, plain links. */}
      {totalPages > 1 && (
        <nav aria-label="Binder pages" className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`${vaultPath}?p=${page - 1}`} className="font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:text-foil-accent hover:decoration-foil-accent">
              ← Turn back
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider tabular-nums text-foil-cream/50">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`${vaultPath}?p=${page + 1}`} className="font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:text-foil-accent hover:decoration-foil-accent">
              Turn page →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {/* Add cards in place — the SAME shared type-ahead as /start (no fork). */}
      <section className="mt-12 rounded-3xl bg-foil-night-2 p-6 ring-1 ring-foil-cream/10 sm:p-8" aria-labelledby="vault-add-heading">
        <h2 id="vault-add-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
          Add to your vault
        </h2>
        <div className="mt-4">
          <VaultAddCard
            token={token}
            cataloguedIds={CARD_CATALOG.map((e) => e.pokemonTcgId)}
            trackedIds={rows
              .map((r) => getCatalogEntry(r.card_slug)?.pokemonTcgId ?? "")
              .filter(Boolean)}
          />
        </div>
      </section>

      <p className="mt-8 text-[11px] text-foil-cream/50">
        This page is private to this link — anyone who has it can view and edit your vault.
        Alerts go to the email this vault belongs to.
      </p>
    </main>
  );
}
