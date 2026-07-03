// The SEEDED vault view (eve-vault, ADR-100; TEMPLATE model per the
// eve-vault-template-claims amendment) — a pre-made gift vault rendered from
// repo config (lib/vault-seeds.ts) + live sold data. The link lives in a
// PUBLIC reply, so the vault is a template: EVERY visitor can claim their own
// copy (their email gets its own watch-set via the real funnel machinery).
// Rendered by /w/[token]/page.tsx when the token verifies in the SEEDED
// context (never the email context — lib/vault-token.ts separates them).
//
// The page NEVER locks. Post-submit state is per-visitor (the ?c= flag on the
// action's redirect): a "check your email" confirmation for the submitter,
// then the next visitor with the clean URL sees the claimable state again.
// No claimed-by-someone-else state exists.
//
// Quota discipline matches the real vault (R-012): no live eBay resolve —
// sold figures come from ONE market_movers read with the committed /lines
// bake as fallback (every seed pocket is guaranteed sold data by the
// vault-seeds navigation-promise test; no stub pockets on a gift).

import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCatalogEntry } from "@/lib/cards/catalog";
import { getBakedCardMetadata } from "@/lib/cards/sdk";
import { effectiveTargetCents } from "@/lib/wishlist/alert-decision";
import { getSnapshotSold, type SeededVault } from "@/lib/vault-seeds";
import { claimSeededVault } from "@/app/actions/seeded-vault";
import { SakuraAmbience } from "@/components/sakura-ambience";

function usdWhole(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

export async function SeededVaultView({
  vault,
  token,
  claimFlag,
}: {
  vault: SeededVault;
  token: string;
  claimFlag?: string;
}) {
  let admin: SupabaseClient | null = null;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    // No DB → render with snapshot sold data; the claim form still posts
    // (the action re-checks and flags err). The gift page must load.
  }

  // One movers read for live sold averages; committed bake as fallback.
  const soldBySlug = new Map<string, { soldCents: number; saleCount: number }>();
  if (admin) {
    const { data: movers } = await admin
      .from("market_movers")
      .select("card_slug, avg30d, sample_size")
      .in("card_slug", vault.pockets);
    for (const m of movers ?? []) {
      if (typeof m.avg30d === "number" && m.avg30d > 0) {
        soldBySlug.set(m.card_slug as string, {
          soldCents: Math.round((m.avg30d as number) * 100),
          saleCount: typeof m.sample_size === "number" ? (m.sample_size as number) : 0,
        });
      }
    }
  }

  const pockets = vault.pockets.map((slug) => {
    const entry = getCatalogEntry(slug);
    const meta = entry ? getBakedCardMetadata(entry.pokemonTcgId) : null;
    const sold = soldBySlug.get(slug) ?? getSnapshotSold(slug);
    const effective = sold
      ? effectiveTargetCents(
          null,
          { avg30dCents: sold.soldCents, saleCount: sold.saleCount, tierLabel: "Near Mint", computedAt: "" },
          "any-raw",
        )
      : null;
    return { slug, meta, sold, effective };
  });

  // Per-visitor post-submit states (the ?c= flag on the action's redirect).
  // The page itself never locks: a fresh visitor with the clean URL always
  // gets the claimable state.
  const justClaimed = claimFlag === "ok";
  const alreadyYours = claimFlag === "again";
  const confirmed = justClaimed || alreadyYours;
  const forkHref = `/start?src=${encodeURIComponent(vault.src)}-fork`;

  return (
    <main
      data-tone="night"
      className="relative mx-auto w-full max-w-5xl flex-1 bg-foil-night px-5 pt-10 pb-20 text-foil-cream sm:px-8 sm:pt-14"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden">
        <SakuraAmbience mode="header" />
      </div>

      <header className="relative max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full border border-foil-accent/40 bg-foil-accent/10 px-3 py-1 text-xs font-medium text-foil-cream">
          <span aria-hidden>🌸</span> Made for {vault.dedication}
        </p>
        <h1 className="font-display mt-4 text-4xl font-bold tracking-[-0.02em] text-foil-cream sm:text-5xl">
          {vault.headline}
        </h1>
        <p className="mt-3 text-base text-foil-cream/70 sm:text-lg">{vault.tagline}</p>
      </header>

      {/* ACTIVATION — the one clear ask, or the per-visitor confirmation. */}
      <section
        aria-labelledby="claim-heading"
        className="relative mt-8 rounded-3xl bg-foil-night-2 p-6 ring-1 ring-foil-accent/30 sm:p-8"
      >
        {confirmed ? (
          <>
            <h2 id="claim-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
              {justClaimed ? "You're in" : "Already watching"}
            </h2>
            <p className="mt-2 text-lg font-semibold text-foil-cream sm:text-xl">
              {justClaimed
                ? "Check your email — your duo is being watched 🌸"
                : "That email is already watching this duo."}
            </p>
            <p className="mt-2 max-w-xl text-sm text-foil-cream/70">
              Alerts go to your inbox when a card genuinely dips, and your private vault
              link — targets, pauses, more cards — travels by email, never through this page.
            </p>
          </>
        ) : (
          <>
            <h2 id="claim-heading" className="text-sm font-semibold uppercase tracking-wider text-foil-accent">
              This vault is yours
            </h2>
            <p className="mt-2 max-w-xl text-lg font-semibold text-foil-cream sm:text-xl">
              Add your email and Foil watches this duo for you.
            </p>
            <p className="mt-2 max-w-xl text-sm text-foil-cream/70">
              We check eBay every hour. No account, no tabs left open — anyone with this
              link can claim their own copy, and the watching starts.
            </p>
            {claimFlag === "invalid" && (
              <p role="alert" className="mt-3 text-sm text-foil-accent">
                That email didn&apos;t look right — try again?
              </p>
            )}
            {claimFlag === "err" && (
              <p role="alert" className="mt-3 text-sm text-foil-accent">
                Something hiccuped on our side. Give it another try in a minute.
              </p>
            )}
            <form action={claimSeededVault} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="token" value={token} />
              {/* Honeypot — off-screen, never announced/tabbable (ADR-090 pattern). */}
              <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@gmail.com"
                aria-label="Your email — claims this vault"
                className="flex-1 rounded-xl border border-foil-cream/15 bg-foil-night px-4 py-3 text-base text-foil-cream placeholder:text-foil-cream/40 outline-none transition focus:border-foil-accent focus:ring-2 focus:ring-foil-accent/30"
              />
              <button
                type="submit"
                className="rounded-xl bg-foil-cream px-6 py-3 text-base font-semibold text-foil-navy shadow-[0_10px_30px_-12px_rgba(4,9,18,0.8)] transition hover:-translate-y-0.5 hover:ring-2 hover:ring-foil-accent/60"
              >
                Claim this vault
              </button>
            </form>
          </>
        )}
      </section>

      {/* THE POCKETS — read-only binder page; targets/pauses live in each
          claimer's personal vault. */}
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
        {pockets.map(({ slug, meta, sold, effective }) => (
          <li
            key={slug}
            className="rounded-2xl bg-foil-night-2 p-3 shadow-[inset_0_1px_3px_rgba(4,9,18,0.7),inset_0_-1px_2px_rgba(248,245,240,0.05)] ring-1 ring-foil-cream/10 transition hover:-translate-y-0.5 hover:ring-foil-cream/30"
          >
            <div className="relative overflow-hidden rounded-xl bg-foil-cream/5">
              {meta?.image ? (
                <Link href={`/cards/${slug}`}>
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
              <span className="absolute right-2 top-2 rounded-full bg-foil-night/85 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foil-accent ring-1 ring-foil-accent/40 backdrop-blur-sm">
                {confirmed ? "Armed" : "Ready"}
              </span>
            </div>
            <div className="mt-3 px-1">
              <p className="truncate text-sm font-semibold text-foil-cream">{meta?.name ?? slug}</p>
              <p className="truncate font-mono text-[11px] uppercase tracking-wider text-foil-cream/50">
                {meta?.setName ?? ""} {meta?.number ? `· #${meta.number}` : ""}
              </p>
              {sold && (
                <p className="mt-2 text-xs text-foil-cream/60">
                  Sold for ~<span className="font-mono tabular-nums text-foil-cream">{usdWhole(sold.soldCents)}</span> recently
                </p>
              )}
              {effective != null && (
                <p className="text-xs text-foil-cream/60">
                  Watching for a real dip — <span className="tabular-nums">{usdWhole(effective)}</span> or less
                </p>
              )}
            </div>
          </li>
        ))}

        {/* The invitation pocket — the binder page holds more than the gift. */}
        <li className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-foil-cream/20 bg-foil-night-2/50 p-6 text-center">
          <span aria-hidden className="text-2xl text-foil-cream/40">+</span>
          <p className="mt-2 text-sm font-medium text-foil-cream/70">
            {confirmed ? "Your next grail goes here" : "Your first pick goes here"}
          </p>
          <p className="mt-1 text-xs text-foil-cream/50">
            {confirmed
              ? "Add cards any time from the vault link in your inbox."
              : "Claim your copy, then add any card you're chasing."}
          </p>
        </li>
      </ul>

      {/* THE FORK — for everyone watching. Quiet by design; the page sells itself. */}
      <p className="mt-10 text-sm text-foil-cream/60">
        Want one like this?{" "}
        <Link
          href={forkHref}
          className="font-medium text-foil-cream underline decoration-foil-cream/25 underline-offset-4 transition hover:text-foil-accent hover:decoration-foil-accent"
        >
          Start your own vault →
        </Link>
      </p>

      <p className="mt-6 text-[11px] text-foil-cream/50">
        This page is public to anyone with the link, and anyone can claim their own copy.
        Price alerts go only to your own inbox, and your private vault link travels by
        email — never through this page. Claiming also signs you up for the weekly Foil
        newsletter; every email has a one-click unsubscribe.
      </p>
    </main>
  );
}
