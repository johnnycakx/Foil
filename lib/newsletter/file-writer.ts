// Serializes a generated newsletter into a paste-ready Markdown file under
// docs/newsletter-drafts/. This is the canonical record per ADR-012 — the
// email is the immediate ping; the .md file is the permanent artifact that
// stays in the repo, version-controlled, searchable, and recoverable if the
// inbox copy gets lost.
//
// Pure string assembly; no fs side effects. Caller writes the result.

import type { NewsletterDraft } from "./types.ts";

export type NewsletterFileInput = {
  blogSlug: string;
  blogTitle: string;
  blogUrl: string;
  /** Words in the source blog post. */
  sourceWordCount: number;
  /** ISO timestamp string used in both frontmatter + body. */
  generatedAt: string;
  /** Why this topic was picked. */
  topicRationale: string;
  /** The Beehiiv outcome at generation time — "deferred" until John pastes. */
  beehiivStatus: "deferred-manual-paste" | "auto-drafted" | "send-failed";
  /** Resend message id, when the email send succeeded. */
  emailMessageId?: string;
  draft: NewsletterDraft;
};

/**
 * Header separator written between the YAML frontmatter and the newsletter
 * body. Exported so tests can pin the contract — anything downstream parsing
 * these files relies on this exact delimiter sequence.
 */
export const NEWSLETTER_BODY_SEPARATOR = "\n\n## Newsletter body (paste-ready)\n\n";

export function serializeNewsletterFile(input: NewsletterFileInput): string {
  const fm = renderFrontmatter(input);
  const body = renderBodySection(input);
  return `${fm}${NEWSLETTER_BODY_SEPARATOR}${body}\n`;
}

function renderFrontmatter(input: NewsletterFileInput): string {
  const lines = [
    "---",
    `blogSlug: "${escapeYaml(input.blogSlug)}"`,
    `blogTitle: "${escapeYaml(input.blogTitle)}"`,
    `blogUrl: "${escapeYaml(input.blogUrl)}"`,
    `subject: "${escapeYaml(input.draft.subject)}"`,
    `previewText: "${escapeYaml(input.draft.previewText)}"`,
    `wordCount: ${input.draft.wordCount}`,
    `sourceWordCount: ${input.sourceWordCount}`,
    `generatedAt: "${input.generatedAt}"`,
    `beehiivStatus: "${input.beehiivStatus}"`,
  ];
  if (input.emailMessageId) {
    lines.push(`emailMessageId: "${escapeYaml(input.emailMessageId)}"`);
  }
  lines.push("subjectCandidates:");
  for (const c of input.draft.subjectCandidates) {
    lines.push(`  - "${escapeYaml(c)}"`);
  }
  lines.push(`topicRationale: |`);
  for (const line of input.topicRationale.split("\n")) {
    lines.push(`  ${line}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function renderBodySection(input: NewsletterFileInput): string {
  return [
    `**Subject:** ${input.draft.subject}`,
    `**Preview text:** ${input.draft.previewText}`,
    ``,
    `---`,
    ``,
    input.draft.htmlBody,
  ].join("\n");
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
