// Canonical blog posts directory (ADR-049).
//
// The autonomous content engine WRITES here and the live blog route READS here.
// They MUST be the same directory. Before this constant they had drifted: the
// engine wrote app/blog/posts/ while the route read app/(site)/blog/posts/, so
// autonomously-generated posts silently never went live (R-015). Every consumer
// now imports this one value; lib/__tests__/posts-dir-consistency.test.ts pins
// that they all resolve to it, so the writer can never split from the reader
// again (PATTERNS I-008, extends I-003).
import path from "node:path";

export const POSTS_DIR = path.join(process.cwd(), "app", "(site)", "blog", "posts");
