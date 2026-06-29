// Founder-only newsletter signups-by-source readout (ADR-084, Acquisition P0).
// Answers "which channel actually converted" from the owned source of truth
// (Supabase newsletter_subscribers). No public surface, no analytics SaaS — a
// terminal script the founder runs with the service-role key.
//
//   npm run subscriber-sources            # active subscribers, all-time
//   npm run subscriber-sources -- --days 14   # signups in the last 14 days
//   npm run subscriber-sources -- --all       # include unsubscribed too
//
// `source` = the capture SURFACE (deals_board, homepage_hero, blog_inline …).
// `utm_source` = the inbound CHANNEL (reddit, x, discord …) from the landing
// URL. Both are stored per signup; this groups by each so a community push is
// measurable from the first link.

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Inline .env.local loader (same pattern as scripts/seed-watchlists.ts).
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
  console.error("[sources] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

type Row = {
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  created_at: string;
  unsubscribed_at: string | null;
};

function tally(rows: Row[], key: (r: Row) => string | null): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? "(none)";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function printTable(title: string, entries: Array<[string, number]>, total: number): void {
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log("  (no rows)");
    return;
  }
  const width = Math.max(...entries.map(([k]) => k.length), 8);
  for (const [k, n] of entries) {
    const pct = total > 0 ? ((n / total) * 100).toFixed(0) : "0";
    console.log(`  ${k.padEnd(width)}  ${String(n).padStart(5)}  (${pct}%)`);
  }
}

async function main(): Promise<void> {
  const includeUnsubbed = flag("all");
  const days = arg("days") ? Number(arg("days")) : null;

  const db = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = db
    .from("newsletter_subscribers")
    .select("source, utm_source, utm_medium, utm_campaign, created_at, unsubscribed_at");
  if (!includeUnsubbed) query = query.is("unsubscribed_at", null);
  if (days && Number.isFinite(days)) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) {
    if (/column .* does not exist/i.test(error.message)) {
      console.error("[sources] the utm_* columns are missing — apply the migration first:");
      console.error("  SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN supabase db push");
    } else {
      console.error("[sources] query failed:", error.message);
    }
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];
  const total = rows.length;

  console.log(
    `Newsletter subscribers — ${includeUnsubbed ? "all (incl. unsubscribed)" : "active"}` +
      (days ? `, last ${days}d` : ", all-time") +
      `\nTotal: ${total}`,
  );
  printTable("By source (capture surface):", tally(rows, (r) => r.source), total);
  printTable("By utm_source (inbound channel):", tally(rows, (r) => r.utm_source), total);
  printTable("By utm_campaign:", tally(rows, (r) => r.utm_campaign), total);
}

main().catch((err) => {
  console.error("[sources] failed:", err);
  process.exit(1);
});
