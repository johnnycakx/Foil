// Pure splitter — no Discord I/O, no streaming state.

import test from "node:test";
import assert from "node:assert/strict";
import {
  DISCORD_CHUNK_LIMIT,
  findSplitPoint,
  splitForDiscord,
  withChunkPrefixes,
} from "../handlers/message-splitter.ts";

test("short response stays a single chunk", () => {
  const out = splitForDiscord("hello world");
  assert.deepEqual(out, ["hello world"]);
});

test("response at exactly the limit stays single", () => {
  const exact = "a".repeat(DISCORD_CHUNK_LIMIT);
  assert.equal(splitForDiscord(exact).length, 1);
});

test("response over the limit splits into multiple chunks", () => {
  const big = ("Sentence number one. ".repeat(200)).trim(); // ~4000 chars
  const out = splitForDiscord(big);
  assert.ok(out.length > 1, "expected multi-chunk");
  for (const chunk of out) {
    assert.ok(chunk.length <= DISCORD_CHUNK_LIMIT, `chunk over limit: ${chunk.length}`);
  }
});

test("split lands on a sentence boundary when one exists before the limit", () => {
  // Long stretch of sentences, all under the limit total when combined,
  // but cumulatively over. Ensures we cut on `. ` not mid-word.
  const block = "The quick brown fox jumps over the lazy dog. ".repeat(100); // ~4500 chars
  const out = splitForDiscord(block);
  assert.ok(out.length >= 2);
  // First chunk must end with a sentence-ending punctuation.
  assert.match(out[0], /[.!?]$/, `first chunk did not end on sentence boundary: ${JSON.stringify(out[0].slice(-30))}`);
});

test("never splits mid-word — boundary is whitespace at minimum", () => {
  // Build text with NO sentence boundaries — only spaces.
  const words = Array.from({ length: 600 }, (_, i) => `word${i}`); // ~6 chars each
  const text = words.join(" ");
  const out = splitForDiscord(text);
  assert.ok(out.length >= 2);
  for (const chunk of out) {
    // Every chunk should be a sequence of whole "wordN" tokens — no fragment.
    for (const token of chunk.split(/\s+/)) {
      if (!token) continue;
      assert.match(token, /^word\d+$/, `mid-word split produced fragment: ${token}`);
    }
  }
});

test("code block stays atomic — no split inside fenced ```", () => {
  // Pad until just under the limit, then drop in a code block that would
  // straddle the boundary if the splitter ignored fences.
  const pad = "x".repeat(DISCORD_CHUNK_LIMIT - 200);
  const block = "\n\n```ts\n" + "console.log('hello');\n".repeat(20) + "```\n\nafter the block.";
  const text = pad + block;
  const out = splitForDiscord(text);
  // Find the chunk that contains the opening fence; it must also contain
  // the closing fence (i.e. block isn't split).
  for (const chunk of out) {
    const opens = (chunk.match(/```/g) ?? []).length;
    assert.equal(opens % 2, 0, `chunk has an unbalanced number of fences: ${opens}\nchunk:\n${chunk}`);
  }
});

test("withChunkPrefixes is a no-op for a single chunk", () => {
  assert.deepEqual(withChunkPrefixes(["only one"]), ["only one"]);
});

test("withChunkPrefixes is a no-op for two chunks (reads naturally as continued thought)", () => {
  // Threshold bumped from 1 → 2 in the COO-voice pass. A "1/2 ... 2/2" prefix
  // on a two-message overflow made the bot sound mechanical; the reader can
  // see there's a second message right below. Prefixes only earn their keep
  // at 3+, where the reader genuinely benefits from a count.
  assert.deepEqual(
    withChunkPrefixes(["first message", "second message"]),
    ["first message", "second message"],
  );
});

test("withChunkPrefixes adds N/M to 3+ chunks", () => {
  const out = withChunkPrefixes(["alpha", "beta", "gamma"]);
  assert.deepEqual(out, ["1/3 alpha", "2/3 beta", "3/3 gamma"]);
});

test("findSplitPoint returns text.length when text fits", () => {
  assert.equal(findSplitPoint("short", 100), "short".length);
});

test("findSplitPoint prefers sentence boundary over earlier whitespace", () => {
  const text = "alpha beta gamma. delta epsilon zeta omega.";
  // Limit of 25 — must land at index 17 (right after "gamma."), not at the
  // earlier whitespace ws indexes.
  const cut = findSplitPoint(text, 25);
  assert.equal(text.slice(0, cut).trim(), "alpha beta gamma.");
});
