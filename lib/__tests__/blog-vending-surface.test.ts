// Vending blog surface (ADR-063). Pins the selective-index partition that lets
// the live vending blog be indexed + listed + sitemapped while the dormant
// deal-finder posts stay noindexed + unlisted + off the sitemap. The gate is
// the post's `pillar`: VENDING_PILLARS (host / service-areas) = live; the three
// collector pillars = dormant. This also guards the one-time publish — the 3
// reviewed drafts must actually live in POSTS_DIR (not _pending).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { POSTS_DIR } from "../blog/posts-dir.ts";
import {
  getAllPosts,
  getVendingPosts,
  getVendingPostSlugs,
  isVendingPost,
  VENDING_PILLARS,
} from "../../app/(site)/blog/posts-meta.ts";

// The 3 reviewed vending posts published in this goal.
const VENDING_SLUGS = [
  "is-a-trading-card-vending-machine-worth-it-for-a-gas-station",
  "pokemon-card-vending-machine-placement-in-napa",
  "how-vending-machine-revenue-share-hosting-works",
] as const;

// The dormant deal-finder posts (collector pillars) that must stay excluded.
const DEAL_FINDER_SLUGS = [
  "how-much-is-my-pokemon-card-worth-a-60-second-checklist",
  "japanese-sar-vs-english-special-illustration-rare",
  "how-to-read-a-japanese-pokemon-card",
  "near-mint-vs-lightly-played-the-difference-that-doubles-a-card-s-price",
  "psa-9-vs-psa-10-is-the-200-grading-jump-worth-it",
  "ebay-sold-averages-vs-tcgplayer-market-which-price-is-the-real-one",
  "sv3a-raging-surf-every-chase-card-by-price",
] as const;

test("VENDING_PILLARS is exactly host + service-areas", () => {
  assert.deepEqual([...VENDING_PILLARS].sort(), ["host", "service-areas"]);
});

test("isVendingPost classifies by pillar", () => {
  assert.equal(isVendingPost({ pillar: "host" }), true);
  assert.equal(isVendingPost({ pillar: "service-areas" }), true);
  assert.equal(isVendingPost({ pillar: "japanese-pokemon-cards-value" }), false);
  assert.equal(isVendingPost({ pillar: "pokemon-card-condition-guide" }), false);
  assert.equal(isVendingPost({ pillar: undefined }), false);
});

test("publish landed: the 3 reviewed drafts live in POSTS_DIR, not _pending", () => {
  for (const slug of VENDING_SLUGS) {
    assert.ok(
      fs.existsSync(path.join(POSTS_DIR, `${slug}.mdx`)),
      `${slug}.mdx must be published into POSTS_DIR`,
    );
    assert.ok(
      !fs.existsSync(path.join(POSTS_DIR, "_pending", `${slug}.mdx`)),
      `${slug}.mdx must no longer be in _pending`,
    );
  }
});

test("getVendingPosts returns exactly the vending posts (deal-finder excluded)", () => {
  const vendingSlugs = new Set(getVendingPostSlugs());
  for (const slug of VENDING_SLUGS) {
    assert.ok(vendingSlugs.has(slug), `${slug} must be in the live vending set`);
  }
  for (const slug of DEAL_FINDER_SLUGS) {
    assert.ok(
      !vendingSlugs.has(slug),
      `${slug} is a dormant deal-finder post and must NOT be in the vending set`,
    );
  }
  // Every post the index/sitemap surfaces must be a vending-pillar post.
  for (const p of getVendingPosts()) {
    assert.ok(isVendingPost(p), `${p.slug} surfaced but is not a vending post`);
  }
});

test("the dormant deal-finder posts still exist in-tree (preserved, not deleted)", () => {
  const all = new Set(getAllPosts().map((p) => p.slug));
  for (const slug of DEAL_FINDER_SLUGS) {
    assert.ok(all.has(slug), `${slug} must remain in-tree (dormant, not deleted)`);
  }
});
