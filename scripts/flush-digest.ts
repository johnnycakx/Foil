// Daily-digest flush job. Triggered by .github/workflows/daily-digest.yml
// at 09:00 UTC daily. Walks each channel target, posts one summary embed
// per channel that has undigested rows, marks them digested.
//
// Safe to re-run; idempotent — once a row is digested_at-stamped it won't
// be flushed again. The "atomic write after Discord 2xx" rule in
// lib/notifications/digest.ts means a partial Discord outage leaves
// undigested rows for the next run.

import fs from "node:fs";
import path from "node:path";
import { flushDigest, type DigestChannel } from "../lib/notifications/digest.ts";

// Inline .env.local loader so the script works outside Next.js and the
// GH Actions step (which sets env via secrets, not .env files).
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const CHANNELS: DigestChannel[] = ["subscribers", "content-engine", "errors", "deploys"];

const results = await Promise.all(CHANNELS.map((c) => flushDigest(c)));

let total = 0;
for (const r of results) {
  if (r.eventsFlushed === 0) {
    console.log(`[flush] #${r.channelTarget}: nothing to flush`);
  } else {
    console.log(
      `[flush] #${r.channelTarget}: ${r.eventsFlushed} event(s) flushed (posted=${r.posted})`,
    );
  }
  total += r.eventsFlushed;
}

console.log(`[flush] done. total=${total}`);
