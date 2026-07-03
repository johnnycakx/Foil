// Pure wishlist scan orchestrator — testable in isolation. The cron route
// (app/api/cron/wishlist-alerts/route.ts) is the only caller; it injects
// the live Supabase admin client, the VERIFIED resolver, the sold-comp
// reader, and sendEmail. Tests inject fakes via the same shape.
//
// REBUILT on the honest event model (alert-engine-rebuild, ADR-091). The old
// sole trigger `price <= target` re-alerted a below-target card ~daily
// forever, each email claiming it "just dropped." Now:
//   - lib/wishlist/alert-decision.ts owns WHEN to fire (armed/fired state,
//     effective target = max(user target, 15% under 30-day sold avg),
//     hysteresis re-arm, honest kind: dropped vs already_below);
//   - this module owns the batch mechanics: row fetch, per-combo resolve
//     dedup, the Browse-call cap, the USD gate, baseline writes on EVERY
//     evaluation, send + state transitions;
//   - the resolver's identity gates stay the ONLY path to an email (an
//     unverified or null resolve never alerts — kept from the Tranche-A
//     migration, it's good);
//   - currency: the Browse filter excludes non-USD at the API
//     (BROWSE_MARKETPLACE_FILTER), and this module re-checks explicitly —
//     a GBP figure must never be compared to a USD target (fixture 12).
//
// Out of scope (these belong upstream/downstream):
//   - HTTP auth + the Discord summary (the route handler).
//   - Deciding WHEN an alert fires (alert-decision.ts).
//   - Composing the email (alert-email.ts — thin honest ping).

import { getCatalogEntry } from "../cards/catalog.ts";
import { getCardMetadata, type CardMetadata } from "../cards/sdk.ts";
import {
  batchEmailBody,
  batchSubjectLine,
  emailBody,
  subjectLine,
  type AlertEmailInputs,
} from "./alert-email.ts";
import { decideAlert, type AlertState, type SoldComp } from "./alert-decision.ts";
import { assessAlertPlausibility } from "./alert-plausibility.ts";
import { buildUnsubscribeUrl } from "../unsubscribe-token.ts";
import { buildVaultUrl } from "../vault-token.ts";
import { labelForVariantKey, DEFAULT_VARIANT_KEY } from "../poketrace/variant.ts";
import { conditionLabel, DEFAULT_CONDITION } from "../cards/conditions.ts";
import { buildCustomId } from "../affiliate/epn.ts";
import type { ResolveCondition, ResolveOpts, VerifiedListing } from "../listing/resolve.ts";
import { resolveConditionForToken, verifiedListingMatchesToken } from "../listing/condition-map.ts";

export const MAX_BROWSE_CALLS = 200;
export const COOLDOWN_HOURS = 24;

export type WatchlistRow = {
  id: string;
  email: string;
  card_slug: string;
  /** null = blank target ("alert at >=15% under the 30-day sold average"). */
  target_price_cents: number | null;
  /** PoketraceVariant.variantKey or "default" (Session 49b / ADR-043). */
  variant: string;
  /** Condition token (lib/cards/conditions.ts) or "any-raw". */
  condition: string;
  last_notified_at: string | null;
  /** Event-model state (ADR-091). */
  last_seen_price_cents: number | null;
  alert_state: AlertState;
};

/** Per-row state patch the scan writes back. `last_seen_price_cents` is set
 *  on EVERY evaluated row (baseline freshness); the rest only on transitions. */
export type WatchStatePatch = {
  last_seen_price_cents: number;
  alert_state?: AlertState;
  last_alerted_price_cents?: number;
  last_notified_at?: string;
};

export type SupabaseLike = {
  /** Fetch all rows due for evaluation. The cron route filters in SQL via
   *  `alerts_paused_at IS NULL` + the 24h cooldown backstop on
   *  last_notified_at; tests stub this directly. */
  fetchDueRows(now: Date): Promise<{ rows: WatchlistRow[]; error: string | null }>;
  /** Apply a state patch to one row. Soft-fail per row. */
  updateWatchState(rowId: string, patch: WatchStatePatch): Promise<{ error: string | null }>;
};

export type SendEmailFn = (input: {
  to: string;
  subject: string;
  html: string;
}) => Promise<{ ok: boolean; error?: string }>;

/** The verified resolver (resolveVerifiedListing) — injected for tests. */
export type ResolveListingFn = (
  cardId: string,
  condition: ResolveCondition,
  opts?: ResolveOpts,
) => Promise<VerifiedListing | null>;

export type GetCardMetadataFn = (input: { id: string }) => Promise<CardMetadata>;

/** 30-day sold comp for a slug (market_movers cache) — injected for tests.
 *  Return null when no fresh comp exists; the decision layer handles both. */
export type GetSoldCompFn = (cardSlug: string) => Promise<SoldComp | null>;

export type ScanWatchlistsInput = {
  supabase: SupabaseLike;
  resolveListing: ResolveListingFn;
  sendEmail: SendEmailFn;
  getSoldComp: GetSoldCompFn;
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
  stage:
    | "fetch_rows"
    | "browse"
    | "send"
    | "update_state"
    | "metadata"
    | "catalog_lookup"
    | "sold_comp";
  error: string;
};

export type ScanResult = {
  /** Rows pulled from Supabase that were due for evaluation. */
  rowsScanned: number;
  /** Distinct card_slugs in the scan. */
  slugsConsidered: number;
  /** Browse API calls actually issued — 1 search + 1 per verified candidate
   *  evaluated, counted from the resolver trace (capped at MAX_BROWSE_CALLS). */
  browseCalls: number;
  /** Rows that fired an alert email this run. */
  alerted: number;
  /** Distinct slugs where the resolver returned a VERIFIED listing. */
  slugsWithListing: number;
  /** Fired rows that re-armed this run (price exited the hysteresis band). */
  rearmed: number;
  /** Combos skipped because the verified listing wasn't USD (belt-and-braces
   *  behind the Browse filter — should stay 0; nonzero means the filter and
   *  the payload disagree, worth investigating). */
  skippedNonUsd: number;
  /** Blank-target rows held because no usable sold comp existed. */
  heldNoBasis: number;
  /** Errors gathered as we go — never thrown. */
  errors: ScanError[];
  /** True when we hit MAX_BROWSE_CALLS and skipped the rest of the slugs. */
  capHit: boolean;
  /** Distinct subscribers who received an email this run (alert-digest-
   *  batching: exactly one email per subscriber per run). */
  subscribersEmailed: number;
  /** Same-(subscriber, card) fire events merged into one digest entry this
   *  run (the two-Blastoise-emails class — different variant/condition combos
   *  firing independently for one card). */
  dupesMerged: number;
  /** Fires suppressed by the plausibility guard (ADR-103): too-good-to-be-
   *  true listings logged + counted here, never mailed. One entry per
   *  suppressed (slug, price) — the caller posts these to #errors. */
  suppressedImplausible: {
    cardSlug: string;
    priceCents: number;
    basisCents: number;
    reason: string;
    detail: string;
  }[];
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
    rearmed: 0,
    skippedNonUsd: 0,
    heldNoBasis: 0,
    errors: [],
    capHit: false,
    subscribersEmailed: 0,
    dupesMerged: 0,
    suppressedImplausible: [],
  };

  // Per-run send buffer (alert-digest-batching): fired alerts collect here,
  // keyed subscriber → card, and flush as ONE email per subscriber after the
  // scan. Engine logic upstream (hysteresis, thresholds, eligibility) is
  // untouched — this is strictly the send boundary.
  type PendingAlert = {
    cardSlug: string;
    inputs: AlertEmailInputs;
    rows: { rowId: string; alertedPriceCents: number }[];
  };
  const pending = new Map<string, Map<string, PendingAlert>>();

  const fetched = await input.supabase.fetchDueRows(now);
  if (fetched.error) {
    result.errors.push({ stage: "fetch_rows", error: fetched.error });
    return result;
  }
  result.rowsScanned = fetched.rows.length;

  // Group rows by card_slug — one metadata fetch + one comp read per slug
  // regardless of how many rows watch it.
  const bySlug = new Map<string, WatchlistRow[]>();
  for (const row of fetched.rows) {
    const list = bySlug.get(row.card_slug) ?? [];
    list.push(row);
    bySlug.set(row.card_slug, list);
  }
  result.slugsConsidered = bySlug.size;

  const cap = input.maxBrowseCalls ?? MAX_BROWSE_CALLS;

  // Iterate slugs in insertion order — deterministic ordering for the cap.
  // Within a slug, rows are sub-grouped by (variant, condition) because each
  // combo is a DIFFERENT eBay query (Session 49b / ADR-043).
  for (const [slug, slugRows] of bySlug) {
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

    // One sold-comp read per slug (market_movers cache; soft-fail to null —
    // the decision layer treats "no comp" honestly).
    let comp: SoldComp | null = null;
    try {
      comp = await input.getSoldComp(slug);
    } catch (err) {
      result.errors.push({ cardSlug: slug, stage: "sold_comp", error: (err as Error).message });
    }

    // Sub-group this slug's rows by (variant, condition).
    const byCombo = new Map<string, WatchlistRow[]>();
    for (const row of slugRows) {
      const key = `${row.variant} ${row.condition}`;
      const list = byCombo.get(key) ?? [];
      list.push(row);
      byCombo.set(key, list);
    }

    let slugHadListing = false;
    for (const comboRows of byCombo.values()) {
      if (result.browseCalls >= cap) {
        result.capHit = true;
        break;
      }
      const { variant, condition } = comboRows[0];

      const resolveCondition = resolveConditionForToken(condition);
      if (!resolveCondition) {
        result.errors.push({
          cardSlug: slug,
          stage: "browse",
          error: `unknown_condition_token: ${condition}`,
        });
        continue;
      }

      // A resolve spends 1 search + one getItem per evaluated candidate (≤k=4).
      result.browseCalls += 1;
      let listing: VerifiedListing | null;
      try {
        listing = await input.resolveListing(slug, resolveCondition, {
          requestedVariant: variant && variant !== DEFAULT_VARIANT_KEY ? variant : undefined,
          customId: buildCustomId({ tier: "wishlist", slug }),
          surface: "wishlist_cron",
          onTrace: (trace) => {
            result.browseCalls += trace.candidates.filter((c) => c.verdict !== "no_item_id").length;
          },
        });
      } catch (err) {
        result.errors.push({
          cardSlug: slug,
          stage: "browse",
          error: (err as Error).message,
        });
        continue;
      }
      // Honest null (or an unverifiable listing) NEVER fires an alert — the
      // resolver's identity gates are the only path to an email.
      if (!listing) continue;
      // bgs-10-bl: Black Label isn't verifiable from item specifics — narrow by
      // title (suppression only; can never admit an unverified listing).
      if (!verifiedListingMatchesToken(condition, listing.title)) continue;

      // Currency gate (belt and braces behind the Browse filter): a non-USD
      // figure must never be converted to "cents" against a USD target — the
      // fixture-12 GBP false-alert class. Skip + count; no baseline write
      // (a GBP price is not an observation on the USD axis).
      if ((listing.currency ?? "USD") !== "USD") {
        result.skippedNonUsd += 1;
        continue;
      }

      if (!slugHadListing) {
        result.slugsWithListing += 1;
        slugHadListing = true;
      }

      const currentPriceCents = Math.round(listing.price * 100);
      const variantLabel =
        variant && variant !== DEFAULT_VARIANT_KEY ? labelForVariantKey(variant) : undefined;
      const condLabel =
        condition && condition !== DEFAULT_CONDITION ? conditionLabel(condition) : undefined;

      for (const row of comboRows) {
        const decision = decideAlert(
          {
            targetPriceCents: row.target_price_cents,
            lastSeenPriceCents: row.last_seen_price_cents,
            alertState: row.alert_state,
            condition: row.condition,
          },
          currentPriceCents,
          comp,
        );

        // Baseline freshness: EVERY evaluated row records what we saw, and
        // any state transition (fire / re-arm) rides the same patch.
        const patch: WatchStatePatch = { last_seen_price_cents: currentPriceCents };

        if (decision.action === "hold") {
          if (decision.reason === "rearmed") {
            patch.alert_state = "armed";
            result.rearmed += 1;
          }
          if (decision.reason === "no_basis") result.heldNoBasis += 1;
          const wrote = await input.supabase.updateWatchState(row.id, patch);
          if (wrote.error) {
            result.errors.push({ rowId: row.id, cardSlug: slug, stage: "update_state", error: wrote.error });
          }
          continue;
        }

        // PLAUSIBILITY GUARD (ADR-103) — the filter in front of the send.
        // Too-good-to-be-true is a red flag, not a deal: a fire whose price
        // is implausible against the condition-matched sold basis (or,
        // basis-less, against the user's own target) is suppressed + logged,
        // never mailed. The observation still records (we DID see the price);
        // the row stays armed (fired stamps only happen at flush) — engine
        // hysteresis untouched.
        const verdict = assessAlertPlausibility({
          currentPriceCents,
          comp,
          targetPriceCents: row.target_price_cents,
        });
        if (!verdict.plausible) {
          result.suppressedImplausible.push({
            cardSlug: slug,
            priceCents: currentPriceCents,
            basisCents: verdict.basisCents,
            reason: verdict.reason,
            detail: verdict.detail,
          });
          const seen = await input.supabase.updateWatchState(row.id, patch);
          if (seen.error) {
            result.errors.push({ rowId: row.id, cardSlug: slug, stage: "update_state", error: seen.error });
          }
          continue;
        }

        // Fire — batched at the send boundary (alert-digest-batching). The
        // OBSERVATION is recorded now, per row, exactly as on hold paths; the
        // email is buffered per subscriber and flushed once after the scan.
        // The 'fired' stamp moves to flush time so a failed send leaves the
        // row armed (unchanged retry semantics).
        const observed = await input.supabase.updateWatchState(row.id, patch);
        if (observed.error) {
          result.errors.push({ rowId: row.id, cardSlug: slug, stage: "update_state", error: observed.error });
        }

        const emailInputs: AlertEmailInputs = {
          cardName: metadata.name,
          setName: metadata.setName,
          kind: decision.kind,
          basis: decision.basis,
          currentPriceCents,
          targetPriceCents: row.target_price_cents,
          comp,
          cardPageUrl: `${input.siteUrl.replace(/\/$/, "")}/cards/${slug}`,
          unsubscribeUrl: buildUnsubscribeUrl(row.email, { baseUrl: input.siteUrl }),
          manageUrl: buildVaultUrl(row.email, { baseUrl: input.siteUrl }),
          variantLabel,
          conditionLabel: condLabel,
        };

        const byCard = pending.get(row.email) ?? new Map<string, PendingAlert>();
        const existing = byCard.get(slug);
        if (existing) {
          // DEDUPE per (subscriber, card): two combo rows for the same card
          // firing in one run merge to ONE digest entry (the two-Blastoise-
          // emails class). The explicit-target framing wins the copy (its body
          // already carries the market evidence line); "dropped" outranks
          // "already_below" within the same basis. EVERY merged row still gets
          // its own fired stamp at flush, at its own observed price.
          result.dupesMerged += 1;
          existing.rows.push({ rowId: row.id, alertedPriceCents: currentPriceCents });
          const takeover =
            (emailInputs.basis === "target" && existing.inputs.basis !== "target") ||
            (emailInputs.basis === existing.inputs.basis &&
              emailInputs.kind === "dropped" &&
              existing.inputs.kind !== "dropped");
          if (takeover) existing.inputs = emailInputs;
        } else {
          byCard.set(slug, {
            cardSlug: slug,
            inputs: emailInputs,
            rows: [{ rowId: row.id, alertedPriceCents: currentPriceCents }],
          });
          pending.set(row.email, byCard);
        }
      }
    }

    if (result.capHit) break;
  }

  // Flush — ONE email per subscriber per run (alert-digest-batching). n=1
  // renders the existing single-card email verbatim; n>1 renders the batched
  // digest, most significant first. One subscriber's failure never blocks the
  // rest. Idempotency is unchanged: rows stamp 'fired' + last_notified_at only
  // after a successful send, so re-running the send step resends nothing (the
  // fetch filter + state machine both exclude stamped rows).
  for (const [email, byCard] of pending) {
    const entries = [...byCard.values()];
    const inputsList = entries.map((e) => e.inputs);
    const message =
      entries.length === 1
        ? { subject: subjectLine(inputsList[0]), html: emailBody(inputsList[0]) }
        : { subject: batchSubjectLine(entries.length), html: batchEmailBody(inputsList) };
    const sendResult = await input.sendEmail({ to: email, ...message });
    if (!sendResult.ok) {
      for (const entry of entries) {
        for (const r of entry.rows) {
          result.errors.push({
            rowId: r.rowId,
            cardSlug: entry.cardSlug,
            stage: "send",
            error: sendResult.error ?? "send_failed",
          });
        }
      }
      // Send failed: observations were already recorded; state stays armed so
      // the next scan retries (honestly as "already below" — the cross is spent).
      continue;
    }
    result.subscribersEmailed += 1;
    for (const entry of entries) {
      for (const r of entry.rows) {
        result.alerted += 1;
        const stamped = await input.supabase.updateWatchState(r.rowId, {
          // WatchStatePatch always carries the observation; re-writing the
          // same observed price here is a no-op refresh, not a new reading.
          last_seen_price_cents: r.alertedPriceCents,
          alert_state: "fired",
          last_alerted_price_cents: r.alertedPriceCents,
          last_notified_at: now.toISOString(),
        });
        if (stamped.error) {
          result.errors.push({
            rowId: r.rowId,
            cardSlug: entry.cardSlug,
            stage: "update_state",
            error: stamped.error,
          });
          // Still counted as alerted — the email went out; the failed stamp
          // surfaces in the error list so we notice.
        }
      }
    }
  }

  return result;
}
