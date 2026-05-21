// Shared types for the autonomous newsletter pipeline. Defined separately so
// tests can import them without pulling Anthropic's SDK transitively.

export type NewsletterBlogPostInput = {
  /** Blog post slug — used to build the "Read the full post" link. */
  slug: string;
  /** Article title, reused as the seed for subject-line generation. */
  title: string;
  /** Article meta description / standfirst. */
  description: string;
  /** Full MDX body. Subject-line and draft generation use this as the
   *  fact-grounding source — nothing outside this string may be cited. */
  content: string;
  /** Frontmatter tags. Carried into the prompt for tone/topic guidance. */
  tags?: string[];
  /** Primary keyword from the cluster strategy doc. */
  primaryKeyword?: string;
};

export type NewsletterDraft = {
  /** Final chosen subject line (gate-passing, 30-65 chars). */
  subject: string;
  /** Preview text shown next to the subject in inbox previews — second-best
   *  candidate from the subject-line generator. */
  previewText: string;
  /** Newsletter body as raw HTML, ready to hand to Beehiiv's body_content. */
  htmlBody: string;
  /** Newsletter body as plain text (for word-count + link gates). */
  textBody: string;
  /** Word count of textBody. */
  wordCount: number;
  /** The 3 subject candidates the generator produced, in preference order. */
  subjectCandidates: string[];
};
