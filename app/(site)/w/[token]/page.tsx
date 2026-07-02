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
import { verifyVaultToken } from "@/lib/vault-token";
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
  searchParams: Promise<{ p?: string }>;
}) {
  const { token } = await params;
  const { p } = await searchParams;
  const verified = verifyVaultToken(decodeURIComponent(token));
  if (!verified.ok) notFound();
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-foil-gold">Your vault</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em] text-foil-navy sm:text-4xl">
            {rows.length === 0
              ? "Your vault is empty"
              : `You're watching ${rows.length} ${rows.length === 1 ? "card" : "cards"}`}
          </h1>
          <p className="mt-2 text-sm text-foil-slate">
            We check eBay every hour and email you when a card genuinely hits your number.
          </p>
        </div>
        {rows.length > 0 && (
          <form action={allPaused ? vaultResumeAll : vaultPauseAll}>
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="rounded-xl border border-foil-navy/15 bg-foil-cream px-4 py-2 text-sm font-medium text-foil-navy transition hover:border-foil-gold/50 hover:bg-foil-gold/5"
            >
              {allPaused ? "Resume all alerts" : "Pause all alerts"}
            </button>
          </form>
        )}
      </header>

      {rows.length === 0 ? (
        <section className="mt-10 rounded-3xl border border-foil-navy/10 bg-foil-cream p-8 text-center shadow-sm shadow-foil-navy/5">
          <p className="font-display text-xl font-bold text-foil-navy">
            Add the first card you&apos;re hunting.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-foil-slate">
            Search any card below — we&apos;ll watch eBay for you and email you the moment a
            verified listing hits your target.
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
                  // The pocket: faint plastic-sleeve depth — inset ring +
                  // top-light. Flat at rest beyond that (DESIGN.md).
                  className="rounded-2xl border border-foil-navy/10 bg-foil-cream p-3 shadow-[inset_0_1px_3px_rgba(15,30,58,0.08),inset_0_-1px_2px_rgba(255,255,255,0.7)]"
                >
                  <div className="relative overflow-hidden rounded-xl bg-foil-navy/5">
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
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        paused
                          ? "bg-foil-navy/70 text-foil-cream"
                          : row.alert_state === "fired"
                            ? "bg-foil-gold/90 text-foil-navy"
                            : "bg-foil-cream/90 text-foil-navy ring-1 ring-foil-navy/15"
                      }`}
                    >
                      {stateLabel}
                    </span>
                  </div>

                  <div className="mt-3 px-1">
                    <p className="truncate text-sm font-semibold text-foil-navy">
                      {meta?.name ?? row.card_slug}
                    </p>
                    <p className="truncate font-mono text-[11px] uppercase tracking-wider text-foil-slate">
                      {meta?.setName ?? ""} {meta?.number ? `· #${meta.number}` : ""}
                    </p>

                    {/* The market brain, set quietly beneath the card. */}
                    <p className="mt-2 text-xs text-foil-slate">
                      {row.last_seen_price_cents != null ? (
                        <>Last verified listing: <span className="font-mono tabular-nums text-foil-navy">{usd(row.last_seen_price_cents)}</span></>
                      ) : (
                        <>Not checked yet — first look within the hour.</>
                      )}
                    </p>
                    <p className="text-xs text-foil-slate">
                      {soldCents ? (
                        <>Sold for ~{usd(soldCents)} recently</>
                      ) : (
                        <>No recent sold data yet</>
                      )}
                      {effective != null && row.target_price_cents == null ? (
                        <> · alerting {usd(effective)} or less</>
                      ) : null}
                    </p>

                    <form action={vaultUpdateTarget} className="mt-2 flex items-center gap-1.5">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="row_id" value={row.id} />
                      <span className="text-xs text-foil-slate">$</span>
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
                        className="w-16 rounded-lg border border-foil-navy/15 bg-white/60 px-2 py-1 text-right text-xs text-foil-navy placeholder:text-foil-slate/60 outline-none focus:border-foil-gold focus:ring-1 focus:ring-foil-gold/30"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-foil-navy/15 px-2 py-1 text-[11px] font-medium text-foil-navy transition hover:border-foil-gold/50 hover:bg-foil-gold/5"
                      >
                        Save
                      </button>
                    </form>

                    <div className="mt-2 flex items-center gap-2">
                      {complaintLocked ? (
                        <span className="text-[11px] text-foil-slate" title="Alerts for this address were stopped after a spam report; they can't be resumed from this page.">
                          Alerts off
                        </span>
                      ) : (
                        <form action={paused ? vaultResumeCard : vaultPauseCard}>
                          <input type="hidden" name="token" value={token} />
                          <input type="hidden" name="row_id" value={row.id} />
                          <button
                            type="submit"
                            className="text-[11px] font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-2 transition hover:decoration-foil-gold"
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
                          className="text-[11px] text-foil-slate underline decoration-foil-navy/15 underline-offset-2 transition hover:text-foil-navy hover:decoration-foil-gold"
                        >
                          Remove
                        </button>
                      </form>
                      <Link
                        href={`/cards/${row.card_slug}`}
                        className="ml-auto text-[11px] font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-2 transition hover:decoration-foil-gold"
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
            <Link href={`${vaultPath}?p=${page - 1}`} className="font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold">
              ← Turn back
            </Link>
          ) : (
            <span />
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider text-foil-slate">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`${vaultPath}?p=${page + 1}`} className="font-medium text-foil-navy underline decoration-foil-navy/20 underline-offset-4 transition hover:decoration-foil-gold">
              Turn page →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {/* Add cards in place — the SAME shared type-ahead as /start (no fork). */}
      <section className="mt-12 rounded-3xl border border-foil-navy/10 bg-foil-cream p-6 shadow-sm shadow-foil-navy/5 sm:p-8" aria-labelledby="vault-add-heading">
        <h2 id="vault-add-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-gold">
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

      <p className="mt-8 text-[11px] text-foil-slate">
        This page is private to this link — anyone who has it can view and edit your vault.
        Alerts go to the email this vault belongs to.
      </p>
    </main>
  );
}
