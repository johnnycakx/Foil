// Ad-hoc single-video transcript ingestion (ADR-067; extends ADR-050).
//
// The channel pipeline (scripts/ingest-transcripts.ts) pulls @handle/videos for
// the last N days. This sibling ingests EXPLICIT video URLs — for evergreen or
// off-whitelist references (e.g. building a knowledge base from specific talks).
// It reuses cleanVtt + redactForSynthesis and writes cleaned {id}.txt to
// docs/transcripts/_adhoc/ (gitignored, like the rest of docs/transcripts/).
//
// Usage:
//   node --experimental-strip-types scripts/ingest-videos.ts \
//     --videos <url1,url2,...> [--cookies-from-browser chrome]
//
// Residential box (ADR-052): NO cookies by default; pass --cookies-from-browser
// chrome only if YouTube challenges. Requires yt-dlp on PATH or `python -m
// yt_dlp` (tries both, same as the channel script).
//
// SECURITY (ADR-067): every input is parsed to a strict 11-char YouTube id
// ([A-Za-z0-9_-]{11}); only a CANONICAL https://www.youtube.com/watch?v=<id> URL
// (built from the validated id) is handed to yt-dlp, as a single argv element
// via spawnSync (never a shell string). So a hostile "URL" can neither inject
// yt-dlp args (the element always starts with https://, never `-`) nor reach a
// shell. Anything that doesn't yield a valid id is skipped, not run.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { cleanVtt, redactForSynthesis } from "../lib/seo/transcript-clean.ts";
import { BANNED_PHRASES } from "../lib/seo/quality-gates.ts";

const ROOT = process.cwd();
const ADHOC_DIR = path.join(ROOT, "docs", "transcripts", "_adhoc");

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
]);

/**
 * Extract the canonical 11-char YouTube video id from a watch URL, youtu.be
 * short link, /shorts//embed//v/ path, or a bare id. Returns null for anything
 * that doesn't resolve to a strict [A-Za-z0-9_-]{11} id on a YouTube host.
 * Pure + exported so it's unit-tested without a network call. This is the
 * security boundary — callers only pass the canonical URL built from this id.
 */
export function parseVideoId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  // Bare id.
  if (YT_ID.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (!YT_HOSTS.has(host)) return null;

  let candidate: string | null = null;
  if (host === "youtu.be") {
    candidate = u.pathname.slice(1).split("/")[0] || null;
  } else if (u.pathname === "/watch") {
    candidate = u.searchParams.get("v");
  } else {
    const m = u.pathname.match(/^\/(?:shorts|embed|v)\/([^/?#]+)/);
    candidate = m ? m[1] : null;
  }
  return candidate && YT_ID.test(candidate) ? candidate : null;
}

/** Canonical watch URL from an already-validated id. */
export function canonicalVideoUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Build the yt-dlp argv (everything after the binary) for ONE explicit video.
 * No --dateafter, no channel playlist — just auto-subs for the given canonical
 * URL. Pure + exported so it's unit-tested without a network call.
 */
export function buildVideoYtDlpArgs(
  pre: string[],
  videoUrl: string,
  outDir: string,
  cookiesFromBrowser?: string,
): string[] {
  const cookieArgs = cookiesFromBrowser
    ? ["--cookies-from-browser", cookiesFromBrowser]
    : [];
  return [
    ...pre,
    ...cookieArgs,
    "--write-auto-subs",
    "--sub-langs", "en.*",
    "--skip-download",
    "--sub-format", "vtt",
    "--no-playlist",
    "--ignore-errors",
    "--no-warnings",
    "-o", path.join(outDir, "%(id)s.%(ext)s"),
    videoUrl,
  ];
}

function ytDlpBase(): string[] {
  const probe = spawnSync("yt-dlp", ["--version"], { encoding: "utf8" });
  if (probe.status === 0) return ["yt-dlp"];
  return ["python", "-m", "yt_dlp"];
}

type VideoResult = { id: string; status: "cleaned" | "no-transcript" | "exists" };

function ingestVideo(
  bin: string,
  pre: string[],
  id: string,
  cookiesFromBrowser?: string,
): VideoResult {
  const url = canonicalVideoUrl(id);
  const txtPath = path.join(ADHOC_DIR, `${id}.txt`);
  if (fs.existsSync(txtPath)) {
    console.log(`[ingest-videos] ${id}: already ingested, skipping.`);
    return { id, status: "exists" };
  }

  const args = buildVideoYtDlpArgs(pre, url, ADHOC_DIR, cookiesFromBrowser);
  console.log(`[ingest-videos] ${id} (${url})…`);
  const res = spawnSync(bin, args, { encoding: "utf8", timeout: 5 * 60 * 1000 });
  if (res.status !== 0 && !res.stdout) {
    console.warn(`[ingest-videos] ${id}: yt-dlp exited ${res.status}. ${(res.stderr || "").slice(0, 240)}`);
  }

  // Find the freshly-written {id}*.vtt (en.* sub-langs land as {id}.en.vtt etc).
  const vtts = fs.readdirSync(ADHOC_DIR).filter((f) => f.startsWith(id) && f.endsWith(".vtt"));
  if (vtts.length === 0) {
    console.warn(`[ingest-videos] ${id}: no transcript (captions disabled or fetch failed). Noted, continuing.`);
    return { id, status: "no-transcript" };
  }

  const raw = fs.readFileSync(path.join(ADHOC_DIR, vtts[0]), "utf8");
  const text = redactForSynthesis(cleanVtt(raw), BANNED_PHRASES);
  for (const f of vtts) fs.rmSync(path.join(ADHOC_DIR, f), { force: true });

  if (text.length === 0) {
    console.warn(`[ingest-videos] ${id}: cleaned transcript was empty. Noted, continuing.`);
    return { id, status: "no-transcript" };
  }

  fs.writeFileSync(txtPath, `# ad-hoc video — ${url}\n\n${text}\n`, "utf8");
  console.log(`[ingest-videos] ${id}: cleaned -> ${path.relative(ROOT, txtPath)}`);
  return { id, status: "cleaned" };
}

function main() {
  const argv = process.argv.slice(2);
  const vIdx = argv.indexOf("--videos");
  const rawVideos = vIdx >= 0 ? (argv[vIdx + 1] ?? "") : "";
  const cfbIdx = argv.indexOf("--cookies-from-browser");
  const cookiesFromBrowser =
    cfbIdx >= 0 ? argv[cfbIdx + 1] : process.env.YT_DLP_COOKIES_FROM_BROWSER || undefined;

  const inputs = rawVideos.split(",").map((s) => s.trim()).filter(Boolean);
  if (inputs.length === 0) {
    console.error("[ingest-videos] no --videos provided. Usage: --videos <url1,url2,...>");
    process.exit(1);
  }

  fs.mkdirSync(ADHOC_DIR, { recursive: true });
  const [bin, ...pre] = ytDlpBase();
  if (cookiesFromBrowser) {
    console.log(`[ingest-videos] using --cookies-from-browser ${cookiesFromBrowser}.`);
  }

  const results: VideoResult[] = [];
  for (const input of inputs) {
    const id = parseVideoId(input);
    if (!id) {
      console.warn(`[ingest-videos] skipping invalid YouTube URL/ID: ${JSON.stringify(input)}`);
      continue;
    }
    try {
      results.push(ingestVideo(bin, pre, id, cookiesFromBrowser));
    } catch (e) {
      console.warn(`[ingest-videos] ${id}: error — ${(e as Error).message}. Continuing.`);
    }
  }

  const cleaned = results.filter((r) => r.status === "cleaned").length;
  const noTranscript = results.filter((r) => r.status === "no-transcript").map((r) => r.id);
  console.log(
    `[ingest-videos] done. ${cleaned} cleaned; ` +
      `${noTranscript.length} without transcript${noTranscript.length ? ` (${noTranscript.join(", ")})` : ""}.`,
  );
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1]?.endsWith("ingest-videos.ts")) {
  main();
}
