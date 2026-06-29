// Editorial digest generator + the ADR-080 BEFORE/AFTER measurement (the
// CLAUDE.md contract: a generation-prompt change requires a regeneration
// measurement, not just a passing suite). Reads the fresh market_movers, builds
// the deterministic model, runs the editorial LLM engine, gate-checks it, writes
// the issue to docs/newsletter-drafts/_pending/ (NOTHING sends), and prints the
// concrete BEFORE (anonymous digest) -> AFTER (editorial) delta.
//
//   node --experimental-strip-types scripts/generate-editorial-digest.ts

import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.EBAY_CAMPAIGN_ID) process.env.EBAY_CAMPAIGN_ID = "5339154326";

const { getMarketMovers } = await import("../lib/deals/market-movers-read.ts");
const { buildDigestModel, buildMoversDigestParts } = await import("../lib/newsletter/movers-digest.ts");
const { generateEditorialIssue, allIssueText, allPicks } = await import("../lib/newsletter/editorial-engine.ts");
const { runEditorialGates } = await import("../lib/newsletter/editorial-gates.ts");
const { serializeEditorialIssue } = await import("../lib/newsletter/editorial-serialize.ts");

const movers = await getMarketMovers(50);
const generatedAt = new Date().toISOString();
const siteUrl = "https://foiltcg.com";
const model = buildDigestModel({ movers, generatedAt, siteUrl });

if (model.down.length === 0 && model.up.length === 0) {
  console.error("[editorial] market_movers is empty — run the market-movers cron first.");
  process.exit(1);
}

// BEFORE: the current deterministic, anonymous digest.
const before = buildMoversDigestParts({ movers, generatedAt, siteUrl });
const beforeWords = before.bodyMarkdown.split(/\s+/).filter(Boolean).length;
const causalRe = /reprint|rotation|tournament|regional|hype|creator|buyout|sealed|season|noise|thin|catalyst|oversupplied|glut/i;
const verdictRe = /\bI'd\b|buy now|grab|wait|hold|pass|skip|ignore|don'?t chase|watch the floor/i;
const beforePicks = before.bodyMarkdown.split(/\n\*\*/).filter((b) => /\$/.test(b));
const beforeWhy = beforePicks.filter((b) => causalRe.test(b)).length;
const beforeVerdict = beforePicks.filter((b) => verdictRe.test(b)).length;
const beforePov = /\bI'd\b|\bI'm\b|my read/i.test(before.bodyMarkdown);

console.log("[editorial] generating the editorial issue (real Claude call)...");
const issue = await generateEditorialIssue(model);
const gate = runEditorialGates(issue, model);

// AFTER measurement.
const picks = allPicks(issue);
const whole = allIssueText(issue);
const afterWords = whole.split(/\s+/).filter(Boolean).length;
const afterWhy = picks.filter((p) => causalRe.test(p.body) || /no catalyst|no obvious|drift|cooling|demand|floor|supply|listing/i.test(p.body)).length;
const afterVerdict = picks.filter((p) => verdictRe.test(p.body)).length;
const afterHedge = picks.filter((p) => /likely|feels like|my read|looks like|probably|no catalyst|honest read|just |seems/i.test(p.body)).length;
const afterPov = /\bI'd\b|\bI'm\b|my read|as someone|here's what I/i.test(whole);

// Write the AFTER issue to _pending (canonical record; nothing sends).
const outDir = path.join(process.cwd(), "docs", "newsletter-drafts", "_pending");
fs.mkdirSync(outDir, { recursive: true });
const dateSlug = generatedAt.slice(0, 10);
const md = serializeEditorialIssue(issue, { gatesPassed: gate.passed });
const outPath = path.join(outDir, `editorial-${dateSlug}.md`);
fs.writeFileSync(outPath, md, "utf8");

console.log(`\n[editorial] wrote ${path.relative(process.cwd(), outPath)}`);
console.log("\n========== BEFORE -> AFTER MEASUREMENT (ADR-080) ==========");
console.log(`picks:            BEFORE ${beforePicks.length}  ->  AFTER ${picks.length}`);
console.log(`picks WITH a why: BEFORE ${beforeWhy}  ->  AFTER ${afterWhy}/${picks.length}`);
console.log(`picks WITH verdict: BEFORE ${beforeVerdict}  ->  AFTER ${afterVerdict}/${picks.length}`);
console.log(`picks hedged:     BEFORE n/a  ->  AFTER ${afterHedge}/${picks.length}`);
console.log(`first-person POV: BEFORE ${beforePov}  ->  AFTER ${afterPov}`);
console.log(`Big Move / Seller's Note / $50 call present: AFTER ${!!issue.bigMove.body} / ${!!issue.sellersNote} / ${/\$?\s?50\b|fifty/i.test(issue.theRead)}`);
console.log(`word count:       BEFORE ${beforeWords}  ->  AFTER ${afterWords}`);
console.log(`editorial gates:  AFTER ${gate.passed ? "PASS (all)" : "FAIL: " + gate.failures.join(" | ")}`);
console.log("===========================================================");
