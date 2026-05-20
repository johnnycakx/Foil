// Internal-linking suggester contract. The class of bugs we pin:
// - Don't suggest a link the source paragraph already has.
// - Don't suggest a target the source already links to elsewhere in the body.
// - Word-boundary match so "japan" doesn't trigger on "japanese" sub-strings.
// - Skip non-prose blocks (headings, lists, code, MDX components).

import test from "node:test";
import assert from "node:assert/strict";
import {
  suggestLinks,
  suggestForNewPost,
  renderReport,
  type LinkablePost,
} from "../seo/internal-linking.ts";

function post(overrides: Partial<LinkablePost> = {}): LinkablePost {
  return {
    slug: "test-slug",
    title: "Test title",
    urlPath: "/blog/test-slug",
    primaryKeyword: "test keyword",
    secondaryKeywords: [],
    body: "",
    isPillar: false,
    ...overrides,
  };
}

test("suggests a link when source paragraph contains the target's primary keyword", () => {
  const source = post({
    slug: "source",
    body:
      "Pricing is a hard problem.\n\nThe condition of a card matters a lot — Near Mint vs Lightly Played changes a lot.\n\nMore prose follows.",
  });
  const target = post({
    slug: "condition-guide",
    urlPath: "/pokemon-card-condition-guide",
    primaryKeyword: "Pokémon card condition guide",
    secondaryKeywords: ["Near Mint vs Lightly Played"],
    isPillar: true,
  });

  const suggestions = suggestLinks(source, [target]);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].target.slug, "condition-guide");
  assert.ok(suggestions[0].context.includes("Near Mint"));
});

test("does NOT suggest a link to a target the source already links to", () => {
  const source = post({
    slug: "source",
    body:
      "Already linked: [card condition guide](/pokemon-card-condition-guide). Some other prose continues.\n\nThe condition of a card matters.",
  });
  const target = post({
    slug: "condition-guide",
    urlPath: "/pokemon-card-condition-guide",
    primaryKeyword: "card condition guide",
    secondaryKeywords: [],
  });

  const suggestions = suggestLinks(source, [target]);
  assert.equal(suggestions.length, 0);
});

test("does NOT suggest a link inside a paragraph that already has any link", () => {
  // The paragraph below already links to something else — adding a SECOND
  // contextual link in the same paragraph dilutes both.
  const source = post({
    slug: "source",
    body:
      "See the [TCGplayer pricing guide](https://example.com) for context — card condition matters and Near Mint vs Lightly Played drives the price.",
  });
  const target = post({
    slug: "condition-guide",
    urlPath: "/pokemon-card-condition-guide",
    primaryKeyword: "Near Mint vs Lightly Played",
    secondaryKeywords: [],
  });

  const suggestions = suggestLinks(source, [target]);
  assert.equal(suggestions.length, 0);
});

test("word-boundary match — 'japan' shouldn't trigger on 'japanese' substrings", () => {
  const source = post({
    body: "Japanese cards are interesting and worth pricing carefully.",
  });
  const target = post({
    slug: "japan-only",
    urlPath: "/japan",
    primaryKeyword: "japan",
    secondaryKeywords: [],
  });

  const suggestions = suggestLinks(source, [target]);
  assert.equal(suggestions.length, 0);
});

test("ignores structural lines (headings, lists, code blocks, MDX components)", () => {
  const source = post({
    body: [
      "## Heading mentions Pokémon card condition guide",
      "",
      "- list item mentions Pokémon card condition guide",
      "",
      "```\nPokémon card condition guide in code\n```",
      "",
      "<Callout>Pokémon card condition guide in MDX</Callout>",
    ].join("\n"),
  });
  const target = post({
    slug: "condition-guide",
    urlPath: "/pokemon-card-condition-guide",
    primaryKeyword: "Pokémon card condition guide",
    secondaryKeywords: [],
  });

  const suggestions = suggestLinks(source, [target]);
  assert.equal(suggestions.length, 0);
});

test("suggestForNewPost returns both incoming + outgoing in one bundle", () => {
  const newPost = post({
    slug: "new-post",
    urlPath: "/blog/new-post",
    primaryKeyword: "new topic",
    body:
      "An introduction.\n\nThis post discusses the Pokémon card condition guide in passing.\n\nAnother paragraph.",
  });
  const existing: LinkablePost[] = [
    post({
      slug: "pillar",
      urlPath: "/pillar",
      primaryKeyword: "pillar topic",
      body: "Some prose here.\n\nThe new topic is discussed in detail in a sibling post.",
      isPillar: true,
    }),
    post({
      slug: "condition-guide",
      urlPath: "/pokemon-card-condition-guide",
      primaryKeyword: "Pokémon card condition guide",
      isPillar: true,
    }),
  ];

  const bundle = suggestForNewPost(newPost, existing);
  assert.equal(bundle.incoming.length, 1); // pillar mentions "new topic"
  assert.equal(bundle.outgoing.length, 1); // newPost mentions "Pokémon card condition guide"
});

test("renderReport produces a Markdown document with both sections", () => {
  const newPost = post({ slug: "new", title: "New", urlPath: "/blog/new" });
  const md = renderReport(newPost, { incoming: [], outgoing: [] });
  assert.ok(md.includes("# Internal link suggestions for New"));
  assert.ok(md.includes("## Existing posts that should link IN"));
  assert.ok(md.includes("## Pillars and clusters the new post should link OUT to"));
  assert.ok(md.includes("_None found")); // empty-state copy
});
