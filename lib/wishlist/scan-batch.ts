// Pure wishlist scan orchestrator — testable in isolation. The cron route
// (app/api/cron/wishlist-alerts/route.ts) is the only caller; it injects
// the live Supabase admin client, getBestListing, and sendEmail. Tests
// inject fakes via the same shape.
//
// Responsibilities of this module — and ONLY these:
//   1. Pull all watchlist rows due for evaluation (NULL or stale
//      last_notified_at).
//   2. Deduplicate Browse API calls per card_slug — one Browse call per
//      slug per run regardless of how many rows watch it.
//   3. Cap total Browse calls at MAX_BROWSE_CALLS to stay under the daily
//      eBay quota (see ADR-024).
//   4. For each row whose target meets the current best price, send an
//      email and stamp last_notified_at.
//   5. Soft-fail per row — one Resend hiccup must not break the rest of
//      the batch.
//
// Out of scope (these belong upstream/downstream):
//   - HTTP auth (the route handler).
//   - Discord summary post (the route handler).
//   - Card metadata enrichment (catalog lookup happens here, but only as a
//     read of the same in-process module — no network).

import type { EpnBestListing, GetBestListingInput } from "../affiliate/epn.ts";
import { getCatalogEntry } from "../cards/catalog.ts";
import { getCardMetadata, type CardMetadata } from "../cards/sdk.ts";
import { emailBody, subjectLine, type WishlistEmailInputs } from "./alert-email.ts";

export const MAX_BROWSE_CALLS = 200;
export const COOLDOWN_HOURS = 24;

export type WatchlistRow = {
  id: string;
  email: string;
  card_slug: string;
  target_price_cents: number;
  last_notified_at: string | null;
};

export type SupabaseLike = {
  /** Fetch all rows due for evaluation. The cron route filters in SQL via
   *  `last_notified_at IS NULL OR last_notified_at < now() - interval`;
   *  tests stub this directly. */
  fetchDueRows(now: Date): Promise<{ rows: WatchlistRow[]; error: string | null }>;
  /** Stamp last_notified_at for a single row. Soft-fail per row. */
  markNotified(rowId: string, when: Date): Promise<{ error: string | null }>;
};

export type SendEmailFn = (input: {
  to: string;
  subject: string;
  html: string;
}) => Promise<{ ok: boolean; error?: string }>;

export type GetBestListingFn = (input: GetBestListingInput) => Promise<EpnBestListing | null>;

export type GetCardMetadataFn = (input: { id: string }) => Promise<CardMetadata>;

export type ScanWatchlistsInput = {
  supabase: SupabaseLike;
  getBestListing: GetBestListingFn;
  sendEmail: SendEmailFn;
  /** Override for the catalog metadata fetch — tests inject a stub. */
  getCardMetadata?: GetCardMetadataFn;
  /** Override Date.now() — tests pin a deterministic "now". */
  now?: Date;
  /** Absolute base for the card-page link in the email body. */
  siteUrl: string;
  /** Override the Browse-call cap — test-only knob; production uses
   *  MAX_BROWSE_CALLS. */
  maxBrowseCalls?: number;
};

export type ScanError = {
  rowId?: string;
  cardSlug?: string;
  stage: "fetch_rows" | "browse" | "send" | "mark_notified" | "metadata" | "catalog_lookup";
  error: string;
};

export type ScanResult = {
  /** Rows pulled from Supabase that were due for evaluation. */
  rowsScanned: number;
  /** Distinct card_slugs in the scan (= max Browse calls we would have made). */
  slugsConsidered: number;
  /** Browse API calls actually issued (capped at MAX_BROWSE_CALLS). */
  browseCalls: number;
  /** Rows that triggered an alert email + stamped last_notified_at. */
  alerted: number;
  /** Distinct slugs whose getBestListing returned a value. */
  slugsWithListing: number;
  /** Errors gathered as we go — never thrown. */
  errors: ScanError[];
  /** True when we hit MAX_BROWSE_CALLS and skipped the rest of the slugs. */
  capHit: boolean;
};

/**
 * Run one wishlist scan-and-alert pass. Soft-fails everywhere; returns an
 * aggregated count shape the caller can post to Discord.
 */
export async function scanWatchlists(input: ScanWatchlistsInput): Promise<ScanResult> {
  const now = input.now ?? new Date();
  const result: ScanResult = {
    rowsScanned: 0,
    slugsConsidered: 0,
    browseCalls: 0,
    alerted: 0,
    slugsWithListing: 0,
    errors: [],
    capHit: false,
  };

  const fetched = await input.supabase.fetchDueRows(now);
  if (fetched.error) {
    result.errors.push({ stage: "fetch_rows", error: fetched.error });
    return result;
  }
  result.rowsScanned = fetched.rows.length;

  // Group rows by card_slug — one Browse call per slug regardless of how
  // many rows watch it. Within each slug, keep the rows so we can per-row
  // compare against target_price_cents.
  const bySlug = new Map<string, WatchlistRow[]>();
  for (const row of fetched.rows) {
    const list = bySlug.get(row.card_slug) ?? [];
    list.push(row);
    bySlug.set(row.card_slug, list);
  }
  result.slugsConsidered = bySlug.size;

  const cap = input.maxBrowseCalls ?? MAX_BROWSE_CALLS;

  // Iterate slugs in insertion order — deterministic ordering for the cap.
  for (const [slug, rows] of bySlug) {
    if (result.browseCalls >= cap) {
      result.capHit = true;
      break;
    }

    const catalogEntry = getCatalogEntry(slug);
    if (!catalogEntry) {
      result.errors.push({
        cardSlug: slug,
        stage: "catalog_lookup",
        error: "slug_not_in_catalog",
      });
      continue;
    }

    let metadata: CardMetadata;
    try {
      const fetchMetadata = input.getCardMetadata ?? getCardMetadata;
      metadata = await fetchMetadata({ id: catalogEntry.pokemonTcgId });
    } catch (err) {
      result.errors.push({
        cardSlug: slug,
        stage: "metadata",
        error: (err as Error).message,
      });
      continue;
    }

    result.browseCalls += 1;
    let listing: EpnBestListing | null;
    try {
      listing = await input.getBestListing({
        cardName: metadata.name,
        setName: metadata.setName,
        customId: "foil-wishlist-alert",
        surface: "wishlist_cron",
      });
    } catch (err) {
      result.errors.push({
        cardSlug: slug,
        stage: "browse",
        error: (err as Error).message,
      });
      continue;
    }
    if (!listing) continue;
    result.slugsWithListing += 1;

    // Per-row threshold check + send.
    const currentPriceCents = Math.round(listing.price * 100);
    for (const row of rows) {
      if (currentPriceCents > row.target_price_cents) continue;

      const inputs: WishlistEmailInputs = {
        cardName: metadata.name,
        setName: metadata.setName,
        cardSlug: slug,
        listing,
        targetPriceCents: row.target_price_cents,
        cardImage: metadata.image || null,
        cardPageUrl: `${input.siteUrl.replace(/\/$/, "")}/cards/${slug}`,
      };
      const sendResult = await input.sendEmail({
        to: row.email,
        subject: subjectLine(inputs),
        html: emailBody(inputs),
      });
      if (!sendResult.ok) {
        result.errors.push({
          rowId: row.id,
          cardSlug: slug,
          stage: "send",
          error: sendResult.error ?? "send_failed",
        });
        continue;
      }
      const stamped = await input.supabase.markNotified(row.id, now);
      if (stamped.error) {
        result.errors.push({
          rowId: row.id,
          cardSlug: slug,
          stage: "mark_notified",
          error: stamped.error,
        });
        // Still count as alerted — email went out. The cooldown stamp
        // failure surfaces in the error list so we notice.
      }
      result.alerted += 1;
    }
  }

  return result;
}
