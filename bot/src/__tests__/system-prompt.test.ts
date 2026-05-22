// system-prompt.ts: persona selection + section extractors. The extractors
// are the load-bearing piece — they decide what makes it into <foil_context>.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildSystemPrompt,
  extractLatestSession,
  extractRecentIdeas,
  extractRisksHighMedium,
  extractRoadmapNowNext,
  parseIdeasFile,
  personaForChannel,
} from "../system-prompt.ts";

test("personaForChannel maps known channel names to personas", () => {
  assert.equal(personaForChannel("content-engine"), "content");
  assert.equal(personaForChannel("#content-engine"), "content");
  assert.equal(personaForChannel("subscribers"), "subscribers");
  assert.equal(personaForChannel("errors"), "errors");
  assert.equal(personaForChannel("general"), "general");
  assert.equal(personaForChannel("any-other-channel"), "general");
  assert.equal(personaForChannel(null), "general");
});

test("extractRoadmapNowNext captures the NOW + NEXT sections only", () => {
  const md = `# Roadmap

## NOW
- A
- B

## NEXT
- C

## LATER
- D

## PARKED
- E
`;
  const out = extractRoadmapNowNext(md);
  assert.ok(out.includes("## NOW"));
  assert.ok(out.includes("## NEXT"));
  assert.ok(!out.includes("LATER"));
  assert.ok(!out.includes("PARKED"));
});

test("extractRisksHighMedium keeps High + Medium and drops Low", () => {
  const md = `# Risks

## R-001 — Content fab

**Severity:** High

Body of R-001.

## R-002 — Topic exhaustion

**Severity:** Medium

Body of R-002.

## R-003 — Brave rate limit

**Severity:** Low

Body of R-003 — should be cut.

## How to log a new risk

footer
`;
  const out = extractRisksHighMedium(md);
  assert.ok(out.includes("R-001"));
  assert.ok(out.includes("R-002"));
  assert.ok(!out.includes("R-003"));
  assert.ok(!out.includes("How to log"));
});

test("extractLatestSession returns only the first session entry", () => {
  const md = `# Session Log

## 2026-05-25 — Session 12

Latest.

## 2026-05-21 — Session 11

Older.

## How to log a session

footer
`;
  const out = extractLatestSession(md);
  assert.ok(out.includes("Session 12"));
  assert.ok(!out.includes("Session 11"));
  assert.ok(!out.includes("How to log"));
});

test("buildSystemPrompt assembles base + persona + <foil_context> + sections", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "foil-prompt-"));
  try {
    writeFileSync(path.join(dir, "BRIEFING.md"), "# Briefing\nBRIEFING_TOKEN");
    writeFileSync(
      path.join(dir, "ROADMAP.md"),
      "# Roadmap\n\n## NOW\n- A\n\n## NEXT\n- B\n\n## LATER\n- ignored\n",
    );
    writeFileSync(
      path.join(dir, "RISKS.md"),
      "# Risks\n\n## R-001\n**Severity:** High\nKEEP_HIGH\n\n## R-002\n**Severity:** Low\nDROP_LOW\n\n## How to log a new risk\n",
    );
    writeFileSync(
      path.join(dir, "SESSION-LOG.md"),
      "# Log\n\n## 2026-05-25 — Session 12\nSESSION_TOKEN\n\n## 2026-05-21 — Session 11\nOLDER\n\n## How to log a session\n",
    );

    const prompt = buildSystemPrompt({ channelName: "content-engine", docsDir: dir });

    assert.ok(prompt.includes("You are the Foil ops bot"));
    assert.ok(prompt.includes("strategic peer"));
    assert.ok(prompt.includes("#content-engine"));
    assert.ok(prompt.includes("<foil_context>"));
    assert.ok(prompt.includes("BRIEFING_TOKEN"));
    assert.ok(prompt.includes("## NOW"));
    assert.ok(prompt.includes("## NEXT"));
    assert.ok(prompt.includes("KEEP_HIGH"));
    assert.ok(!prompt.includes("DROP_LOW"));
    assert.ok(prompt.includes("SESSION_TOKEN"));
    assert.ok(!prompt.includes("OLDER"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("buildSystemPrompt picks the on-call eng persona for #errors", () => {
  const prompt = buildSystemPrompt({ channelName: "errors", docsDir: "/nonexistent" });
  assert.ok(prompt.includes("On-call posture"));
  assert.ok(prompt.includes("#errors"));
});

test("buildSystemPrompt falls back to general persona on unknown channel", () => {
  const prompt = buildSystemPrompt({ channelName: "lounge", docsDir: "/nonexistent" });
  // General persona greets as Foil HQ's catch-all and frames the COO posture.
  assert.ok(prompt.includes("Foil HQ's catch-all"));
  assert.ok(prompt.includes("strategic peer"));
});

test("parseIdeasFile extracts entries from per-entry frontmatter format", () => {
  const md = `# Ideas

Some prose.

---

---
date: 2026-05-22
category: product
status: captured
---
## Japanese-card support

Body sentence A. Body sentence B.

**Context:** trigger A.

---

---
date: 2026-05-22
category: monetization
status: promoted
---
## Lifetime tier

Body of lifetime.

**Context:** trigger B.

---

## Review cadence

footer
`;
  const out = parseIdeasFile(md);
  assert.equal(out.length, 2);
  assert.equal(out[0].title, "Japanese-card support");
  assert.equal(out[0].category, "product");
  assert.equal(out[0].status, "captured");
  assert.equal(out[1].title, "Lifetime tier");
  assert.equal(out[1].status, "promoted");
});

test("parseIdeasFile skips entries with unknown category or status", () => {
  const md = `---
date: 2026-05-22
category: bogus
status: captured
---
## Skip me

bad category.

---

---
date: 2026-05-22
category: product
status: captured
---
## Keep me

good.
`;
  const out = parseIdeasFile(md);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, "Keep me");
});

test("parseIdeasFile returns [] for missing/empty content", () => {
  assert.deepEqual(parseIdeasFile(""), []);
  assert.deepEqual(parseIdeasFile("# Ideas\n\nNo entries yet.\n"), []);
});

test("extractRecentIdeas caps to maxEntries and produces a single rendered block", () => {
  const blocks = Array.from({ length: 5 }, (_, i) =>
    [
      "---",
      "date: 2026-05-22",
      "category: product",
      "status: captured",
      "---",
      `## Idea ${i + 1}`,
      `Body ${i + 1}.`,
    ].join("\n"),
  ).join("\n\n");
  const out = extractRecentIdeas(blocks, { maxEntries: 3, maxChars: 1_000_000 });
  assert.ok(out.includes("Idea 1"));
  assert.ok(out.includes("Idea 2"));
  assert.ok(out.includes("Idea 3"));
  assert.ok(!out.includes("Idea 4"));
});

test("extractRecentIdeas surfaces category + status + date in the rendered block", () => {
  const md = `---
date: 2026-05-22
category: growth
status: captured
---
## Community moat

Body text here.
`;
  const out = extractRecentIdeas(md);
  assert.match(out, /\[growth\] Community moat/);
  assert.match(out, /captured, 2026-05-22/);
});

test("buildSystemPrompt includes IDEAS.md content in <foil_context>", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "foil-prompt-ideas-"));
  try {
    writeFileSync(path.join(dir, "BRIEFING.md"), "# Briefing");
    writeFileSync(path.join(dir, "ROADMAP.md"), "# Roadmap\n\n## NOW\n\n## NEXT\n\n## LATER\n");
    writeFileSync(path.join(dir, "RISKS.md"), "");
    writeFileSync(path.join(dir, "SESSION-LOG.md"), "");
    writeFileSync(
      path.join(dir, "IDEAS.md"),
      `---
date: 2026-05-22
category: product
status: captured
---
## IDEAS_PROBE

Body of idea.
`,
    );

    const out = buildSystemPrompt({ channelName: "general", docsDir: dir });
    assert.ok(out.includes("IDEAS.md"));
    assert.ok(out.includes("IDEAS_PROBE"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("buildSystemPrompt enforces token cap by truncating from the end", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "foil-prompt-cap-"));
  try {
    writeFileSync(path.join(dir, "BRIEFING.md"), "B".repeat(20000));
    writeFileSync(path.join(dir, "ROADMAP.md"), "# Roadmap\n\n## NOW\n- A\n\n## NEXT\n- B\n\n## LATER\n");
    writeFileSync(path.join(dir, "RISKS.md"), "");
    writeFileSync(path.join(dir, "SESSION-LOG.md"), "");

    const out = buildSystemPrompt({ channelName: "general", docsDir: dir, tokenCap: 1000 });
    assert.ok(out.length <= 1000 * 4 + 100, `expected ≤4100 chars, got ${out.length}`);
    assert.ok(out.includes("truncated to fit"));
  } finally {
    rmSync(dir, { recursive: true });
  }
});
