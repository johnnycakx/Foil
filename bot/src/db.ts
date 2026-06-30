// Typed Supabase client + persistent-memory helpers for the Foil HQ ops bot.
//
// Backed by the bot_messages + bot_embeddings tables defined in
// bot/migrations/001_bot_memory.sql (isolated schema; service_role only).
//
// Embeddings (Goal B): real OpenAI text-embedding-3-small (1536 dims) when
// OPENAI_API_KEY is set; falls back to a deterministic SHA-256 hash
// placeholder when the key is absent OR the OpenAI call fails. The fallback
// keeps insertMessage usable during outages — recall accuracy degrades to
// "matches identical content" but writes don't lose data.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { embedText } from "./embed.ts";

const EMBEDDING_DIM = 1536;

export type BotMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type SemanticHit = BotMessage & { similarity: number };

let cachedClient: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

/** Test seam — pass a stub client + the helpers below will route through it. */
export function __setClientForTests(client: SupabaseClient | null): void {
  cachedClient = client;
}

/**
 * Insert a single turn — user message OR assistant reply. Returns the row id
 * so the caller can chain in the embedding insert. We deliberately split the
 * write into 2 queries (message THEN embedding) so a transient embedding
 * failure doesn't lose the message itself.
 */
export async function insertMessage(input: {
  channelId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<{ id: string } | null> {
  const client = getClient();
  const { data, error } = await client
    .from("bot_messages")
    .insert({
      channel_id: input.channelId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("[db] insertMessage failed:", error.message);
    return null;
  }

  // Best-effort embedding write. We try OpenAI first; on failure we fall back
  // to the deterministic hash placeholder so the row still gets an embedding
  // (recall accuracy degrades but writes don't lose data).
  const embedding = await embedOrFallback(input.content);
  const { error: embedError } = await client
    .from("bot_embeddings")
    .insert({ message_id: data.id, embedding });
  if (embedError) {
    console.warn("[db] embedding insert failed:", embedError.message);
  }

  return { id: data.id };
}

/**
 * Embed via OpenAI when possible; fall back to the deterministic hash
 * placeholder otherwise. Always returns a 1536-dim vector. Never throws.
 * Exported so the backfill script can use the same fallback rule.
 */
export async function embedOrFallback(text: string): Promise<number[]> {
  try {
    return await embedText(text);
  } catch (err) {
    console.warn(`[db] embedText fell back to hash placeholder: ${(err as Error).message}`);
    return hashEmbedding(text);
  }
}

/**
 * Last N turns for a channel, oldest-first (matches conversation API ordering).
 * Default 50 matches the goal spec; reduce to ~20 if Anthropic context
 * pressure becomes an issue.
 */
export async function getRecentChannelMessages(
  channelId: string,
  limit = 50,
): Promise<BotMessage[]> {
  const client = getClient();
  const { data, error } = await client
    .from("bot_messages")
    .select("id, channel_id, user_id, role, content, created_at")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[db] getRecentChannelMessages failed:", error.message);
    return [];
  }
  // Reverse to oldest-first so the conversation history reads left-to-right.
  return (data ?? []).reverse() as BotMessage[];
}

/**
 * Top-K semantic recall across a single channel. Wraps the bot_semantic_search
 * Postgres function. Returns empty array on error so callers can spread-skip.
 *
 * Placeholder caveat (TODO Goal B): query embeddings are hash-based, so recall
 * approximates lexical co-occurrence rather than true semantic similarity.
 * Even so, slash-command `/recall` is useful as a "find old turns about X"
 * lookup against exact-ish substrings.
 */
export async function semanticSearchMessages(
  channelId: string,
  query: string,
  topK = 5,
): Promise<SemanticHit[]> {
  const client = getClient();
  // Use the same embedding path as inserts — both must share the same
  // vector space or cosine similarity is meaningless. embedOrFallback gives
  // us OpenAI when up + hash when down, mirroring the write side.
  const queryEmbedding = await embedOrFallback(query);
  const { data, error } = await client.rpc("bot_semantic_search", {
    p_channel_id: channelId,
    p_query_embedding: queryEmbedding,
    p_top_k: topK,
  });
  if (error) {
    console.warn("[db] semanticSearchMessages failed:", error.message);
    return [];
  }
  return (data ?? []) as SemanticHit[];
}

/**
 * /reset — delete every row for a channel. Returns the number of rows deleted.
 * The bot_embeddings cascade handles the embedding sidecar via the FK.
 */
export async function resetChannel(channelId: string): Promise<number> {
  const client = getClient();
  const { count, error } = await client
    .from("bot_messages")
    .delete({ count: "exact" })
    .eq("channel_id", channelId);
  if (error) {
    console.warn("[db] resetChannel failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Deterministic SHA-256 → 1536-float fallback. Same input → same vector;
 * identical messages cluster, unrelated messages have effectively random
 * distance. The primary embedding path is OpenAI's text-embedding-3-small
 * (see embedOrFallback above); this is the failure mode for outages or
 * missing keys. NOT a semantic embedding — recall queries against
 * hash-vectors only match identical-substring content.
 */
export function hashEmbedding(text: string): number[] {
  // Two hash rounds give 64 bytes = 32 fp32 values; we tile that out to 1536
  // dims to match the schema. Normalized to unit-length so cosine similarity
  // behaves predictably.
  const hash1 = createHash("sha256").update(text).digest();
  const hash2 = createHash("sha256").update(`mirror:${text}`).digest();
  const seed: number[] = [];
  for (let i = 0; i < 32; i++) seed.push((hash1[i] - 127.5) / 127.5);
  for (let i = 0; i < 32; i++) seed.push((hash2[i] - 127.5) / 127.5);

  const vec: number[] = new Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] = seed[i % seed.length];

  // Normalize to unit vector — cosine distance is well-behaved on normalized
  // vectors and the HNSW index uses vector_cosine_ops.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= norm;
  return vec;
}
