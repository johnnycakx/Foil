// tools/index.ts: read_file, search_codebase, get_session_log all hit the
// real filesystem (the repo root above bot/). The Beehiiv tools touch the
// network — we skip those in unit tests.

import test from "node:test";
import assert from "node:assert/strict";
import { executeTool, TOOL_DEFINITIONS } from "../tools/index.ts";

test("read_file returns content for a known repo file", async () => {
  const out = await executeTool("read_file", { path: "CLAUDE.md", max_bytes: 500 });
  assert.ok(out.toLowerCase().includes("foil"));
});

test("read_file refuses paths containing '..'", async () => {
  const out = await executeTool("read_file", { path: "../etc/passwd" });
  assert.ok(out.startsWith("Error: invalid path"));
});

test("read_file surfaces a clean error for missing files", async () => {
  const out = await executeTool("read_file", { path: "no-such-file-foo.md" });
  assert.ok(out.startsWith("Error:"));
});

test("search_codebase finds known strings", async () => {
  const out = await executeTool("search_codebase", { query: "subscribeEmail", max_results: 3 });
  assert.ok(out.includes("lib/beehiiv.ts"), `expected lib/beehiiv.ts hit, got: ${out}`);
});

test("search_codebase returns a no-match string when nothing matches", async () => {
  const out = await executeTool("search_codebase", { query: "xyzzy_unique_token_unlikely_to_match" });
  assert.ok(out.startsWith("No matches"));
});

test("search_codebase rejects empty queries", async () => {
  const out = await executeTool("search_codebase", { query: "  " });
  assert.equal(out, "Error: empty query");
});

test("get_session_log returns the latest entries", async () => {
  const out = await executeTool("get_session_log", { entries: 2 });
  // Must contain at least 1 dated heading
  assert.ok(/## \d{4}-\d{2}-\d{2}/.test(out));
});

test("executeTool returns a clear error for unknown tool names", async () => {
  const out = await executeTool("nope", {});
  assert.equal(out, 'Error: unknown tool "nope"');
});

test("TOOL_DEFINITIONS exports exactly the 5 documented tools", () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name).sort();
  assert.deepEqual(names, [
    "get_publication_stats",
    "get_recent_subscribers",
    "get_session_log",
    "read_file",
    "search_codebase",
  ]);
});

test("every tool def has a non-empty description and an input_schema", () => {
  for (const t of TOOL_DEFINITIONS) {
    assert.ok(t.description && t.description.length > 10, `${t.name} description too short`);
    assert.ok(t.input_schema, `${t.name} missing input_schema`);
    assert.equal(t.input_schema.type, "object");
  }
});
