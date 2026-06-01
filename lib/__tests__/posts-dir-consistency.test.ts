// Writer/reader POSTS_DIR consistency (ADR-049 / R-015 / PATTERNS I-008).
//
// The autonomous content engine WRITES posts and the live blog route READS
// them. They drifted once (engine -> app/blog/posts, route ->
// app/(site)/blog/posts), so autonomous posts silently never went live. Every
// consumer now imports the single shared constant; this test pins that (a) the
// shared value resolves to app/(site)/blog/posts, and (b) each consumer source
// imports it rather than redefining its own path. Build fails on any drift.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { POSTS_DIR } from "../blog/posts-dir.ts";

const ROOT = process.cwd();
const CANONICAL = path.join(ROOT, "app", "(site)", "blog", "posts");

test("shared POSTS_DIR resolves to app/(site)/blog/posts", () => {
  assert.equal(POSTS_DIR, CANONICAL);
  assert.ok(POSTS_DIR.includes(path.join("app", "(site)", "blog", "posts")));
});

// Every writer + reader of the posts dir. If a new consumer is added that
// hardcodes a path instead of importing the shared constant, add it here AND
// it must pass the assertions below.
const CONSUMERS = [
  "app/(site)/blog/posts-meta.ts", // reader (the live route)
  "scripts/generate-weekly-post.ts", // writer (autonomous engine)
  "lib/seo/content-engine.ts", // dedupe scan
  "scripts/refresh-internal-links.ts", // reader (link report)
  "scripts/competitive-gap-scan.ts", // reader (gap report)
];

for (const rel of CONSUMERS) {
  test(`consumer imports the shared POSTS_DIR: ${rel}`, () => {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    // (a) imports the shared constant module.
    assert.match(
      src,
      /from\s+["'][^"']*blog\/posts-dir\.ts["']/,
      `${rel} must import POSTS_DIR from lib/blog/posts-dir.ts`,
    );
    // (b) does NOT redefine its own posts dir (the dead-path drift that caused R-015).
    assert.doesNotMatch(
      src,
      /["']app\/blog\/posts["']|["']app["']\s*,\s*["']blog["']\s*,\s*["']posts["']/,
      `${rel} must not hardcode the dead app/blog/posts path`,
    );
  });
}

// CI INFRA GUARD (PATTERN I-008 third instance). The V.2 consolidation missed
// .github/workflows/weekly-content.yml — it still `git add`-ed the deleted
// app/blog/posts, so the autonomous run 26776700075 failed with exit 128. The
// directory-drift class had already bitten the 47.4 fact-check and V.1 voice
// cleanup; nothing scanned for stale references OUTSIDE lib/. This guard closes
// that: no workflow may carry a literal posts path (old OR new) — they must
// derive it from POSTS_DIR (lib/blog/posts-dir.ts) so a future move can't drift.
const WORKFLOWS_DIR = path.join(ROOT, ".github", "workflows");
// Matches app/blog/posts and app/(site)/blog/posts (the latter via the optional
// (site)/ group). Either literal in a workflow is a drift hazard.
const LITERAL_POSTS_PATH = /app\/(?:\(site\)\/)?blog\/posts/;

test(".github/workflows/*.yml hardcode no posts path — derive from POSTS_DIR (I-008)", () => {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  assert.ok(files.length > 0, "expected workflow files to scan");
  const offenders: string[] = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(WORKFLOWS_DIR, f), "utf8");
    src.split("\n").forEach((line, i) => {
      if (LITERAL_POSTS_PATH.test(line)) offenders.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(
    offenders,
    [],
    `workflow(s) hardcode a posts path (must derive from lib/blog/posts-dir.ts POSTS_DIR):\n${offenders.join("\n")}`,
  );
});
