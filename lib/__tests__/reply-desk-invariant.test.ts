// TWO-LANE X-WRITE INVARIANT (x-reply-desk, ADR-107). The whole goal turns on
// one rule a future refactor must never "helpfully" unify:
//
//   COLD lane (receipts tool §3d, engagement brief, QT) → build an
//     x.com/intent/post URL; the HUMAN presses X's Post button. NEVER an API post
//     (API-posting cold replies is a platform-manipulation ban risk).
//   USER-INITIATED lane (reply desk §1) → API-post the reply, but ONLY through
//     the ONE approve endpoint, and ONLY in response to someone who contacted us.
//
// This test reads the source as TEXT and fails the build if (a) any cold-lane or
// read/draft/enqueue file could reach an X write, or (b) more than one file binds
// the X write API. The single sanctioned write binding is the reply-desk approve
// route; everything else is read + draft + intent-URL only.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// Files that must NEVER post to X: the cold lane (receipts = intent URLs only)
// and the reply desk's read/draft/enqueue/decision-core half. The API-post lives
// only in the approve ROUTE (below), which these do not import.
const NO_X_WRITE_FILES = [
  // cold lane — receipts tool (intent URL, human posts)
  "lib/receipts/intent.ts",
  "lib/receipts/facts.ts",
  "lib/receipts/draft.ts",
  "lib/receipts/engine.ts",
  "app/api/receipts/route.ts",
  // reply desk — read + draft + enqueue + decision core (poster is injected)
  "lib/reply-desk/desk.ts",
  "lib/reply-desk/draft.ts",
  "lib/reply-desk/queue.ts",
  "lib/reply-desk/store.ts",
  "lib/reply-desk/approve.ts",
  "app/api/cron/reply-desk/route.ts",
];

// Identifiers / endpoints that perform an X WRITE. None may appear in the files above.
const WRITE_TOKENS: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bpostToX\b/, what: "postToX (create post / reply)" },
  { pattern: /uploadVideoMedia|uploadMedia/, what: "media upload (write)" },
  { pattern: /CREATE_POST_URL|MEDIA_UPLOAD/, what: "a write endpoint constant" },
  { pattern: /\bapi\.x\.com\b/, what: "a direct X API URL (reads go through x-client's read fns)" },
];

for (const rel of NO_X_WRITE_FILES) {
  test(`two-lane invariant: ${rel} never posts to X`, () => {
    const src = readFileSync(join(ROOT, rel), "utf8");
    for (const t of WRITE_TOKENS) {
      assert.doesNotMatch(src, t.pattern, `${rel} must not reference ${t.what}`);
    }
  });
}

test("the reply-desk approve ROUTE is the ONE sanctioned X-write binding", () => {
  // Exactly one file across the receipts + reply-desk trees may import postToX:
  // the approve route (user-initiated contact only). If a second appears, a lane
  // has been unified — the exact regression this test exists to prevent.
  const CANDIDATES = [
    ...NO_X_WRITE_FILES,
    "app/api/reply-desk/approve/route.ts",
  ];
  const binders = CANDIDATES.filter((rel) => /import[\s\S]*\bpostToX\b[\s\S]*from\s+["'][^"']*social\/x-client["']/.test(readFileSync(join(ROOT, rel), "utf8")));
  assert.deepEqual(binders, ["app/api/reply-desk/approve/route.ts"], `only the approve route may bind postToX; found: ${binders.join(", ")}`);
});

test("the cold-lane intent builder uses x.com/intent/post (a URL a human clicks), never the API host", () => {
  const src = readFileSync(join(ROOT, "lib/receipts/intent.ts"), "utf8");
  assert.match(src, /x\.com\/intent\/post/, "the cold lane opens X's own composer");
  assert.doesNotMatch(src, /api\.x\.com/, "the cold lane never touches the X API");
});
