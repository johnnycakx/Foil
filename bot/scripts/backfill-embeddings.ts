// Backfill OpenAI embeddings for bot_messages rows that don't have one yet.
//
// Why this exists: rows inserted before Goal B used the hash placeholder. As
// of Goal B we want real semantic recall, but old rows still live in the
// table with their old hash-vectors. This script:
//   1. Selects every bot_messages row whose id isn't in bot_embeddings, OR
//      whose embedding looks like a hash placeholder (we re-embed all rows
//      idempotently — overwriting hash rows is cheap and safer than trying
//      to detect them).
//   2. Calls embedOrFallback() on each content, upserts the bot_embeddings.
//
// Usage:
//   cd bot && node --experimental-strip-types --no-warnings scripts/backfill-embeddings.ts
//   # or with --all to re-embed every row (default: only rows missing an embedding)
//
// Idempotent. Safe to re-run. Rate-limit: OpenAI embeddings tier allows 3K
// requests/min on the default account; we keep this honest with a 50ms gap
// between calls.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { embedOrFallback } from "../src/db.ts";

const BATCH_SIZE = 50;
const INTER_CALL_DELAY_MS = 50;
const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

// Inline .env.local loader so the script works outside a bundler.
const envFile = resolve(REPO_ROOT, ".env.local");
try {
  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {
  // .env.local missing — fall back to process env. Railway-side will have
  // OPENAI_API_KEY + NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const reembedAll = process.argv.includes("--all");

async function main() {
  console.log(`[backfill] mode=${reembedAll ? "re-embed-all" : "missing-only"}`);
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let cursor = "1970-01-01T00:00:00Z";

  while (true) {
    // Page through bot_messages oldest-first. Stable cursor by created_at keeps
    // the script restartable.
    const { data: rows, error } = await supabase
      .from("bot_messages")
      .select("id, content, created_at")
      .gt("created_at", cursor)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (error) {
      console.error("[backfill] select failed:", error.message);
      process.exit(2);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      processed++;
      cursor = row.created_at;

      if (!reembedAll) {
        // Skip rows that already have an embedding.
        const { data: existing, error: lookupErr } = await supabase
          .from("bot_embeddings")
          .select("message_id")
          .eq("message_id", row.id)
          .maybeSingle();
        if (lookupErr) {
          console.warn(`[backfill] skip ${row.id}: lookup error ${lookupErr.message}`);
          failed++;
          continue;
        }
        if (existing) continue;
      }

      try {
        const embedding = await embedOrFallback(row.content);
        const { error: upErr } = await supabase
          .from("bot_embeddings")
          .upsert({ message_id: row.id, embedding }, { onConflict: "message_id" });
        if (upErr) {
          console.warn(`[backfill] upsert failed for ${row.id}: ${upErr.message}`);
          failed++;
        } else {
          succeeded++;
        }
      } catch (err) {
        console.warn(`[backfill] embed failed for ${row.id}: ${(err as Error).message}`);
        failed++;
      }
      await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
    }

    if (rows.length < BATCH_SIZE) break;
  }

  console.log(`[backfill] done. processed=${processed} succeeded=${succeeded} failed=${failed}`);
}

await main();
