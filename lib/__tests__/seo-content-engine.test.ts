// Content-engine tests cover the deterministic pieces — parsing the model's
// JSON output and serializing a draft to MDX. The Claude call itself is not
// tested here (it's a network dependency and producing a meaningful
// integration test costs API tokens per CI run).

import test from "node:test";
import assert from "node:assert/strict";
import { parseModelOutput, serializeDraft } from "../seo/content-engine.ts";
import type { GeneratedDraft } from "../seo/content-engine-types.ts";

test("parseModelOutput extracts the JSON object from a ```json fence", () => {
  const text = `Here you go:

\`\`\`json
{
  "title": "How to grade Japanese Pokémon cards",
  "description": "A practical guide to grading Japanese cards with PSA, BGS, and CGC in 2026.",
  "tags": ["grading", "japanese"],
  "body": "Some MDX body here.",
  "faq": [
    { "question": "Q1?", "answer": "A1." }
  ]
}
\`\`\``;

  const parsed = parseModelOutput(text);
  assert.equal(parsed.title, "How to grade Japanese Pokémon cards");
  assert.equal(parsed.tags.length, 2);
  assert.equal(parsed.faq.length, 1);
});

test("parseModelOutput tolerates a bare fence (no language tag)", () => {
  const text = "```\n{\"title\":\"X\",\"description\":\"Y\",\"tags\":[],\"body\":\"Z\",\"faq\":[{\"question\":\"q\",\"answer\":\"a\"}]}\n```";
  const parsed = parseModelOutput(text);
  assert.equal(parsed.title, "X");
});

test("parseModelOutput throws on missing required fields", () => {
  const text = "```json\n{\"title\":\"x\"}\n```";
  assert.throws(() => parseModelOutput(text), /description/);
});

test("parseModelOutput throws when FAQ array is empty", () => {
  const text = `\`\`\`json
{"title":"X","description":"Y","tags":[],"body":"Z","faq":[]}
\`\`\``;
  assert.throws(() => parseModelOutput(text), /FAQ/);
});

test("parseModelOutput surfaces malformed JSON with a useful error", () => {
  assert.throws(() => parseModelOutput("```json\n{not json\n```"), /not valid JSON/);
});

test("parseModelOutput strips invalid FAQ entries but accepts the valid ones", () => {
  const text = `\`\`\`json
{
  "title": "X", "description": "Y", "tags": [], "body": "Z",
  "faq": [
    {"question":"good","answer":"yes"},
    "bare string",
    {"question":"only q"},
    null,
    {"question":"another good","answer":"yes"}
  ]
}
\`\`\``;
  const parsed = parseModelOutput(text);
  assert.equal(parsed.faq.length, 2);
});

test("serializeDraft produces valid YAML frontmatter that gray-matter can roundtrip", () => {
  const draft: GeneratedDraft = {
    candidate: null as unknown as GeneratedDraft["candidate"], // not used in serialization
    slug: "test-slug",
    frontmatter: {
      title: "Test title with a \"quote\" inside",
      description: "Description.",
      date: "2026-05-20",
      tags: ["a", "b"],
      pillar: "pokemon-card-value-calculator",
      primaryKeyword: "test keyword",
    },
    body: "Body text here.",
    faq: [{ question: "Q?", answer: "A." }],
    wordCount: 3,
  };
  const mdx = serializeDraft(draft);
  assert.ok(mdx.startsWith("---\n"));
  // The quote in the title must be escaped, not raw, so YAML doesn't choke.
  assert.ok(mdx.includes('title: "Test title with a \\"quote\\" inside"'));
  assert.ok(mdx.includes('date: "2026-05-20"'));
  assert.ok(mdx.includes('pillar: "pokemon-card-value-calculator"'));
  assert.ok(mdx.includes("Body text here."));
  // FAQ lives in frontmatter only; the page route renders it after the MDX
  // body (so both the visible UI and the FAQPage JSON-LD read from one source).
  assert.ok(mdx.includes('question: "Q?"'));
  assert.equal(mdx.includes("<FAQ items"), false);
});
