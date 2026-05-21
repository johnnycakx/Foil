// Parses the cluster topic backlog out of docs/seo-strategy.md. The strategy
// doc is the canonical source of truth — keeping the parser pointed at the
// human-readable Markdown means John can re-rank or add ideas inline without
// touching code.
//
// Each pillar section in the doc has a numbered list under "### Cluster posts".
// We extract each bullet as a candidate, attribute it to its pillar, infer a
// slug from the title, and filter out anything already shipped.

export type PillarTopology = {
  url: string;
  primaryKeyword: string;
  slug: string;
};

export type ClusterCandidate = {
  pillar: PillarTopology;
  rank: number;             // 1-indexed position within the pillar's cluster list
  title: string;            // The bullet headline (before any em-dash)
  rationale: string;        // The descriptive text after the em-dash
  longTail: string[];       // "Long-tail: ..." trailing phrase, comma-split
  slug: string;             // kebab-cased from title
};

const PILLAR_HEADER_RE = /^##\s+Pillar\s+\d+\s+—\s+(.+)$/i;
const URL_RE = /^\*\*URL:\*\*\s+`([^`]+)`/i;
const KEYWORD_RE = /^\*\*Primary keyword:\*\*\s+\*([^*]+)\*/i;
const CLUSTER_HEADER_RE = /^###\s+Cluster posts/i;
const NUMBERED_BULLET_RE = /^(\d+)\.\s+\*\*([^*]+)\*\*\s*—\s*(.*)$/;
const LONG_TAIL_RE = /Long-tail:\s*\*([^*]+)\*\.?/i;

export function parseStrategyDoc(markdown: string): ClusterCandidate[] {
  const lines = markdown.split(/\r?\n/);
  const candidates: ClusterCandidate[] = [];

  let currentPillar: PillarTopology | null = null;
  let inClusterSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // New pillar starts — reset state, then look ahead for URL + keyword
    const pillarMatch = line.match(PILLAR_HEADER_RE);
    if (pillarMatch) {
      currentPillar = null;
      inClusterSection = false;
      // Scan the next ~10 lines for URL + keyword
      let url: string | null = null;
      let primaryKeyword: string | null = null;
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        const u = lines[j].match(URL_RE);
        if (u) url = u[1];
        const k = lines[j].match(KEYWORD_RE);
        if (k) primaryKeyword = k[1];
        if (url && primaryKeyword) break;
      }
      if (url && primaryKeyword) {
        currentPillar = {
          url,
          primaryKeyword,
          slug: url.replace(/^\//, ""),
        };
      }
      continue;
    }

    if (CLUSTER_HEADER_RE.test(line)) {
      inClusterSection = true;
      continue;
    }

    // A blank line followed by `---` (or just `---`) closes the cluster section
    if (inClusterSection && /^---\s*$/.test(line)) {
      inClusterSection = false;
      continue;
    }

    if (inClusterSection && currentPillar) {
      const bullet = line.match(NUMBERED_BULLET_RE);
      if (bullet) {
        const [, rankStr, title, rest] = bullet;
        const longTail = extractLongTail(rest);
        candidates.push({
          pillar: currentPillar,
          rank: Number(rankStr),
          title: title.trim(),
          rationale: rest.replace(LONG_TAIL_RE, "").trim(),
          longTail,
          slug: slugify(title),
        });
      }
    }
  }

  return candidates;
}

function extractLongTail(rest: string): string[] {
  const m = rest.match(LONG_TAIL_RE);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Title → kebab-case slug. Strips Pokémon special chars, em-dashes, parens.
 * Caps to 80 chars (Google's URL display ceiling) so titles like
 * "How to grade modern Surging Sparks cards before sending them to PSA"
 * don't blow out into 120-char URLs.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (é → e)
    .replace(/[‘’‚‛′]/g, "") // smart quotes/apostrophes
    .replace(/[–—]/g, "-") // en/em dash → hyphen
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/**
 * Pick the next-best candidate from a parsed backlog, filtering out anything
 * whose slug already exists in shippedSlugs. Ranking heuristic: prefer lower
 * `rank` within each pillar (the human ordering is the priority signal),
 * then break ties by alphabetical pillar slug for determinism.
 */
export function pickNextCandidate(
  candidates: readonly ClusterCandidate[],
  shippedSlugs: ReadonlySet<string>,
): ClusterCandidate | null {
  const unshipped = candidates.filter((c) => !shippedSlugs.has(c.slug));
  if (!unshipped.length) return null;
  return [...unshipped].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.pillar.slug.localeCompare(b.pillar.slug);
  })[0];
}

export type CandidateSelection = {
  candidate: ClusterCandidate;
  /** Human-readable explanation of WHY this candidate was chosen — surfaced
   *  in the manual-paste email so John can scan whether the engine picked
   *  reasonably without re-deriving from the strategy doc. */
  rationale: string;
};

/**
 * Same selection as pickNextCandidate, but returns a human-readable
 * explanation alongside. Plumbed through the autonomy pipeline so the
 * fallback email + the docs/newsletter-drafts/{slug}.md artifact carry the
 * topic-choice context. Pure function — recomputes from the inputs.
 */
export function pickNextCandidateWithRationale(
  candidates: readonly ClusterCandidate[],
  shippedSlugs: ReadonlySet<string>,
): CandidateSelection | null {
  const picked = pickNextCandidate(candidates, shippedSlugs);
  if (!picked) return null;

  // How many candidates total in the same pillar? How many remain unshipped?
  const pillarSlug = picked.pillar.slug;
  const totalInPillar = candidates.filter((c) => c.pillar.slug === pillarSlug).length;
  const unshippedInPillar = candidates.filter(
    (c) => c.pillar.slug === pillarSlug && !shippedSlugs.has(c.slug),
  ).length;

  // Was there a tie at this rank that got broken by pillar slug?
  const sameRankPillars = new Set(
    candidates
      .filter((c) => c.rank === picked.rank && !shippedSlugs.has(c.slug))
      .map((c) => c.pillar.slug),
  );
  const tieBroken = sameRankPillars.size > 1;

  const parts: string[] = [];
  parts.push(
    `Selected from the **${picked.pillar.primaryKeyword}** pillar (URL: ${picked.pillar.url}).`,
  );
  parts.push(
    `This was rank #${picked.rank} of ${totalInPillar} cluster posts in that pillar; ${unshippedInPillar} remain unshipped after this one.`,
  );
  if (tieBroken) {
    const otherPillars = [...sameRankPillars].filter((s) => s !== pillarSlug).sort();
    parts.push(
      `Tied at rank ${picked.rank} with the **${otherPillars.join(", ")}** pillar(s) — broke ties by alphabetical pillar slug (per pickNextCandidate).`,
    );
  }
  parts.push(
    `Long-tail keywords from the strategy doc: ${picked.longTail.length ? picked.longTail.join(", ") : "(none specified)"}.`,
  );

  return { candidate: picked, rationale: parts.join(" ") };
}
