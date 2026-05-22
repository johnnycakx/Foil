// Pure helpers for splitting long bot replies across multiple Discord
// messages. Discord caps a single message at 2000 chars; we use 1800 to
// leave room for the "N/M " prefix and the "(continued ↓)" cue used
// during mid-stream finalization.
//
// Splitter contract (in priority order, applied per chunk):
//   1. Never split inside an OPEN fenced code block (```). If the limit
//      lands inside one, push the cut to before the fence opening so the
//      whole block stays atomic in the next chunk.
//   2. Prefer a sentence boundary ([.!?] followed by whitespace or EOL).
//   3. Fall back to the last newline, then the last whitespace (so we
//      never split mid-word) before the limit.
//   4. Degenerate fallback: hard-cut at `limit` exactly (only reached
//      when the chunk has no whitespace at all in `limit` chars).

export const DISCORD_CHUNK_LIMIT = 1800;
export const CONTINUATION_MARKER = "\n\n*(continued ↓)*";

/**
 * Split `text` into chunks each ≤ `limit` chars (before any prefixing).
 * Returns `[text]` when no split is needed.
 */
export function splitForDiscord(text: string, limit = DISCORD_CHUNK_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    const cut = findSplitPoint(remaining, limit);
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).replace(/^\s+/, "");
  }
  if (remaining.length) chunks.push(remaining);
  return chunks;
}

/**
 * Prefix each chunk with `N/M ` when there's more than one. A single chunk
 * is returned unchanged — no need to clutter short replies with "1/1".
 */
export function withChunkPrefixes(chunks: string[]): string[] {
  if (chunks.length <= 1) return chunks;
  return chunks.map((c, i) => `${i + 1}/${chunks.length} ${c}`);
}

/**
 * Locate the cut index ≤ `limit` for the next chunk of `text`.
 * See module-header contract for priority order.
 */
export function findSplitPoint(text: string, limit: number): number {
  if (text.length <= limit) return text.length;

  // (1) If we'd split inside an open code block, pull the cut back to
  // before the fence opening so the block stays atomic in the next chunk.
  const fenceOpenAtLimit = findOpenCodeFenceAt(text, limit);
  if (fenceOpenAtLimit !== null && fenceOpenAtLimit > 0) {
    const sentBeforeFence = lastSentenceBoundary(text, fenceOpenAtLimit);
    if (sentBeforeFence !== null) return sentBeforeFence;
    const nlBeforeFence = text.lastIndexOf("\n", fenceOpenAtLimit - 1);
    if (nlBeforeFence > 0) return nlBeforeFence + 1;
    const wsBeforeFence = lastWhitespace(text, fenceOpenAtLimit);
    if (wsBeforeFence !== null) return wsBeforeFence;
    return fenceOpenAtLimit;
  }

  // (2) Sentence boundary.
  const sentence = lastSentenceBoundary(text, limit);
  if (sentence !== null) return sentence;

  // (3) Newline.
  const newline = text.lastIndexOf("\n", limit - 1);
  if (newline > 0) return newline + 1;

  // (3b) Word-boundary whitespace.
  const ws = lastWhitespace(text, limit);
  if (ws !== null) return ws;

  // (4) Degenerate fallback.
  return limit;
}

/**
 * Returns the index AFTER the last `[.!?]` (followed by whitespace or EOL)
 * at or before `before`. Null if no such boundary exists.
 */
function lastSentenceBoundary(text: string, before: number): number | null {
  const upper = Math.min(before, text.length);
  for (let i = upper - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?") {
      const next = text[i + 1];
      if (next === undefined || /\s/.test(next)) return i + 1;
    }
  }
  return null;
}

function lastWhitespace(text: string, before: number): number | null {
  const upper = Math.min(before, text.length);
  for (let i = upper - 1; i > 0; i--) {
    if (/\s/.test(text[i])) return i;
  }
  return null;
}

/**
 * If the fence-open count in text[0..limit) is odd (i.e. a code block is
 * open AT position `limit`), return the index of the most-recent opening
 * fence. Otherwise return null.
 */
function findOpenCodeFenceAt(text: string, limit: number): number | null {
  let pos = 0;
  let openIdx: number | null = null;
  let isOpen = false;
  while (pos < limit) {
    const next = text.indexOf("```", pos);
    if (next === -1 || next >= limit) break;
    isOpen = !isOpen;
    openIdx = isOpen ? next : null;
    pos = next + 3;
  }
  return isOpen ? openIdx : null;
}
