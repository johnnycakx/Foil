// Notify pending card requests whose card has LANDED (quality-bar-fixes
// P0-4, the "email the person when data lands" leg of request-tracking V1).
//
// Runs at the tail of .github/workflows/daily-catalog-bake.yml, right after
// the catalog expansion + bake: match each pending card_requests row's query
// against the (freshly expanded) local catalog; on a hit, send ONE
// transactional email ("Foil now tracks it") with the card-page link and
// flip the row to notified. The same searchLocalCatalog the live search
// route uses does the matching — one resolver, no drift.
//
// Honesty rules: match conservatively (top hit must score on every token —
// searchLocalCatalog already requires that), email links the exact card
// page, and a request that still doesn't match stays pending silently (it
// gets re-checked every day as the catalog grows).
//
// Soft-fail end to end: a Resend outage leaves rows pending for tomorrow's
// run; a Supabase outage exits 0 with a log line (the bake commit must not
// fail because the notifier couldn't run).
//
// Usage: node --experimental-strip-types scripts/notify-card-requests.ts [--dry-run]

import { createClient } from "@supabase/supabase-js";
import { searchLocalCatalog } from "../lib/cards/local-search.ts";
import { CARD_CATALOG } from "../lib/cards/catalog.ts";
import { sendTransactionalEmail } from "../lib/notifications/resend.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://foiltcg.com";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("[notify-card-requests] Supabase env missing — skipping (soft-fail).");
  process.exit(0);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const slugById = new Map(CARD_CATALOG.map((e) => [e.pokemonTcgId, e.slug]));

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const { data, error } = await admin
  .from("card_requests")
  .select("id, query, email")
  .eq("status", "pending")
  .order("created_at", { ascending: true })
  .limit(200);

if (error) {
  console.log(`[notify-card-requests] read failed (soft-fail): ${error.message}`);
  process.exit(0);
}

let notified = 0;
let stillPending = 0;

for (const row of data ?? []) {
  const hits = searchLocalCatalog(row.query, 1);
  const hit = hits[0];
  const slug = hit ? slugById.get(hit.id) : undefined;
  if (!hit || !slug) {
    stillPending++;
    continue;
  }
  const cardUrl = `${SITE}/cards/${slug}`;
  if (DRY_RUN) {
    console.log(`[dry-run] would notify ${row.email}: "${row.query}" → ${hit.name} (${cardUrl})`);
    notified++;
    continue;
  }
  // SECURITY (2026-07-13 review, M1): the email must carry ZERO
  // requester-authored text. The stored query drove the MATCH; the body
  // speaks only in catalog terms (card name, set, our URL) so this can
  // never relay an attacker-composed message to an unverified address.
  const sent = await sendTransactionalEmail({
    to: row.email,
    subject: `Foil now tracks ${hit.name} (${hit.setName})`,
    html: [
      `<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.6; color: #1a2333; background: #ffffff;">`,
      `<p style="font-size: 13px; color: #556; margin: 0 0 12px;">You asked Foil to hunt a card down. It did.</p>`,
      `<p style="font-size: 16px; margin: 0 0 8px;"><strong>${escapeHtml(hit.name)} (${escapeHtml(hit.setName)}) is on Foil now.</strong></p>`,
      `<p style="font-size: 14px; color: #445; margin: 0 0 16px;">Foil tracks this card's real sold prices from here on, and you can set a price watch in one tap.</p>`,
      `<p style="font-size: 15px; margin: 0 0 24px;"><a href="${escapeHtml(cardUrl)}" style="color: #0F1E3A; text-decoration: underline; text-underline-offset: 3px; font-weight: 600;">See the card and set your watch on Foil</a></p>`,
      `<p style="font-size: 11px; color: #99a; line-height: 1.5; margin: 0;">One email, as promised. Foil only writes again if you set a watch. If you didn't ask for this, ignore it and Foil stays quiet.</p>`,
      `</body></html>`,
    ].join("\n"),
  });
  if (!sent.ok) {
    console.log(`[notify-card-requests] send failed for ${row.id} (${sent.error}) — stays pending.`);
    stillPending++;
    continue;
  }
  const { error: updErr } = await admin
    .from("card_requests")
    .update({ status: "notified", notified_at: new Date().toISOString(), matched_slug: slug })
    .eq("id", row.id);
  if (updErr) {
    console.log(`[notify-card-requests] mark failed for ${row.id}: ${updErr.message}`);
  }
  notified++;
}

console.log(`[notify-card-requests] notified=${notified} stillPending=${stillPending}`);
