// Real case that exposed both engagement-brief bugs on the first live brief
// (2026-06-30) — pinned per the card-ID framework rule #7. The @thelou7789 post
// is about the "Moonbreon" (Umbreon VMAX Alt Art, swsh7-215) from a 0-follower /
// ~3-view account. It exercises BOTH fixes: (1) the reply must cite swsh7-215's
// data, NEVER the Umbreon-ex row the engine fuzzy-matched; (2) the 0-reach author
// must be filtered out. See ADR-086 + docs/foil-card-id-framework.md.

import type { XPost } from "../../social/x-client.ts";
import type { MoverFact } from "../../engagement/draft.ts";

export const THELOU7789_MOONBREON: XPost = {
  id: "fixture-thelou7789-moonbreon",
  text: "Just pulled a Moonbreon. Is this Umbreon VMAX alt art actually worth what people say? How much should I sell it for?",
  authorId: "thelou7789-id",
  authorUsername: "thelou7789",
  authorFollowers: 0,
  createdAt: "2026-06-30T01:00:00.000Z",
  metrics: { likes: 0, replies: 0, reposts: 0, impressions: 3 },
};

// The THREE real Umbreon rows that were in market_movers when the bug fired — the
// engine fuzz-matched "Moonbreon" to `sv8pt5-161-umbreon-ex` ($1,347) instead of
// the correct `swsh7-215-umbreon-vmax-alt-art` ($2,161/$2,256). The fix matches
// BY SLUG, so only the swsh7-215 row is ever eligible for a Moonbreon post.
export const UMBREON_FACTS: MoverFact[] = [
  { slug: "neo2-13-umbreon", cardName: "Umbreon", avg7dUsd: 840, avg30dUsd: 840, momentumPct: 0, sampleSize: 20 },
  { slug: "sv8pt5-161-umbreon-ex", cardName: "Umbreon ex", avg7dUsd: 1347, avg30dUsd: 1244, momentumPct: 8, sampleSize: 310 },
  { slug: "swsh7-215-umbreon-vmax-alt-art", cardName: "Umbreon VMAX", avg7dUsd: 2256, avg30dUsd: 2161, momentumPct: 4, sampleSize: 62 },
];
