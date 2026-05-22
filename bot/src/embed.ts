// OpenAI text-embedding-3-small wrapper. 1536 dims, $0.02/M tokens.
// Matches the existing pgvector schema (no migration needed when this lands).
//
// Caching strategy: in-memory LRU keyed by SHA-256(content). The bot ingests
// 2-3 messages per channel-turn so an LRU of ~512 entries holds ~256 turns of
// history with zero round-trips for repeat-content recall queries.
//
// Failure handling: this function throws on hard failure (network, auth,
// non-2xx) so the caller can decide what to do. db.ts wraps it in a safe
// fallback to the legacy hash placeholder so an OpenAI outage cannot block
// message inserts — recall just temporarily degrades.

import { createHash } from "node:crypto";

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const DIM = 1536;
const CACHE_MAX = 512;

// Tiny LRU implementation — Map's iteration order is insertion order, so we
// delete + re-insert to refresh "recency".
const cache = new Map<string, number[]>();

function cacheKey(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function cacheGet(key: string): number[] | undefined {
  const v = cache.get(key);
  if (v) {
    cache.delete(key);
    cache.set(key, v); // refresh recency
  }
  return v;
}

function cachePut(key: string, value: number[]): void {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Test seam — clear the cache between tests. */
export function __clearEmbedCache(): void {
  cache.clear();
}

/**
 * Embed a single string. Hits the LRU first; on miss POSTs OpenAI and stores.
 * Throws if OPENAI_API_KEY is missing or the call fails (HTTP non-2xx,
 * malformed body, network error). Caller is responsible for the fallback.
 */
export async function embedText(
  text: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<number[]> {
  if (!text || !text.trim()) throw new Error("embedText: empty input");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("embedText: OPENAI_API_KEY not set");

  const key = cacheKey(text);
  const cached = cacheGet(key);
  if (cached) return cached;

  const fetchFn = opts.fetchImpl ?? fetch;
  const response = await fetchFn(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });

  if (!response.ok) {
    const errText = await safeText(response);
    throw new Error(`embedText: HTTP ${response.status} ${errText.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = json.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length !== DIM) {
    throw new Error(`embedText: malformed response (expected ${DIM}-dim array)`);
  }

  cachePut(key, embedding);
  return embedding;
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "(no body)";
  }
}
