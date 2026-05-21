// Subject-line generation. Folded into the same Claude call as the body to
// keep round trips to one — the model already has the blog-post context loaded
// when it writes the body, so asking it to emit 3 subject candidates in the
// same JSON output is strictly cheaper than a second call.
//
// Public surface: callers can either go through generateNewsletterDraft (which
// returns subjectCandidates on the draft) or call generateSubjectLines
// directly for tests / regenerating just the subjects.

import { generateNewsletterDraft } from "./draft-generator.ts";
import type { NewsletterBlogPostInput } from "./types.ts";

/**
 * Returns 3 subject-line candidates for a blog post, all within
 * NEWSLETTER_GATE_LIMITS.subject{Min,Max}. Picks the first as the active
 * subject; the second feeds the inbox preview text; the third is a fallback
 * the engine drops on the floor today (kept for future A/B testing).
 */
export async function generateSubjectLines(
  blogPost: NewsletterBlogPostInput,
): Promise<string[]> {
  const draft = await generateNewsletterDraft(blogPost);
  return draft.subjectCandidates;
}
