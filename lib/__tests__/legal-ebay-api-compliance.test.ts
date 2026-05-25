// Drift-detection for /legal/ebay-api-compliance.
//
// The public page sources its content from
// lib/legal/ebay-compliance-content.ts. The canonical internal doc
// lives at docs/EBAY-COMPLIANCE.md. This test asserts they stay in
// sync — adding a new requirement row to the markdown forces a
// matching entry in the content module before the build passes.
//
// Also pins reviewer-key phrases that must appear on the public page:
// "Marketplace Account Deletion", "no-store", "force-dynamic",
// "client_credentials".

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARCHITECTURE_PARAGRAPHS,
  PAGE_INTRO,
  REQUIREMENTS,
} from "../legal/ebay-compliance-content.ts";

const ROOT = new URL("../..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const COMPLIANCE_DOC = join(ROOT, "docs/EBAY-COMPLIANCE.md");

/**
 * Parse the section-c requirement table from EBAY-COMPLIANCE.md and
 * return the bold-prefixed title in each row's Requirement column.
 *
 * Row format pinned by docs/EBAY-COMPLIANCE.md authoring:
 *   | N | **Title.** (source) | Enforced at ... | Pinned by ... |
 *
 * The bold-text-prefix is what we extract and compare against
 * REQUIREMENTS[i].title in the content module.
 */
function parseRequirementTitlesFromMarkdown(): string[] {
  const md = readFileSync(COMPLIANCE_DOC, "utf8");
  const titles: string[] = [];
  // Match: pipe + space + digit(s) + space + pipe + space + **...** + ...
  // The bold prefix may include backticks (e.g. `client_credentials`).
  const rowPattern = /^\|\s*\d+\s*\|\s*\*\*(.+?)\*\*/gm;
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(md)) !== null) {
    titles.push(match[1].trim());
  }
  return titles;
}

test("drift: every requirement in EBAY-COMPLIANCE.md section c is mirrored in the content module", () => {
  const fromMarkdown = parseRequirementTitlesFromMarkdown();
  assert.ok(
    fromMarkdown.length > 0,
    "Failed to parse any requirement rows from EBAY-COMPLIANCE.md — table format may have changed",
  );

  const fromModule = REQUIREMENTS.map((r) => r.title);

  // Set equality: every markdown row must have a matching content-module
  // entry AND vice versa. A drift in EITHER direction fails.
  const missingFromPage = fromMarkdown.filter((t) => !fromModule.includes(t));
  const stalePageEntries = fromModule.filter((t) => !fromMarkdown.includes(t));

  const errors: string[] = [];
  if (missingFromPage.length > 0) {
    errors.push(
      `\nMissing from /legal/ebay-api-compliance page (add to lib/legal/ebay-compliance-content.ts REQUIREMENTS):\n  - ${missingFromPage.join("\n  - ")}`,
    );
  }
  if (stalePageEntries.length > 0) {
    errors.push(
      `\nStale entries in /legal/ebay-api-compliance page (not present in docs/EBAY-COMPLIANCE.md — remove or update):\n  - ${stalePageEntries.join("\n  - ")}`,
    );
  }
  assert.deepEqual(errors, [], errors.join("\n"));
});

test("drift: markdown + content module count match", () => {
  const fromMarkdown = parseRequirementTitlesFromMarkdown();
  assert.equal(
    REQUIREMENTS.length,
    fromMarkdown.length,
    `REQUIREMENTS has ${REQUIREMENTS.length} entries, EBAY-COMPLIANCE.md has ${fromMarkdown.length} table rows — these must match`,
  );
});

test("reviewer-key phrases all present in the content module text", () => {
  // The Application Growth Check reviewer should be able to land on the
  // page and find these signals immediately. Each phrase appearing in
  // either the intro, the architecture paragraphs, or any requirement
  // body satisfies the assertion.
  const haystack = [PAGE_INTRO, ...ARCHITECTURE_PARAGRAPHS, ...REQUIREMENTS.flatMap((r) => [r.title, r.body])].join(" ");

  const REQUIRED_PHRASES = [
    "Marketplace Account Deletion",
    "no-store",
    "force-dynamic",
    "client_credentials",
  ];
  const missing = REQUIRED_PHRASES.filter((p) => !haystack.includes(p));
  assert.deepEqual(
    missing,
    [],
    `Reviewer-key phrases missing from /legal/ebay-api-compliance page content: ${missing.join(", ")}`,
  );
});

test("every REQUIREMENTS entry has a non-empty body", () => {
  for (const r of REQUIREMENTS) {
    assert.ok(r.body.trim().length > 0, `Requirement "${r.title}" has empty body`);
    // Also: minimum length so a contributor doesn't add a stub.
    assert.ok(r.body.length >= 80, `Requirement "${r.title}" body is suspiciously short (< 80 chars)`);
  }
});

test("page narrative is non-trivial — intro + architecture paragraphs present", () => {
  assert.ok(PAGE_INTRO.length >= 100);
  assert.ok(ARCHITECTURE_PARAGRAPHS.length >= 1);
  for (const p of ARCHITECTURE_PARAGRAPHS) {
    assert.ok(p.length >= 60, `architecture paragraph too short: ${p.slice(0, 60)}…`);
  }
});
