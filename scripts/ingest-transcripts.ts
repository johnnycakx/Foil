// Creator-content ingestion (ADR-050 / Goal C.1).
//
// For each `active` channel in docs/creator-whitelist.md, pulls the last N days
// (default 30) of YouTube auto-subs via yt-dlp (--skip-download), cleans each
// VTT to deduped plain text, redacts it (R-008 eBay refs + BRAND-VOICE.md AI
// tells), and writes docs/transcripts/{creator}/{video-id}.txt. Raw .vtt files
// are removed after cleaning; docs/transcripts/ is gitignored.
//
// IDEMPOTENT: a per-channel yt-dlp --download-archive skips already-fetched
// videos, and the cleaning step skips any {id}.txt that already exists. Safe to
// re-run daily (the .github/workflows/transcript-ingestion.yml cron does).
//
// Usage:
//   node --experimental-strip-types scripts/ingest-transcripts.ts [--days 30] [--channel <handle>] [--max 30]
//
// Requires yt-dlp on PATH or importable as `python -m yt_dlp` (the script tries
// both). yt-dlp is a dev/CI dependency, not bundled into the app.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cleanVtt, redactForSynthesis } from "../lib/seo/transcript-clean.ts";
import { BANNED_PHRASES } from "../lib/seo/quality-gates.ts";

const ROOT = process.cwd();
const WHITELIST = path.join(ROOT, "docs", "creator-whitelist.md");
const TRANSCRIPTS_DIR = path.join(ROOT, "docs", "transcripts");

type Channel = { display: string; handle: string };

/**
 * Build the yt-dlp argument vector for one channel (everything after the binary).
 * Pure + exported so the cookies wiring is unit-tested without a network call
 * (R-018 Path A). When `cookiesPath` is provided, `--cookies <path>` is included
 * so CI (datacenter IP) can authenticate past YouTube's bot-block.
 */
export function buildYtDlpArgs(
  pre: string[],
  ch: Channel,
  days: number,
  max: number,
  outDir: string,
  cookiesPath?: string,
): string[] {
  return [
    ...pre,
    ...(cookiesPath ? ["--cookies", cookiesPath] : []),
    "--write-auto-subs",
    "--sub-langs", "en.*",
    "--skip-download",
    "--sub-format", "vtt",
    "--dateafter", dateAfter(days),
    "--playlist-end", String(max),
    "--ignore-errors",
    "--no-warnings",
    "--download-archive", path.join(outDir, ".download-archive"),
    "-o", path.join(outDir, "%(id)s.%(ext)s"),
    `https://www.youtube.com/@${ch.handle}/videos`,
  ];
}

/**
 * If YT_DLP_COOKIES env holds Netscape-format cookies.txt CONTENTS, write them
 * to a 0600 tempfile and return its path (+ a cleanup fn). Returns null when
 * unset (local/residential runs work without cookies). R-018 Path A.
 */
export function writeCookiesTempfile(contents: string | undefined): { path: string; cleanup: () => void } | null {
  if (!contents || !contents.trim()) return null;
  const p = path.join(os.tmpdir(), `foil-yt-cookies-${process.pid}-${Date.now()}.txt`);
  fs.writeFileSync(p, contents, { encoding: "utf8", mode: 0o600 });
  return { path: p, cleanup: () => fs.rmSync(p, { force: true }) };
}

/** Parse the whitelist table: rows `| Display | @handle | active | … |`. */
export function parseWhitelist(md: string): Channel[] {
  const out: Channel[] = [];
  for (const line of md.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    // cells[0] is "" (leading pipe). Expect: ["", display, @handle, status, ...]
    if (cells.length < 5) continue;
    const display = cells[1];
    const handle = cells[2];
    const status = (cells[3] ?? "").toLowerCase();
    if (!handle.startsWith("@")) continue; // skips header + separator rows
    if (status !== "active") continue;
    out.push({ display, handle: handle.replace(/^@/, "") });
  }
  return out;
}

function ytDlpBase(): string[] {
  // Prefer a bare yt-dlp binary; fall back to `python -m yt_dlp`.
  const probe = spawnSync("yt-dlp", ["--version"], { encoding: "utf8" });
  if (probe.status === 0) return ["yt-dlp"];
  return ["python", "-m", "yt_dlp"];
}

function dateAfter(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function ingestChannel(ch: Channel, days: number, max: number, cookiesPath?: string): { fetched: number; cleaned: number } {
  const slug = ch.handle.toLowerCase();
  const dir = path.join(TRANSCRIPTS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });

  const [bin, ...pre] = ytDlpBase();
  const args = buildYtDlpArgs(pre, ch, days, max, dir, cookiesPath);
  console.log(`[ingest] ${ch.display} (@${ch.handle}) — last ${days}d, max ${max}${cookiesPath ? " (cookies)" : ""}…`);
  const res = spawnSync(bin, args, { encoding: "utf8", timeout: 8 * 60 * 1000 });
  if (res.status !== 0 && !res.stdout) {
    console.warn(`[ingest] ${ch.handle}: yt-dlp exited ${res.status}; skipping (logged, not fatal). ${(res.stderr || "").slice(0, 200)}`);
  }

  // Clean every freshly-written .vtt -> {id}.txt, then remove the .vtt.
  let fetched = 0;
  let cleaned = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".vtt")) continue;
    fetched++;
    const id = f.replace(/\.(en[^.]*\.)?vtt$/i, "").replace(/\.en.*$/i, "");
    const txtPath = path.join(dir, `${id}.txt`);
    const vttPath = path.join(dir, f);
    if (!fs.existsSync(txtPath)) {
      const raw = fs.readFileSync(vttPath, "utf8");
      const text = redactForSynthesis(cleanVtt(raw), BANNED_PHRASES);
      if (text.length > 0) {
        fs.writeFileSync(txtPath, `# ${ch.display} (@${ch.handle}) — video ${id}\n\n${text}\n`, "utf8");
        cleaned++;
      }
    }
    fs.rmSync(vttPath, { force: true });
  }
  return { fetched, cleaned };
}

function main() {
  const argv = process.argv.slice(2);
  const days = Number(argv[argv.indexOf("--days") + 1]) || 30;
  const max = Number(argv[argv.indexOf("--max") + 1]) || 30;
  const onlyIdx = argv.indexOf("--channel");
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1]?.replace(/^@/, "") : null;

  const channels = parseWhitelist(fs.readFileSync(WHITELIST, "utf8")).filter(
    (c) => !only || c.handle.toLowerCase() === only.toLowerCase(),
  );
  if (channels.length === 0) {
    console.error("[ingest] no active channels matched.");
    process.exit(1);
  }

  // R-018 Path A: authenticate yt-dlp with browser cookies on bot-blocked IPs
  // (CI). YT_DLP_COOKIES holds the cookies.txt CONTENTS; write to a 0600
  // tempfile, pass --cookies, clean up on exit. Unset (local) → no cookies.
  const cookies = writeCookiesTempfile(process.env.YT_DLP_COOKIES);
  if (cookies) {
    console.log("[ingest] YT_DLP_COOKIES set — authenticating yt-dlp with cookies.");
    process.on("exit", cookies.cleanup);
  }

  let totalCleaned = 0;
  try {
    for (const ch of channels) {
      try {
        const { fetched, cleaned } = ingestChannel(ch, days, max, cookies?.path);
        totalCleaned += cleaned;
        console.log(`[ingest] ${ch.handle}: ${cleaned} new transcript(s) (${fetched} vtt processed).`);
      } catch (e) {
        console.warn(`[ingest] ${ch.handle}: error — ${(e as Error).message}. Continuing.`);
      }
    }
  } finally {
    cookies?.cleanup();
  }
  console.log(`[ingest] done. ${totalCleaned} new transcript(s) across ${channels.length} channel(s).`);
}

// Only run when invoked directly (not when imported by tests). endsWith, not
// includes, so a test file named ingest-transcripts.test.ts doesn't trip it.
if (process.argv[1]?.endsWith("ingest-transcripts.ts")) {
  main();
}
