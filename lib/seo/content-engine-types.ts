// Shared types between content-engine.ts and quality-gates.ts. Lifting these
// out avoids a circular import — quality-gates needs the draft shape to
// validate it, and content-engine needs the gates to score what it just
// produced.

import type { ClusterCandidate } from "./keyword-backlog.ts";

export type GeneratedDraft = {
  candidate: ClusterCandidate;
  slug: string;
  frontmatter: {
    title: string;
    description: string;
    date: string;
    tags: string[];
    pillar: string;
    primaryKeyword: string;
  };
  body: string;
  faq: { question: string; answer: string }[];
  wordCount: number;
};
