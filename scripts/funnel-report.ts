// The validation-sprint funnel report (Phase 3, ADR-112). Founder-only terminal
// readout of the THREE signals the bounded ads test measures, from the owned
// source of truth (Supabase). No analytics SaaS.
//
//   npm run funnel-report              # all-time
//   npm run funnel-report -- --days 14 # windowed to the ads run
//
// Signals:
//   1. Signups by utm_source (the inbound channel) — is the offer compelling?
//   2. Trial starts (a card entered — the conviction signal) — will they pay?
//   3. Trial→paid among resolved trials — do they actually pay?
//
// HONESTY: signup% and trial-start% as TRUE rates need the ad platform's clicks
// (the denominator we don't have server-side). This prints the raw COUNTS + the
// one rate we can compute from our data (trial→paid among resolved trials), and
// says so — no invented percentages.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { tallyBy, summarizeSubscriptions, type SignupRow, type SubRow } from "../lib/funnel/aggregate.ts";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[funnel] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function printTally(title: string, entries: Array<[string, number]>, total: number): void {
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log("  (no rows yet)");
    return;
  }
  const width = Math.max(...entries.map(([k]) => k.length), 8);
  for (const [k, n] of entries) {
    const pct = total > 0 ? ((n / total) * 100).toFixed(0) : "0";
    console.log(`  ${k.padEnd(width)}  ${String(n).padStart(5)}  (${pct}% of signups)`);
  }
}

async function main(): Promise<void> {
  const days = arg("days") ? Number(arg("days")) : null;
  const db = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = days && Number.isFinite(days) ? new Date(Date.now() - days * 86_400_000).toISOString() : null;

  // 1. Signups (email captures) by inbound channel. NO unsubscribed filter —
  // a signup is an acquisition EVENT; a later unsubscribe must not erase it
  // from channel attribution (funnel-stress-test 2026-07-11: the filter made
  // an unsubscribed test signup vanish from its channel's count). The
  // unsubscribed tail is reported separately below.
  let sq = db.from("newsletter_subscribers").select("source, utm_source, utm_campaign, created_at, unsubscribed_at");
  if (since) sq = sq.gte("created_at", since);
  const { data: signupData, error: sErr } = await sq;
  if (sErr) { console.error("[funnel] signups query failed:", sErr.message); process.exit(1); }
  const signups = (signupData ?? []) as SignupRow[];
  const unsubscribedCount = signups.filter((r) => r.unsubscribed_at != null).length;

  // 2/3. Subscriptions → trial + paid funnel. The --days window applies here
  // too — without it the flag silently windowed only signal 1.
  let subQ = db.from("subscriptions").select("status, tier, stripe_subscription_id, created_at");
  if (since) subQ = subQ.gte("created_at", since);
  const { data: subData, error: subErr } = await subQ;
  if (subErr) { console.error("[funnel] subscriptions query failed:", subErr.message); process.exit(1); }
  const subs = summarizeSubscriptions((subData ?? []) as SubRow[]);

  console.log(`Validation funnel — ${days ? `last ${days}d` : "all-time"}`);
  console.log(`\n════ Signal 1: email signups (offer compelling?) ════`);
  console.log(`Total signups: ${signups.length}${unsubscribedCount > 0 ? ` (${unsubscribedCount} later unsubscribed)` : ""}`);
  printTally("By utm_source (inbound channel):", tallyBy(signups, (r) => r.utm_source), signups.length);
  printTally("By source (capture surface):", tallyBy(signups, (r) => r.source), signups.length);

  console.log(`\n════ Signal 2: trial starts (card entered — the conviction signal) ════`);
  console.log(`  Trials started (card entered): ${subs.trialsStarted}`);
  console.log(`    · still in trial:  ${subs.trialing}`);
  console.log(`    · converted (paid): ${subs.converted}`);
  console.log(`    · churned:          ${subs.churned}`);

  console.log(`\n════ Signal 3: trial → paid (do they actually pay?) ════`);
  console.log(
    subs.trialToPaidPct == null
      ? "  trial→paid: n/a (no trial has resolved past the 30-day window yet)"
      : `  trial→paid: ${subs.trialToPaidPct.toFixed(0)}% (${subs.converted}/${subs.converted + subs.churned} resolved trials converted)`,
  );

  console.log(
    `\nNote: signup% and trial-start% as TRUE conversion rates need the ad platform's\n` +
      `impressions/clicks as the denominator (not tracked server-side). The counts above\n` +
      `are the honest owned-data view; read a small number of card-entering trials as a\n` +
      `STRONG signal (a card is conviction), not a weak one.`,
  );
}

main().catch((err) => { console.error("[funnel] failed:", err); process.exit(1); });
