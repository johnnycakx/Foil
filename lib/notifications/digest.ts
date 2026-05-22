// Daily-digest queue (ADR-018). Two responsibilities:
//
//   queueEvent({type, payload, channelTarget}) — write a row to digest_events
//                                                instead of firing a real-time
//                                                Discord embed
//   flushDigest(channelTarget) — read undigested rows for a channel, build
//                                one summary embed, post via lib/notifications/
//                                discord.ts, mark rows digested_at = now()
//
// Routing rule: callers (subscribe action, content engine, etc) check
// process.env.DIGEST_MODE. "daily" → queueEvent. "realtime" (default) →
// existing per-event post. The Next.js Server Action side reads DIGEST_MODE
// at runtime so flipping the mode is just a Vercel env-var swap, no redeploy.
//
// Soft-fail at every layer. A Supabase outage cannot block a subscribe; a
// Discord outage cannot block a flush from marking rows digested.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { postWebhook, type DiscordEmbed } from "./discord.ts";

export type DigestChannel = "subscribers" | "content-engine" | "errors" | "deploys";

export type QueueEventInput = {
  eventType: string;
  payload: Record<string, unknown>;
  channelTarget: DigestChannel;
};

export type FlushResult = {
  channelTarget: DigestChannel;
  eventsFlushed: number;
  posted: boolean;
};

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

/** Test seam — inject a stub Supabase client for unit tests. */
export function __setDigestClientForTests(client: SupabaseClient | null): void {
  cachedClient = client;
}

/**
 * Enqueue an event for the daily flush. Soft-fail: missing Supabase config
 * or insert errors are logged but never thrown. Returns true on success.
 */
export async function queueEvent(input: QueueEventInput): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.warn("[digest] queueEvent: Supabase not configured — skipping");
    return false;
  }
  const { error } = await client.from("digest_events").insert({
    event_type: input.eventType,
    payload: input.payload,
    channel_target: input.channelTarget,
  });
  if (error) {
    console.warn(`[digest] queueEvent failed: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * Flush every undigested row for `channelTarget`. Posts a single summary
 * embed to the corresponding Discord webhook, then marks the rows
 * digested_at = now(). Returns the count + post outcome.
 *
 * If there are no undigested rows, returns `{ eventsFlushed: 0, posted: false }`
 * — caller can skip the empty-flush log line.
 */
export async function flushDigest(channelTarget: DigestChannel): Promise<FlushResult> {
  const empty: FlushResult = { channelTarget, eventsFlushed: 0, posted: false };
  const client = getClient();
  if (!client) {
    console.warn("[digest] flushDigest: Supabase not configured — skipping");
    return empty;
  }

  // Read undigested rows for this channel
  const { data: rows, error: selectErr } = await client
    .from("digest_events")
    .select("id, event_type, payload, created_at")
    .eq("channel_target", channelTarget)
    .is("digested_at", null)
    .order("created_at", { ascending: true });

  if (selectErr) {
    console.warn(`[digest] flushDigest select failed: ${selectErr.message}`);
    return empty;
  }
  if (!rows || rows.length === 0) {
    return empty;
  }

  const webhookEnvKey = WEBHOOK_BY_CHANNEL[channelTarget];
  const webhookUrl = process.env[webhookEnvKey];
  if (!webhookUrl) {
    console.warn(
      `[digest] flushDigest: ${webhookEnvKey} not set — leaving ${rows.length} row(s) in queue`,
    );
    return { channelTarget, eventsFlushed: 0, posted: false };
  }

  const embed = buildDigestEmbed(channelTarget, rows);
  const post = await postWebhook({ webhookUrl, embeds: [embed] });

  if (!post.ok) {
    console.warn(`[digest] Discord post failed; leaving rows undigested for retry`);
    return { channelTarget, eventsFlushed: 0, posted: false };
  }

  // Only mark digested after a successful Discord post — otherwise a Discord
  // outage would silently lose events.
  const ids = rows.map((r) => (r as { id: string }).id);
  const { error: updateErr } = await client
    .from("digest_events")
    .update({ digested_at: new Date().toISOString() })
    .in("id", ids);
  if (updateErr) {
    console.warn(`[digest] mark-digested failed: ${updateErr.message}`);
    // Returning posted:true so the caller knows the Discord side worked.
    return { channelTarget, eventsFlushed: rows.length, posted: true };
  }
  return { channelTarget, eventsFlushed: rows.length, posted: true };
}

const WEBHOOK_BY_CHANNEL: Record<DigestChannel, string> = {
  subscribers: "DISCORD_WEBHOOK_SUBSCRIBERS",
  "content-engine": "DISCORD_WEBHOOK_CONTENT_ENGINE",
  errors: "DISCORD_WEBHOOK_ERRORS",
  deploys: "DISCORD_WEBHOOK_DEPLOYS",
};

/** Shape the summary embed for one channel's batch of events. Exported for tests. */
export function buildDigestEmbed(
  channelTarget: DigestChannel,
  rows: Array<{ event_type: string; payload: unknown; created_at: string }>,
): DiscordEmbed {
  // Group by event_type so the embed compresses "5 subscriber_joined + 1
  // subscribe_failed" into two fields rather than 6 separate lines.
  const grouped: Record<string, number> = {};
  for (const row of rows) {
    grouped[row.event_type] = (grouped[row.event_type] ?? 0) + 1;
  }

  const fields = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25) // Discord caps fields at 25
    .map(([type, count]) => ({ name: type, value: String(count), inline: true }));

  const window = rows.length > 0
    ? `${rows[0].created_at.slice(0, 16).replace("T", " ")} → ${rows[rows.length - 1].created_at.slice(0, 16).replace("T", " ")} UTC`
    : "n/a";

  return {
    title: `📬 Digest — #${channelTarget}`,
    description: `${rows.length} event${rows.length === 1 ? "" : "s"} between ${window}.`,
    color: 0xff6b5c,
    timestamp: new Date().toISOString(),
    fields,
  };
}
