// Internal-linking suggester. Produces a structured report of where existing
// posts should link to a new post, and where a new post should link back to
// existing pillars + clusters.
//
// Design tenet: this module SUGGESTS only — it never edits MDX files. The
// project-wide pattern is "AI proposes, John reviews" (draft posts land in
// _pending/, link edits land in a Markdown report). Auto-editing prose would
// undermine that review surface.

export type LinkablePost = {
  slug: string;
  title: string;
  /** The URL path that should be linked TO when targeting this post. */
  urlPath: string;
  /** Primary keyword (pillar) or rank-1 long-tail (cluster). */
  primaryKeyword: string;
  /** Additional keyword variants worth matching. */
  secondaryKeywords: readonly string[];
  /** Full MDX body (frontmatter stripped). */
  body: string;
  /** True for pillar pages, false for cluster posts. */
  isPillar: boolean;
};

export type LinkSuggestion = {
  source: LinkablePost;
  target: LinkablePost;
  matchedPhrase: string;
  /**
   * One-line excerpt of the source paragraph the match sits inside. Lets
   * John eyeball whether the surrounding prose actually supports the link
   * before editing.
   */
  context: string;
};

/**
 * Find paragraphs in `source` containing a keyword that targets one of the
 * given `targets`, where the paragraph does NOT already link to that target.
 * Returns at most one suggestion per (source, target) pair — quantity isn't
 * the goal, accuracy is.
 */
export function suggestLinks(
  source: LinkablePost,
  targets: readonly LinkablePost[],
): LinkSuggestion[] {
  const suggestions: LinkSuggestion[] = [];
  const paragraphs = splitParagraphs(source.body);

  for (const target of targets) {
    if (target.slug === source.slug) continue;

    // Skip targets the source already links to anywhere in the body. A second
    // link to the same destination would just dilute the anchor.
    if (alreadyLinks(source.body, target.urlPath)) continue;

    const phrases = [target.primaryKeyword, ...target.secondaryKeywords];
    let found: LinkSuggestion | null = null;

    for (const paragraph of paragraphs) {
      // Skip paragraphs that already link to ANYTHING — over-linking degrades
      // E-E-A-T. Pick a clean paragraph instead.
      if (/\]\(/.test(paragraph)) continue;

      for (const phrase of phrases) {
        const match = matchPhrase(paragraph, phrase);
        if (match) {
          found = {
            source,
            target,
            matchedPhrase: match,
            context: paragraph.trim().slice(0, 200),
          };
          break;
        }
      }
      if (found) break;
    }

    if (found) suggestions.push(found);
  }

  return suggestions;
}

/**
 * Convenience wrapper: build the full {incoming, outgoing} bundle for a newly
 * approved post. Mirrors the script's two-pass output: existing posts that
 * should link IN, and pillars/clusters the new post should link OUT to.
 */
export function suggestForNewPost(
  newPost: LinkablePost,
  existingPosts: readonly LinkablePost[],
): { incoming: LinkSuggestion[]; outgoing: LinkSuggestion[] } {
  const incoming = existingPosts.flatMap((source) =>
    suggestLinks(source, [newPost]),
  );
  const outgoing = suggestLinks(newPost, existingPosts);
  return { incoming, outgoing };
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => {
      if (p.length === 0) return false;
      // Skip headings, MDX components, code blocks, lists — those are
      // structural noise, not prose paragraphs where a contextual link belongs.
      if (p.startsWith("#")) return false;
      if (p.startsWith("<")) return false;
      if (p.startsWith("```")) return false;
      if (p.startsWith("-") || p.startsWith("*")) return false;
      if (/^\d+\./.test(p)) return false;
      return true;
    });
}

function alreadyLinks(body: string, urlPath: string): boolean {
  // Match Markdown link, MDX <Link href=...>, plain href=, and TopicLink href=
  const escaped = urlPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`href=["']${escaped}["']|\\]\\(${escaped}\\)`).test(body);
}

/**
 * Word-boundary, case-insensitive phrase match. Returns the actual matched
 * substring (preserving casing from the source) so callers can show the user
 * what to anchor on, or null if no match.
 */
function matchPhrase(paragraph: string, phrase: string): string | null {
  if (!phrase.trim()) return null;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  const m = paragraph.match(re);
  return m ? m[0] : null;
}

/**
 * Render the {incoming, outgoing} bundle to a Markdown report John can scan
 * in 30 seconds. Each suggestion: source title, link to file, suggested
 * anchor, and the surrounding excerpt.
 */
export function renderReport(
  newPost: LinkablePost,
  bundle: { incoming: LinkSuggestion[]; outgoing: LinkSuggestion[] },
): string {
  const lines: string[] = [];
  lines.push(`# Internal link suggestions for ${newPost.title}`);
  lines.push("");
  lines.push(`Target: \`${newPost.urlPath}\``);
  lines.push("");

  lines.push(`## Existing posts that should link IN (${bundle.incoming.length})`);
  lines.push("");
  if (bundle.incoming.length === 0) {
    lines.push("_None found. Consider adding a sentence to a pillar post that name-drops the new post's primary keyword._");
  } else {
    for (const s of bundle.incoming) {
      lines.push(`### ${s.source.title}`);
      lines.push(`- **File:** \`${pathForSlug(s.source.slug, s.source.isPillar)}\``);
      lines.push(`- **Anchor:** ${newPost.primaryKeyword}`);
      lines.push(`- **Target:** \`${newPost.urlPath}\``);
      lines.push(`- **Matched phrase:** \`${s.matchedPhrase}\``);
      lines.push(`- **Context:** > ${s.context}`);
      lines.push("");
    }
  }

  lines.push(`## Pillars and clusters the new post should link OUT to (${bundle.outgoing.length})`);
  lines.push("");
  if (bundle.outgoing.length === 0) {
    lines.push("_None found. Add a 'Related guides' section that links to each pillar at minimum._");
  } else {
    for (const s of bundle.outgoing) {
      lines.push(`### → ${s.target.title}`);
      lines.push(`- **Target:** \`${s.target.urlPath}\``);
      lines.push(`- **Anchor:** ${s.target.primaryKeyword}`);
      lines.push(`- **Matched phrase:** \`${s.matchedPhrase}\``);
      lines.push(`- **Context:** > ${s.context}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function pathForSlug(slug: string, isPillar: boolean): string {
  return isPillar ? `app/${slug}/page.tsx` : `app/blog/posts/${slug}.mdx`;
}
