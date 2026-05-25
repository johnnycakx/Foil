// Drift-detection for the eBay compliance PDF one-pager.
//
// Sources from the same lib/legal/ebay-compliance-content.ts module as
// the public page + the markdown drift test. This test additionally
// asserts that:
//   - The script renders a single-page A4 PDF (no overflow).
//   - Every REQUIREMENTS body string is reachable in the extracted PDF
//     text (catches typography breakage that would silently truncate a
//     row, and catches a content-module entry that the generator forgot
//     to render).
//   - The four reviewer-key phrases the goal spec calls out — Marketplace
//     Account Deletion, no-store, force-dynamic, client_credentials —
//     appear in the body text.
//
// pdf-parse extracts text in reading order and inserts newlines at line
// wrap boundaries — including inside long URLs and hyphenated tokens. To
// make the assertion robust to where PDF layout chose to wrap, both sides
// are normalized by stripping ALL whitespace before substring matching.
// We still keep a whitespace-collapsed copy for the reviewer-key phrase
// check, since those phrases include intentional spaces.

import test from "node:test";
import assert from "node:assert/strict";
import { PDFParse } from "pdf-parse";
import { REQUIREMENTS } from "../legal/ebay-compliance-content.ts";
import { generateCompliancePdf } from "../../scripts/generate-compliance-pdf.ts";

const REVIEWER_KEY_PHRASES = [
  "Marketplace Account Deletion",
  "no-store",
  "force-dynamic",
  "client_credentials",
] as const;

/** Collapse runs of whitespace to a single space and trim. */
function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Strip ALL whitespace — for matching across PDF wrap-boundaries. */
function stripWs(s: string): string {
  return s.replace(/\s+/g, "");
}

test("compliance PDF: renders exactly one A4 page", async () => {
  const { pageCount, buffer } = await generateCompliancePdf({
    commitSha: "testsha",
  });
  assert.equal(pageCount, 1, "PDF must fit on a single A4 page");
  assert.ok(buffer.byteLength > 1024, "PDF must be non-trivial in size");
});

test("compliance PDF: every Requirement body is rendered into the PDF", async () => {
  const { buffer } = await generateCompliancePdf({ commitSha: "testsha" });
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  const haystack = stripWs(text);

  for (const req of REQUIREMENTS) {
    const needle = stripWs(req.body);
    assert.ok(
      haystack.includes(needle),
      `PDF text is missing requirement body for "${req.title}". ` +
        `Looked for: "${needle.slice(0, 80)}..."`,
    );
  }
});

test("compliance PDF: reviewer-key phrases all appear in the body", async () => {
  const { buffer } = await generateCompliancePdf({ commitSha: "testsha" });
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  const haystack = collapse(text);

  for (const phrase of REVIEWER_KEY_PHRASES) {
    assert.ok(
      haystack.includes(phrase),
      `PDF text is missing reviewer-key phrase: "${phrase}"`,
    );
  }
});

test("compliance PDF: commit SHA from options is rendered into the header", async () => {
  const { buffer } = await generateCompliancePdf({ commitSha: "deadbeef" });
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  assert.ok(
    text.includes("deadbeef"),
    "PDF should render the provided commit SHA so reviewers can trace the artifact to a build",
  );
});
