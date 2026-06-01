// Structural guard against the blog write/read split returning (ADR-049 /
// R-015). The orphaned app/blog/posts/ directory (which the content engine
// wrote to but the route never read) was deleted in Goal V.2. If anything
// recreates it, the build fails here before autonomous posts silently vanish
// into a dead dir again.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("the orphaned app/blog/posts/ directory does not exist", () => {
  assert.equal(
    fs.existsSync(path.join(ROOT, "app", "blog", "posts")),
    false,
    "app/blog/posts/ reappeared — the content engine must write to app/(site)/blog/posts/ (the dir the route reads). See R-015.",
  );
});

test("the canonical app/(site)/blog/posts/ holds the live posts", () => {
  const dir = path.join(ROOT, "app", "(site)", "blog", "posts");
  assert.ok(fs.existsSync(dir), "canonical posts dir is missing");
  const mdx = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));
  assert.ok(mdx.length >= 4, `expected >=4 live posts, found ${mdx.length}`);
});
