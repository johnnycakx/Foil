// Compose a single-file briefing from the second-brain docs, suitable for
// pasting into a fresh Claude.ai chat to bring it up to speed on Foil.
//
// Usage:
//   node --experimental-strip-types scripts/generate-briefing.ts
//
// Output:
//   docs/BRIEFING.md (overwritten on each run) — paste this into the new
//   chat as your opening message.
//
// Why a script rather than a static template: this auto-stays-current. Run
// it whenever you start a new strategy chat and the briefing reflects the
// latest CLAUDE.md, ROADMAP, SESSION-LOG entry, and open risks.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT_PATH = path.join(ROOT, "docs", "BRIEFING.md");

function read(relPath: string): string {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return `(missing: ${relPath})`;
  return fs.readFileSync(p, "utf8");
}

/**
 * SESSION-LOG entries are separated by `---`. The "top entry" is everything
 * from the first `## ` heading up to (but not including) the next `---`.
 */
function topSessionLogEntry(): string {
  const raw = read("docs/SESSION-LOG.md");
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("## "));
  if (start < 0) return "(no session-log entries yet)";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("---")) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

/**
 * Extract the NOW + NEXT sections from ROADMAP — LATER and PARKED are too
 * much detail for a 1-shot briefing. The reader can ask for them.
 */
function roadmapNowAndNext(): string {
  const raw = read("docs/ROADMAP.md");
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inTargetSection = false;
  for (const line of lines) {
    if (/^## NOW\b/i.test(line)) {
      inTargetSection = true;
    } else if (/^## (LATER|PARKED)\b/i.test(line)) {
      inTargetSection = false;
    }
    if (inTargetSection) out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Pull only the High and Medium severity risks. Low-severity rows are noise
 * for a strategy chat unless asked for.
 */
function highMediumRisks(): string {
  const raw = read("docs/RISKS.md");
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let inEntry = false;
  let entryLines: string[] = [];
  let entryIsHighMed = false;

  const flush = () => {
    if (entryIsHighMed && entryLines.length > 0) {
      out.push(entryLines.join("\n").trim());
      out.push("");
    }
    entryLines = [];
    entryIsHighMed = false;
  };

  for (const line of lines) {
    if (/^## R-\d/.test(line)) {
      flush();
      inEntry = true;
      entryLines.push(line);
      continue;
    }
    if (inEntry) {
      if (line.startsWith("---") || /^## How to/.test(line)) {
        flush();
        inEntry = false;
        continue;
      }
      entryLines.push(line);
      if (/\*\*Severity:\*\*\s*(High|Medium)/i.test(line)) {
        entryIsHighMed = true;
      }
    }
  }
  flush();
  return out.join("\n").trim() || "(no High/Medium risks open)";
}

const claudeMd = read("CLAUDE.md");
const sessionEntry = topSessionLogEntry();
const roadmap = roadmapNowAndNext();
const risks = highMediumRisks();

const today = new Date().toISOString().slice(0, 10);

const briefing = `# Foil — Project Briefing (auto-generated ${today})

Paste this whole file as the opening message of a fresh Claude.ai chat to
bring it up to speed on the build before discussing anything new.

---

## What Foil is + the stack

${claudeMd.trim()}

---

## Most recent session

${sessionEntry}

---

## Active roadmap (NOW + NEXT only — ask for LATER/PARKED if needed)

${roadmap}

---

## Open risks worth knowing about

${risks}

---

## What I want to discuss in this chat

<your question goes here — replace this line>
`;

fs.writeFileSync(OUT_PATH, briefing);

const sizeKb = (briefing.length / 1024).toFixed(1);
const lines = briefing.split("\n").length;

console.log("");
console.log("================================================================");
console.log(`  Briefing written → ${path.relative(ROOT, OUT_PATH)}`);
console.log("================================================================");
console.log(`  Size           : ${sizeKb} KB · ${lines} lines`);
console.log(`  Composed from  : CLAUDE.md, docs/SESSION-LOG.md (top entry),`);
console.log(`                   docs/ROADMAP.md (NOW + NEXT), docs/RISKS.md (High + Medium)`);
console.log("");
console.log("  Next step:");
console.log("    cat docs/BRIEFING.md | clip        # Windows: copy to clipboard");
console.log("    cat docs/BRIEFING.md | pbcopy      # macOS");
console.log("    cat docs/BRIEFING.md               # or just read + paste manually");
console.log("================================================================");
