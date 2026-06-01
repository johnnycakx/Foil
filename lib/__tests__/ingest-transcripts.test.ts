// Ingestion cookies wiring (R-018 Path A, ADR-050). Pins that yt-dlp gets
// --cookies <path> only when cookies are supplied — no network call needed.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildYtDlpArgs, writeCookiesTempfile, parseWhitelist } from "../../scripts/ingest-transcripts.ts";

const CH = { display: "PokeRev", handle: "PokeRev" };

test("buildYtDlpArgs includes --cookies <path> when a cookies path is given", () => {
  const args = buildYtDlpArgs([], CH, 30, 30, "/tmp/out", "/tmp/cookies.txt");
  const i = args.indexOf("--cookies");
  assert.ok(i >= 0, "expected --cookies flag");
  assert.equal(args[i + 1], "/tmp/cookies.txt", "--cookies must be followed by the path");
});

test("buildYtDlpArgs omits --cookies when no path is given (local/residential)", () => {
  const args = buildYtDlpArgs([], CH, 30, 30, "/tmp/out");
  assert.ok(!args.includes("--cookies"), "no cookies path -> no --cookies flag");
  // still a valid invocation
  assert.ok(args.includes("--write-auto-subs") && args.some((a) => a.includes("youtube.com/@PokeRev")));
});

test("writeCookiesTempfile: contents -> a real file with --cookies-able path; unset -> null", () => {
  assert.equal(writeCookiesTempfile(undefined), null);
  assert.equal(writeCookiesTempfile("   "), null);
  const handle = writeCookiesTempfile("# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t0\tX\tY\n");
  assert.ok(handle, "expected a tempfile handle for real contents");
  assert.ok(fs.existsSync(handle!.path), "cookies tempfile should exist");
  assert.match(fs.readFileSync(handle!.path, "utf8"), /Netscape HTTP Cookie File/);
  handle!.cleanup();
  assert.ok(!fs.existsSync(handle!.path), "cleanup() must remove the tempfile");
});

test("parseWhitelist still parses the 5 active C.1 channels (import sanity)", () => {
  const md = fs.readFileSync("docs/creator-whitelist.md", "utf8");
  const channels = parseWhitelist(md);
  assert.ok(channels.length >= 5, `expected >=5 active channels, got ${channels.length}`);
  assert.ok(channels.some((c) => c.handle === "PokeRev"));
});
