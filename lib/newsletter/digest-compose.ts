// The weekly digest COMPOSER (NL-EDIT-SHIP, extends ADR-079/080). Decides what
// the weekly newsletter send actually is: the EDITORIAL issue by default, with
// the DETERMINISTIC movers digest as a guaranteed SOFT-FALL.
//
// The contract (the whole point of this module):
//   1. Try the editorial engine: generate the issue (gate-validated inside,
//      throws after a 3-strike), render it through the branded editorial
//      template, then re-check the RENDER-LAYER affiliate invariant (every eBay
//      link wrapped — the LLM emits no links, the template attaches them, so
//      this can only be verified post-render). On full success → send the
//      editorial issue.
//   2. On ANY editorial failure — gate 3-strike, LLM/network error, parse
//      error, or a render-layer affiliate failure — FALL BACK to the
//      deterministic digest (render + the existing quality gate). A generation
//      failure must NEVER block the weekly send; the week is only skipped if the
//      deterministic safety net ALSO fails its gate (a genuinely bad-data week).
//
// Pure orchestration over injected IO (generate/render/gate), so the soft-fall
// branch is unit-tested with fakes (lib/__tests__/digest-compose.test.ts)
// without an LLM call, a Supabase row, or a network send.

import type { MarketMovers } from "../deals/market-movers-read.ts";
import type { DigestModel, MoversDigestParts } from "./movers-digest.ts";
import type { EditorialIssue } from "./editorial-engine.ts";
import type { DigestGateResult } from "./digest-quality-gate.ts";
import { affiliateLinkIntegrity } from "./digest-quality-gate.ts";
import { editorialPreviewText, serializeEditorialIssue } from "./editorial-serialize.ts";

export type DigestSource = "editorial" | "deterministic";

export type ComposedDigest = {
  source: DigestSource;
  subject: string;
  previewText: string;
  /** The branded HTML body to persist + broadcast. */
  html: string;
  /** The canonical Markdown record (draft.markdown_body). */
  markdownBody: string;
  downCount: number;
  upCount: number;
};

export type DigestSkip = { skip: true; reason: string; failures?: string[] };

export function isSkip(r: ComposedDigest | DigestSkip): r is DigestSkip {
  return (r as DigestSkip).skip === true;
}

export type ComposeDigestDeps = {
  model: DigestModel;
  movers: MarketMovers;
  /** The deterministic parts (subject/preview/body/counts) — the fallback content. */
  parts: MoversDigestParts;
  /** Generate the editorial issue (real: generateEditorialIssue). Throws on a
   *  3-strike gate failure or an LLM error — that throw is the fallback trigger. */
  generateEditorial: (model: DigestModel) => Promise<EditorialIssue>;
  /** Render the editorial issue to branded HTML (real: renderEditorialDigestEmail). */
  renderEditorial: (issue: EditorialIssue, model: DigestModel) => Promise<string>;
  /** Render the deterministic digest to branded HTML (real: renderMoversDigestEmail). */
  renderDeterministic: (model: DigestModel) => Promise<string>;
  /** The deterministic quality gate (real: runDigestQualityGates). */
  runDeterministicGate: (input: { parts: MoversDigestParts; movers: MarketMovers; html: string }) => DigestGateResult;
  /** Observability hooks (the cron logs the fallback; tests assert it fired). */
  onEditorialSuccess?: (issue: EditorialIssue) => void;
  onEditorialFallback?: (err: Error) => void;
};

/**
 * Compose the weekly digest: editorial-first, deterministic soft-fall, skip only
 * if both fail. Returns the chosen content (with its `source`) or a skip reason.
 */
export async function composeDigestForSend(deps: ComposeDigestDeps): Promise<ComposedDigest | DigestSkip> {
  const { model, movers, parts } = deps;
  const downCount = parts.downCount;
  const upCount = parts.upCount;

  // --- 1. Editorial path (default) -----------------------------------------
  try {
    const issue = await deps.generateEditorial(model);
    const html = await deps.renderEditorial(issue, model);

    // Render-layer affiliate invariant: the template attaches the links, so this
    // is only checkable after rendering. A failure here is a render bug, not a
    // bad week — fall back so the send still happens, but never ship untracked.
    const affiliate = affiliateLinkIntegrity(html);
    if (!affiliate.ok) {
      throw new Error(`editorial render failed the affiliate-link integrity check: ${affiliate.reason}`);
    }

    deps.onEditorialSuccess?.(issue);
    return {
      source: "editorial",
      subject: issue.subject,
      previewText: editorialPreviewText(issue),
      html,
      markdownBody: serializeEditorialIssue(issue, { gatesPassed: true }),
      downCount,
      upCount,
    };
  } catch (err) {
    deps.onEditorialFallback?.(err as Error);
    // fall through to the deterministic safety net
  }

  // --- 2. Deterministic soft-fall ------------------------------------------
  const html = await deps.renderDeterministic(model);
  const gate = deps.runDeterministicGate({ parts, movers, html });
  if (!gate.passed) {
    // Both the editorial path AND the deterministic safety net failed — this is a
    // genuinely bad-data week, so skip the send (no card, no email).
    return { skip: true, reason: "deterministic_gate_failed", failures: gate.failures };
  }

  return {
    source: "deterministic",
    subject: parts.subject,
    previewText: parts.previewText,
    html,
    markdownBody: parts.bodyMarkdown,
    downCount,
    upCount,
  };
}
