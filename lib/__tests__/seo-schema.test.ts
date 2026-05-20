// Schema-helper contract tests. Cover the shape the Rich Results validator
// looks for: required fields populated, ISO date pass-through, FAQ schema
// returning null on empty input (so callers can spread-skip), and the XSS
// escape on JSON-LD serialization.

import test from "node:test";
import assert from "node:assert/strict";
import {
  articleSchema,
  faqPageSchema,
  schemaGraph,
  serializeJsonLd,
} from "../seo/schema-helpers.ts";

const FRONTMATTER = {
  title: "Test title",
  description: "Test description.",
  date: "2026-05-20",
  tags: ["valuation", "japanese"],
};

test("articleSchema emits the Google-required Article fields", () => {
  const s = articleSchema({
    frontmatter: FRONTMATTER,
    urlPath: "/blog/test-post",
    siteUrl: "https://foil.example",
  });

  assert.equal(s["@type"], "Article");
  assert.equal(s.headline, "Test title");
  assert.equal(s.description, "Test description.");
  assert.equal(s.datePublished, "2026-05-20");
  assert.equal(s.dateModified, "2026-05-20"); // defaults to date when updated missing
  assert.equal(s.author.name, "Foil");
  assert.equal(s.publisher.name, "Foil");
  assert.equal(s.publisher.url, "https://foil.example");
  assert.equal(s.mainEntityOfPage["@id"], "https://foil.example/blog/test-post");
  assert.equal(s.keywords, "valuation, japanese");
});

test("articleSchema uses `updated` for dateModified when present", () => {
  const s = articleSchema({
    frontmatter: { ...FRONTMATTER, updated: "2026-06-01" },
    urlPath: "/blog/test-post",
    siteUrl: "https://foil.example",
  });
  assert.equal(s.datePublished, "2026-05-20");
  assert.equal(s.dateModified, "2026-06-01");
});

test("articleSchema omits keywords when tag list is empty", () => {
  const s = articleSchema({
    frontmatter: { ...FRONTMATTER, tags: [] },
    urlPath: "/blog/test-post",
    siteUrl: "https://foil.example",
  });
  assert.equal((s as Record<string, unknown>).keywords, undefined);
});

test("articleSchema strips trailing slash from siteUrl so canonical doesn't double up", () => {
  const s = articleSchema({
    frontmatter: FRONTMATTER,
    urlPath: "/blog/test-post",
    siteUrl: "https://foil.example/",
  });
  assert.equal(s.mainEntityOfPage["@id"], "https://foil.example/blog/test-post");
  assert.equal(s.publisher.url, "https://foil.example");
});

test("faqPageSchema converts question/answer pairs to schema.org Questions", () => {
  const s = faqPageSchema([
    { question: "First?", answer: "First answer." },
    { question: "Second?", answer: "Second answer." },
  ]);
  assert.ok(s);
  assert.equal(s!["@type"], "FAQPage");
  assert.equal(s!.mainEntity.length, 2);
  assert.equal(s!.mainEntity[0].name, "First?");
  assert.equal(s!.mainEntity[0].acceptedAnswer.text, "First answer.");
});

test("faqPageSchema returns null when faqs is empty so callers can spread-skip", () => {
  assert.equal(faqPageSchema([]), null);
});

test("schemaGraph wraps nodes under @context + @graph and filters null entries", () => {
  const article = articleSchema({
    frontmatter: FRONTMATTER,
    urlPath: "/blog/test-post",
    siteUrl: "https://foil.example",
  });
  const faq = faqPageSchema([]);
  const graph = schemaGraph(article, faq);
  assert.equal(graph["@context"], "https://schema.org");
  assert.equal(graph["@graph"].length, 1); // null faq filtered out
});

test("serializeJsonLd escapes `<` so user-controlled strings can't break out into HTML", () => {
  // The classic injection vector: a description that contains "</script>".
  // Without escaping, serializing inline into a <script> would terminate
  // the tag and allow arbitrary HTML to render.
  const malicious = articleSchema({
    frontmatter: {
      ...FRONTMATTER,
      description: "</script><img src=x onerror=alert(1)>",
    },
    urlPath: "/blog/test-post",
    siteUrl: "https://foil.example",
  });
  const serialized = serializeJsonLd(malicious);
  // The opening `<` of `</script>` must be escaped so the inline JSON-LD
  // can't terminate its own <script> tag. We only escape `<` — that's
  // sufficient to neutralize the injection because a stray `>` outside a
  // tag context is harmless.
  assert.equal(serialized.includes("</script>"), false);
  assert.ok(serialized.includes("\\u003c/script>"));
});
