// Generates the single-page A4 PDF one-pager Foil attaches to its eBay
// Application Growth Check application. Reviewer-facing summary of the
// compliance posture — sourced from lib/legal/ebay-compliance-content.ts so
// it stays synchronized with the public page and the canonical doc.
//
// Run via:
//   npm run compliance:pdf
//
// Output:
//   public/compliance/foil-ebay-api-compliance.pdf  (committed binary)
//
// The output PDF is served as a static asset at
// https://foiltcg.com/compliance/foil-ebay-api-compliance.pdf and linked
// from /legal/ebay-api-compliance. Regenerate after any change to the
// content module and commit the new binary in the same change.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import {
  ARCHITECTURE_PARAGRAPHS,
  CONTACT_FOOTER,
  PAGE_INTRO,
  REQUIREMENTS,
} from "../lib/legal/ebay-compliance-content.ts";

const REVIEW_DATE = "2026-05-24";
const PUBLIC_URL = "https://foiltcg.com/legal/ebay-api-compliance";
const CONTACT_EMAIL = "john.c.craig24@gmail.com";

function resolveCommitSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

type PDFDocumentInstance = InstanceType<typeof PDFDocument>;

function buildPdf(doc: PDFDocumentInstance, commitSha: string): void {
  // Colors
  const ink = "#0B1426";
  const muted = "#4A5568";
  const accent = "#C2410C";
  const rule = "#CBD5E1";
  const panel = "#F1F5F9";

  // Layout constants (A4 = 595.28 × 841.89 pt)
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginX = 36;
  const marginTop = 36;
  const marginBottom = 36;
  const contentWidth = pageWidth - marginX * 2;

  // -- Header ---------------------------------------------------------------
  doc
    .fillColor(accent)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Foil — eBay API Compliance", marginX, marginTop, {
      width: contentWidth,
      align: "left",
    });

  const headerMetaY = doc.y + 2;
  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      `Last reviewed ${REVIEW_DATE}  ·  Commit ${commitSha}  ·  ${PUBLIC_URL}`,
      marginX,
      headerMetaY,
      { width: contentWidth },
    );

  doc
    .moveTo(marginX, doc.y + 4)
    .lineTo(pageWidth - marginX, doc.y + 4)
    .strokeColor(rule)
    .lineWidth(0.5)
    .stroke();

  doc.moveDown(0.6);

  // -- What Foil does -------------------------------------------------------
  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("What Foil does with eBay API data", { width: contentWidth });

  doc.moveDown(0.2);
  doc
    .fillColor(ink)
    .font("Helvetica")
    .fontSize(7.5)
    .text(PAGE_INTRO, { width: contentWidth, align: "justify", lineGap: 0.5 });

  doc.moveDown(0.5);

  // -- Architecture ---------------------------------------------------------
  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("Architecture", { width: contentWidth });

  doc.moveDown(0.2);
  doc
    .fillColor(ink)
    .font("Helvetica")
    .fontSize(7.5)
    .text(ARCHITECTURE_PARAGRAPHS[0], {
      width: contentWidth,
      align: "justify",
      lineGap: 0.5,
    });

  doc.moveDown(0.3);

  // Single-import-boundary diagram — inline, drawn with primitives so it
  // does not need an external image asset and the binary stays tiny.
  const diagramY = doc.y;
  const diagramHeight = 38;
  drawDiagram(doc, marginX, diagramY, contentWidth, diagramHeight, {
    ink,
    muted,
    rule,
    panel,
    accent,
  });
  doc.y = diagramY + diagramHeight + 4;

  // Four bullets summarizing the architecture invariants.
  const bullets: ReadonlyArray<[string, string]> = [
    ["Render-time only.", "Listings fetched server-side on each page request, response discarded the moment the page renders."],
    ["No persist.", "No cached_listings table; no listing payload columns anywhere in the schema; telemetry rows store operational metadata only."],
    ["No train.", "Content-generation pipeline never imports lib/affiliate/* and never calls api.ebay.com — architectural absence, not a runtime check."],
    ["CI-enforced.", "Six structural invariants in lib/__tests__/ebay-compliance-invariants.test.ts fail the build on any regression."],
  ];
  doc.font("Helvetica").fontSize(7.5).fillColor(ink);
  for (const [head, tail] of bullets) {
    const bulletY = doc.y;
    doc.fillColor(accent).text("• ", marginX, bulletY, { continued: true, width: contentWidth });
    doc.fillColor(ink).font("Helvetica-Bold").text(`${head} `, { continued: true });
    doc.font("Helvetica").text(tail, { width: contentWidth, lineGap: 0.5 });
    doc.moveDown(0.1);
  }

  doc.moveDown(0.4);

  // -- Compliance requirements table ----------------------------------------
  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("Compliance requirements", { width: contentWidth });

  doc.moveDown(0.2);

  // Two-column table — Requirement (title) + How Foil complies (body).
  // Numbers in the left column, condensed text in the right.
  const numColX = marginX;
  const numColW = 14;
  const titleColX = numColX + numColW;
  const titleColW = 175;
  const bodyColX = titleColX + titleColW + 6;
  const bodyColW = contentWidth - (titleColW + numColW + 6);

  // Header row
  const tableHeaderY = doc.y;
  doc
    .fillColor(muted)
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .text("#", numColX, tableHeaderY, { width: numColW })
    .text("Requirement", titleColX, tableHeaderY, { width: titleColW })
    .text("How Foil complies", bodyColX, tableHeaderY, { width: bodyColW });
  const headerBottom = Math.max(doc.y, tableHeaderY + 8);
  doc
    .moveTo(marginX, headerBottom)
    .lineTo(pageWidth - marginX, headerBottom)
    .strokeColor(rule)
    .lineWidth(0.4)
    .stroke();

  doc.y = headerBottom + 2;

  doc.fillColor(ink).font("Helvetica").fontSize(6.5);
  REQUIREMENTS.forEach((req, i) => {
    const rowY = doc.y;
    doc
      .fillColor(accent)
      .font("Helvetica-Bold")
      .text(String(i + 1), numColX, rowY, { width: numColW });
    doc
      .fillColor(ink)
      .font("Helvetica-Bold")
      .text(req.title, titleColX, rowY, { width: titleColW, lineGap: 0.3 });
    const titleEndY = doc.y;
    doc
      .fillColor(ink)
      .font("Helvetica")
      .text(req.body, bodyColX, rowY, { width: bodyColW, lineGap: 0.3 });
    const rowBottom = Math.max(titleEndY, doc.y) + 1.5;
    doc.y = rowBottom;
  });

  doc.moveDown(0.2);
  doc
    .fillColor(muted)
    .font("Helvetica-Oblique")
    .fontSize(6.5)
    .text(
      `Every row has a CI guard; details at ${PUBLIC_URL} and on request.`,
      marginX,
      doc.y,
      { width: contentWidth },
    );

  doc.moveDown(0.5);

  // -- Marketplace Account Deletion paragraph -------------------------------
  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("Marketplace Account Deletion", { width: contentWidth });

  doc.moveDown(0.2);
  doc
    .fillColor(ink)
    .font("Helvetica")
    .fontSize(7.5)
    .text(ARCHITECTURE_PARAGRAPHS[2], {
      width: contentWidth,
      align: "justify",
      lineGap: 0.5,
    });

  // -- Footer ---------------------------------------------------------------
  const footerY = pageHeight - marginBottom - 14;
  doc
    .moveTo(marginX, footerY - 4)
    .lineTo(pageWidth - marginX, footerY - 4)
    .strokeColor(rule)
    .lineWidth(0.4)
    .stroke();
  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(6.5)
    .text(
      `${PUBLIC_URL}  ·  ${CONTACT_EMAIL}  ·  Commit ${commitSha}  ·  ${CONTACT_FOOTER}`,
      marginX,
      footerY,
      { width: contentWidth, align: "center" },
    );
}

function drawDiagram(
  doc: PDFDocumentInstance,
  x: number,
  y: number,
  width: number,
  height: number,
  colors: { ink: string; muted: string; rule: string; panel: string; accent: string },
): void {
  // Three lanes: Visitor request → Foil server (Browse module) → eBay API.
  // A separate row below shows the deletion webhook + telemetry rollup.
  const laneW = (width - 24) / 3;
  const laneTop = y;
  const laneH = height - 14;

  const lanes: ReadonlyArray<{ title: string; sub: string }> = [
    { title: "Visitor request", sub: "/cards/[slug]" },
    { title: "Foil server (single-import)", sub: "lib/affiliate/ebay-browse.ts" },
    { title: "eBay Browse API", sub: "api.ebay.com (no-store)" },
  ];

  lanes.forEach((lane, i) => {
    const lx = x + i * (laneW + 12);
    doc
      .roundedRect(lx, laneTop, laneW, laneH, 3)
      .fillAndStroke(colors.panel, colors.rule);
    doc
      .fillColor(colors.ink)
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .text(lane.title, lx + 4, laneTop + 4, { width: laneW - 8 });
    doc
      .fillColor(colors.muted)
      .font("Helvetica")
      .fontSize(5.5)
      .text(lane.sub, lx + 4, laneTop + 13, { width: laneW - 8 });

    if (i < lanes.length - 1) {
      const arrowY = laneTop + laneH / 2;
      const arrowStartX = lx + laneW + 1;
      const arrowEndX = lx + laneW + 11;
      doc
        .moveTo(arrowStartX, arrowY)
        .lineTo(arrowEndX, arrowY)
        .strokeColor(colors.accent)
        .lineWidth(0.8)
        .stroke();
      doc
        .moveTo(arrowEndX, arrowY)
        .lineTo(arrowEndX - 3, arrowY - 2)
        .lineTo(arrowEndX - 3, arrowY + 2)
        .closePath()
        .fillColor(colors.accent)
        .fill();
    }
  });

  // Footnote row beneath the three lanes.
  const footY = laneTop + laneH + 2;
  doc
    .fillColor(colors.muted)
    .font("Helvetica-Oblique")
    .fontSize(5.5)
    .text(
      "Response discarded after render. Deletion webhook at /api/webhooks/ebay-marketplace-deletion handles eBay's HMAC challenge synchronously and persists nothing.",
      x,
      footY,
      { width },
    );
}

/**
 * Generate the compliance PDF and return its bytes + page count.
 *
 * Exported so the drift test can render in-memory without writing to
 * disk. The CLI entry point below writes the buffer to the canonical
 * public path; callers may persist the buffer wherever they need.
 */
export function generateCompliancePdf(opts?: { commitSha?: string }): Promise<{
  buffer: Buffer;
  pageCount: number;
}> {
  return new Promise((resolve, reject) => {
    const commitSha = opts?.commitSha ?? resolveCommitSha();
    const doc = new PDFDocument({
      size: "A4",
      margin: 36,
      info: {
        Title: "Foil — eBay API Compliance",
        Author: "Foil",
        Subject: "eBay API compliance one-pager for Application Growth Check review",
        Keywords: "eBay Browse API, Marketplace Account Deletion, EPN, compliance",
        CreationDate: new Date("2026-05-24T00:00:00Z"),
        ModDate: new Date("2026-05-24T00:00:00Z"),
      },
    });

    // The constructor adds the initial page before listeners attach, so
    // seed the counter at 1 and increment on each subsequent pageAdded.
    let pageCount = 1;
    doc.on("pageAdded", () => {
      pageCount += 1;
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), pageCount }));
    doc.on("error", reject);

    try {
      buildPdf(doc, commitSha);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// CLI entry point — only runs when invoked directly, not when imported.
// ---------------------------------------------------------------------------

const invokedAsScript = (() => {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  const outputPath = join(
    process.cwd(),
    "public",
    "compliance",
    "foil-ebay-api-compliance.pdf",
  );
  mkdirSync(dirname(outputPath), { recursive: true });

  const { buffer, pageCount } = await generateCompliancePdf();
  writeFileSync(outputPath, buffer);
  const sizeKb = (buffer.byteLength / 1024).toFixed(1);
  console.log(
    `Wrote ${outputPath} (${sizeKb} KB, ${pageCount} page${pageCount === 1 ? "" : "s"})`,
  );
  if (pageCount !== 1) {
    console.error(`ERROR: PDF must be a single A4 page; got ${pageCount} pages.`);
    process.exit(2);
  }
}
