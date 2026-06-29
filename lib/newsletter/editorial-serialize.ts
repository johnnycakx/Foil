// Pure serialization + mapping helpers for the editorial issue (ADR-080 ->
// NL-EDIT-SHIP). Kept SEPARATE from editorial-engine.ts (which imports the
// Anthropic client) so the react-email template, the cron composer, and the
// tests can serialize / map an issue WITHOUT pulling the LLM client at module
// load. Everything here is a pure function over already-generated data.
//
//   - serializeEditorialIssue: the canonical Markdown record (one source of
//     truth for both the cron's draft.markdown_body and the generate script's
//     _pending artifact, so the two never drift).
//   - editorialPreviewText: the inbox preview line, derived from The Open.
//   - matchModelCard: lenient cardName -> DigestCardModel lookup, so the
//     template can attach the affiliate browse link the LLM was told not to emit.

import type { EditorialIssue } from "./editorial-engine.ts";
import type { DigestModel, DigestCardModel } from "./movers-digest.ts";

/** Normalize a card name for lenient matching (mirror of editorial-gates). */
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Find the DigestModel card a pick refers to. The engine echoes cardName
 * verbatim from the data, so an exact normalized match is the common path; the
 * substring fallback covers minor LLM drift ("Ethan's Ho-Oh ex" vs "Ho-Oh ex").
 * Returns null when nothing matches (the template then renders that pick without
 * a browse link rather than fabricate one).
 */
export function matchModelCard(cardName: string, model: DigestModel): DigestCardModel | null {
  const target = normName(cardName);
  if (!target) return null;
  const all = [...model.down, ...model.up];
  return (
    all.find((c) => normName(c.name) === target) ??
    all.find((c) => normName(c.name).includes(target) || target.includes(normName(c.name))) ??
    null
  );
}

/** The inbox preview line: the first sentence of The Open, capped so Gmail's
 *  preview doesn't truncate mid-thought. Falls back to the subject. */
export function editorialPreviewText(issue: EditorialIssue, maxLen = 140): string {
  const open = issue.open.trim();
  const source = open || issue.subject.trim();
  // First sentence (up to the first ". " boundary), else the whole open.
  const firstSentence = source.split(/(?<=[.!?])\s+/)[0] ?? source;
  const preview = firstSentence.length <= maxLen ? firstSentence : `${firstSentence.slice(0, maxLen - 1).trimEnd()}…`;
  return preview;
}

/**
 * Serialize an EditorialIssue to the canonical Markdown record. This is the
 * `_pending` artifact AND the draft.markdown_body persisted alongside the HTML,
 * so the human-readable record matches what was sent. Pure string assembly.
 *
 * @param opts.gatesPassed - stamped into the review header when known.
 */
export function serializeEditorialIssue(
  issue: EditorialIssue,
  opts: { gatesPassed?: boolean } = {},
): string {
  const gateLine =
    opts.gatesPassed === undefined ? "" : ` Gates: ${opts.gatesPassed ? "PASS" : "FAIL"}.`;
  return [
    `# ${issue.subject}`,
    ``,
    `> EDITORIAL ISSUE (ADR-080).${gateLine} Every $ figure traces to a real PokeTrace sold average; every cause is John's hedged read.`,
    ``,
    `**The Open**`,
    ``,
    issue.open,
    ``,
    `**The Big Move — ${issue.bigMove.cardName}**`,
    ``,
    issue.bigMove.body,
    ``,
    `**Cooling Off**`,
    ``,
    issue.coolingPicks.map((p) => `- **${p.cardName}** ${p.body}`).join("\n\n") || "_(no cooling picks this week)_",
    ``,
    `**Heating Up**`,
    ``,
    issue.heatingPicks.map((p) => `- **${p.cardName}** ${p.body}`).join("\n\n") || "_(no heating picks this week)_",
    ``,
    `**Seller's Note**`,
    ``,
    issue.sellersNote,
    ``,
    `**The Read**`,
    ``,
    issue.theRead,
    ``,
    `**One More Thing**`,
    ``,
    issue.oneMoreThing,
    ``,
    issue.signoff,
    ``,
  ].join("\n");
}
