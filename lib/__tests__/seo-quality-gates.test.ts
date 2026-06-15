// Quality-gates contract tests. These are the only safety net between
// Claude's output and a publish-to-main commit in autonomy mode, so every
// gate gets a positive AND negative case.
//
// ADR-062 (vending reframe): the deal-finder data gates — dollar-figure count,
// Foil-scan-data citation, Foil-data provenance — were retired (they forced
// collector/pricing content that doesn't fit a host-acquisition post). They are
// replaced by vending gates: host-benefit clarity, a Bay-Area geo reference, a
// conversion internal link (/host, /faq, /service-areas[/city]), and a HARD
// honesty gate (no insurance claim, no published revenue-share %). The general
// voice/honesty gates (11 attribution, 12 em-dash, 13 anti-hype) are unchanged
// and tested in attribution-gate.test.ts + copy-gate-anti-hype.test.ts.

import test from "node:test";
import assert from "node:assert/strict";
import {
  BANNED_PHRASES,
  bannedPhraseMatches,
  countInternalLinks,
  recentDateMatches,
  runQualityGates,
  deadInternalLinks,
  hostBenefitSignals,
  localGeoReferences,
  hasConversionInternalLink,
  vendingHonestyViolations,
} from "../seo/quality-gates.ts";
import type { GeneratedDraft } from "../seo/content-engine-types.ts";

// A vending host draft that passes every gate. Tests mutate copies of this to
// exercise one gate at a time. ~1500 words packed with every signal the gates
// look for: host-benefit language, a Bay-Area geo reference, conversion links,
// a current-year mention, and a 200+ word host-facing FAQ.
function passingDraft(): GeneratedDraft {
  const filler =
    "We place and operate the machine for hosts across the Bay Area, and we restock it on a schedule built around your hours so your staff never touches it. " .repeat(52);

  const body =
    filler +
    "\n\n## What hosting costs you\n" +
    "Nothing. There is no purchase, lease, or fee, and the machine draws about as much power as a TV. " +
    "Hosting is a hands-off, no cost amenity that earns a monthly revenue share for space you already pay for. " +
    "We handle the cashless payments, we restock on a 7-to-14-day cadence, and every refund routes through the on-machine QR code. " +
    "Foot traffic at a busy Fairfield or Walnut Creek storefront is exactly the impulse-buy crowd this fits. " +
    "It runs on a risk-free trial month with no contract required. " +
    "Read the full [host FAQ](/faq) or see how it works on the [host a machine](/host) page. " +
    "For a local example, see [Napa vending machine placement](/service-areas/napa). " +
    "In 2026 we are placing machines closest-first across the North Bay and Solano corridor.";

  return {
    candidate: null as unknown as GeneratedDraft["candidate"],
    slug: "test-slug",
    frontmatter: {
      title: "Host a Pokemon Card Vending Machine in Your Bay Area Shop",
      description: "How a Bay Area business hosts a fully managed Pokemon card vending machine for a monthly revenue share, with zero cost and zero work.",
      date: "2026-06-15",
      tags: ["vending", "host"],
      pillar: "host",
      primaryKeyword: "host a pokemon card vending machine",
    },
    body,
    faq: [
      {
        question: "What does it cost a host?",
        answer:
          "Nothing. There is no purchase, no lease, and no fee. The machine draws about as much power as a TV, roughly four dollars a month. You provide about three to four square feet and a standard outlet, and you earn a monthly revenue share on top of that. We walk through the revenue share on a quick call.",
      },
      {
        question: "Who handles restocking and customer issues?",
        answer:
          "We do, completely. Foil installs, stocks, restocks, and services every machine, and we handle refunds and support through the on-machine QR code. Your staff never touches it and never fields a complaint. Restocks happen every 7 to 14 days, scheduled around your hours.",
      },
      {
        question: "Do I have to sign a contract to host in the Bay Area?",
        answer:
          "No. Most placements run on a handshake and a risk-free trial month with no commitment. If you would prefer something in writing, we provide a simple placement agreement. If a spot is not a fit, we adjust the product mix and, if needed, relocate the machine at no cost to you.",
      },
      {
        question: "How much space does the machine need?",
        answer:
          "About three to four square feet, plus a standard 120V outlet and wifi. The machine is roughly the size of a jukebox, and it can be wall-mounted, on a pedestal, or freestanding with no drilling required. We size it to your space and show you exactly how it looks before anything is installed. The install takes about an hour and does not disrupt your day.",
      },
    ],
    wordCount: 1500,
  };
}

test("a clean vending draft passes every gate", () => {
  const result = runQualityGates(passingDraft(), "/blog/test-slug");
  assert.deepEqual(result.failures, []);
  assert.equal(result.passed, true);
});

// Gate 12 field coverage (PATTERNS I-008 fourth instance): an em dash in
// frontmatter.description must fail (the gate scans title + description too).
test("Gate 12: an em dash in frontmatter.description fails", () => {
  const draft = passingDraft();
  draft.frontmatter.description = "Host a machine — earn a monthly share for space you already pay for.";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("em dash") && f.includes("Gate 12")),
    `expected a Gate 12 failure for a description em dash, got: ${JSON.stringify(result.failures)}`,
  );
});

test("Gate 12: an em dash in frontmatter.title fails", () => {
  const draft = passingDraft();
  draft.frontmatter.title = "Host a Vending Machine — Zero Cost, Zero Work";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("em dash") && f.includes("Gate 12")),
    `expected a Gate 12 failure for a title em dash, got: ${JSON.stringify(result.failures)}`,
  );
});

test("Gate 12: a body-only post with clean frontmatter still passes", () => {
  const result = runQualityGates(passingDraft(), "/blog/test-slug");
  assert.ok(!result.failures.some((f) => f.includes("Gate 12")), `clean draft must not trip Gate 12: ${JSON.stringify(result.failures)}`);
});

test("gate (a): rejects under-length body with a specific count", () => {
  const draft = passingDraft();
  draft.body = "short body. ".repeat(50); // ~100 words
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.equal(result.passed, false);
  assert.ok(result.failures.some((f) => f.includes("too short")));
});

test("gate (a): rejects over-length body", () => {
  const draft = passingDraft();
  draft.body = "extra word ".repeat(2500); // 5000 words
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("too long")));
});

// --- Gate (currency): at least one current-year reference (relaxed 2 -> 1) ----

test("gate (currency): rejects a body with no 2025/2026 reference", () => {
  const draft = passingDraft();
  draft.body = draft.body.replace(/2026/g, "the spring");
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("recent-year")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("gate (currency): a single 2026 mention satisfies the gate", () => {
  const draft = passingDraft();
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(!result.failures.some((f) => f.includes("recent-year")));
});

test("recentDateMatches ignores 2025/2026 inside URLs", () => {
  const matches = recentDateMatches(
    "See https://example.com/2026-pricing and the current year is 2026",
  );
  assert.equal(matches.length, 1);
});

// --- Gate (e): banned phrases -----------------------------------------------

test("gate (e): rejects when ANY banned phrase appears (case-insensitive)", () => {
  const draft = passingDraft();
  draft.body += "\n\nIN CONCLUSION, this is the summary.";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.toLowerCase().includes("banned")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("bannedPhraseMatches returns every offender so the retry prompt is exhaustive", () => {
  const text = "In conclusion, let's dive in. In today's market this is a game-changer.";
  const hits = bannedPhraseMatches(text);
  assert.ok(hits.includes("in conclusion"));
  assert.ok(hits.includes("dive in"));
  assert.ok(hits.includes("in today's market"));
  assert.ok(hits.includes("game-changer"));
});

test("BANNED_PHRASES list includes every phrase the gate set names", () => {
  // Pin the exact list so a future refactor can't silently drop one. The list
  // is unchanged by the vending reframe (these AI-tell / voice bans are
  // audience-agnostic).
  assert.deepEqual([...BANNED_PHRASES], [
    "in conclusion",
    "in summary",
    "as we've seen",
    "in today's digital world",
    "the world of pokemon",
    "as a collector",
    "let's dive in",
    "dive in",
    "game-changer",
    "game changer",
    "to the moon",
    "navigate the landscape",
    "delve",
    "tapestry",
    "in today's market",
  ]);
});

// --- Gate (g): FAQ length ----------------------------------------------------

test("gate (g): rejects when FAQ section is under 200 words", () => {
  const draft = passingDraft();
  draft.faq = [{ question: "Q?", answer: "Short." }];
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("FAQ section is too short")));
});

// --- Gate (h): internal links + Gate V-link (conversion link) ----------------

test("gate (h): rejects under 2 internal links", () => {
  const draft = passingDraft();
  // Strip all internal links — replace with external ones (don't count)
  draft.body = draft.body
    .replace(/\[host FAQ\]\(\/faq\)/g, "[external](https://example.com/a)")
    .replace(/\[host a machine\]\(\/host\)/g, "[external2](https://example.com/b)")
    .replace(/\[Napa vending machine placement\]\(\/service-areas\/napa\)/g, "[external3](https://example.com/c)");
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.some((f) => f.includes("internal links")));
});

test("countInternalLinks recognizes markdown, MDX href, and full foiltcg URLs", () => {
  const body = `
[md link](/path-a)
<a href="/path-b">html</a>
<TopicLink href="https://foiltcg.com/path-c">topic</TopicLink>
[external](https://wikipedia.org/x)
[anchor only](#section)
`;
  assert.equal(countInternalLinks(body), 3);
});

test("countInternalLinks dedupes — same href twice counts once", () => {
  const body = `[a](/same) [b](/same) [c](/different)`;
  assert.equal(countInternalLinks(body), 2);
});

test("Gate V-link: a post whose only internal links are sibling blog posts fails", () => {
  const draft = passingDraft();
  // Two internal links, but neither is a conversion page (/host, /faq, /service-areas).
  draft.body = draft.body
    .replace(/\[host FAQ\]\(\/faq\)/g, "[a sibling post](/blog/best-businesses-for-a-vending-machine)")
    .replace(/\[host a machine\]\(\/host\)/g, "[another sibling](/blog/how-vending-revenue-share-hosting-works)")
    .replace(/\[Napa vending machine placement\]\(\/service-areas\/napa\)/g, "the Napa area");
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("conversion link") && f.includes("Gate V-link")),
    `expected a Gate V-link failure, got: ${JSON.stringify(result.failures)}`,
  );
});

test("hasConversionInternalLink: /host, /faq, and /service-areas[/city] count; /blog and /cards do not", () => {
  assert.equal(hasConversionInternalLink("[x](/host)"), true);
  assert.equal(hasConversionInternalLink("[x](/faq)"), true);
  assert.equal(hasConversionInternalLink("[x](/service-areas)"), true);
  assert.equal(hasConversionInternalLink("[x](/service-areas/walnut-creek)"), true);
  assert.equal(hasConversionInternalLink('<a href="https://foiltcg.com/host">x</a>'), true);
  assert.equal(hasConversionInternalLink("[x](/blog/some-post)"), false);
  assert.equal(hasConversionInternalLink("[x](/cards/base1-4-charizard)"), false);
});

// --- Gate (f): schema validation --------------------------------------------

test("gate (f): rejects draft with empty headline (schema validation)", () => {
  const draft = passingDraft();
  draft.frontmatter.title = "";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.toLowerCase().includes("headline")),
    `failures: ${result.failures.join(" | ")}`,
  );
});

test("multiple gate failures all surface in one report (no early-exit)", () => {
  const draft = passingDraft();
  draft.body = "tiny body in conclusion."; // fails word count + banned phrase + benefit + geo + link + ...
  draft.faq = [];
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(result.failures.length >= 4);
});

// ---------------------------------------------------------------------------
// Gate 9 — internal-link existence (Session 47.4). Repointed at the vending
// routes (ADR-062): the resolver now resolves /service-areas/[city] slugs, not
// /cards/ slugs.
// ---------------------------------------------------------------------------

test("deadInternalLinks: flags hrefs that don't resolve, passes ones that do", () => {
  const exists = (href: string) =>
    href === "/host" || href === "/service-areas/napa";
  const body =
    "See [host](/host) and [napa](/service-areas/napa) " +
    "but [dead](/blog/this-post-does-not-exist) and [also dead](/service-areas/nowhere).";
  const dead = deadInternalLinks(body, exists);
  assert.deepEqual(dead.sort(), ["/blog/this-post-does-not-exist", "/service-areas/nowhere"].sort());
});

test("gate 9 fires through runQualityGates when a resolver is supplied", () => {
  const draft = passingDraft();
  draft.body += "\n\nBonus: [dead link](/service-areas/nowhere-city).";
  const ctx = { internalLinkExists: (h: string) => !h.includes("nowhere-city") };
  const result = runQualityGates(draft, "/blog/test-slug", undefined, ctx);
  assert.ok(result.failures.some((f) => f.includes("Dead internal link")));
});

test("gate 9 stays silent without a resolver (back-compat)", () => {
  const draft = passingDraft();
  draft.body += "\n\n[dead](/service-areas/nowhere-city).";
  const result = runQualityGates(draft, "/blog/test-slug"); // no ctx
  assert.ok(!result.failures.some((f) => f.includes("Dead internal link")));
});

// ---------------------------------------------------------------------------
// Gate V-benefit — host value-prop clarity (ADR-062).
// ---------------------------------------------------------------------------

test("hostBenefitSignals counts distinct host-value-prop phrases", () => {
  const hits = hostBenefitSignals(
    "It is hands-off and no cost, you earn a monthly revenue share, and we restock it.",
  );
  assert.ok(hits.includes("hands-off"));
  assert.ok(hits.includes("no cost"));
  assert.ok(hits.includes("revenue share"));
  assert.ok(hits.includes("we restock"));
  assert.ok(hits.length >= 4);
});

test("Gate V-benefit: a post that doesn't speak to the host fails", () => {
  const draft = passingDraft();
  // Strip the host-benefit vocabulary out of body + FAQ.
  const strip = (s: string) =>
    s
      .replace(/hands-off/gi, "simple")
      .replace(/no cost/gi, "included")
      .replace(/revenue share/gi, "monthly payment plan")
      .replace(/we restock/gi, "it gets refilled")
      .replace(/we handle/gi, "it is handled")
      .replace(/foot traffic/gi, "visitors")
      .replace(/risk-free/gi, "low-commitment")
      .replace(/trial month/gi, "starter period")
      .replace(/no contract/gi, "flexible terms")
      .replace(/cashless/gi, "card-based")
      .replace(/monthly revenue/gi, "monthly amount")
      .replace(/impulse/gi, "spur-of-the-moment")
      .replace(/square feet/gi, "a small spot")
      .replace(/your space/gi, "your store");
  draft.body = strip(draft.body);
  draft.faq = draft.faq.map((q) => ({ question: strip(q.question), answer: strip(q.answer) }));
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("host-benefit") && f.includes("Gate V-benefit")),
    `expected a Gate V-benefit failure, got: ${JSON.stringify(result.failures)}`,
  );
});

// ---------------------------------------------------------------------------
// Gate V-geo — local relevance (ADR-062).
// ---------------------------------------------------------------------------

test("localGeoReferences recognizes the Bay Area + served cities", () => {
  assert.ok(localGeoReferences("a shop in the Bay Area").includes("bay area"));
  assert.ok(localGeoReferences("downtown Walnut Creek").includes("walnut creek"));
  assert.equal(localGeoReferences("a generic small town with no place name").length, 0);
});

test("Gate V-geo: a post with no Bay-Area reference fails", () => {
  const draft = passingDraft();
  const strip = (s: string) =>
    s
      .replace(/bay area/gi, "region")
      .replace(/fairfield/gi, "town")
      .replace(/walnut creek/gi, "downtown")
      .replace(/napa/gi, "the city")
      .replace(/north bay/gi, "the area")
      .replace(/solano/gi, "the county");
  draft.body = strip(draft.body);
  draft.faq = draft.faq.map((q) => ({ question: strip(q.question), answer: strip(q.answer) }));
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("Bay-Area location") && f.includes("Gate V-geo")),
    `expected a Gate V-geo failure, got: ${JSON.stringify(result.failures)}`,
  );
});

// ---------------------------------------------------------------------------
// Gate V-honesty — binding guardrails on generated copy (HARD, ADR-062).
// ---------------------------------------------------------------------------

test("vendingHonestyViolations: flags a 'fully insured' claim", () => {
  const v = vendingHonestyViolations("The machine is fully insured against theft.");
  assert.ok(v.some((x) => x.includes("fully insured")));
});

test("vendingHonestyViolations: flags a published revenue-share percentage", () => {
  const v = vendingHonestyViolations("Hosts keep a 15% revenue share every month.");
  assert.ok(v.some((x) => x.includes("revenue-share %")), `got: ${JSON.stringify(v)}`);
});

test("vendingHonestyViolations: a 'monthly revenue share' with no percentage is clean", () => {
  assert.deepEqual(vendingHonestyViolations("You earn a monthly revenue share on every sale."), []);
});

test("Gate V-honesty: an insurance claim in the body fails", () => {
  const draft = passingDraft();
  draft.body += "\n\nDon't worry about damage, the machine is fully insured.";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("Honesty-guardrail") && f.includes("Gate V-honesty")),
    `expected a Gate V-honesty failure, got: ${JSON.stringify(result.failures)}`,
  );
});

test("Gate V-honesty: a published revenue-share % in the body fails", () => {
  const draft = passingDraft();
  draft.body += "\n\nYou keep a 12% revenue share of every sale.";
  const result = runQualityGates(draft, "/blog/test-slug");
  assert.ok(
    result.failures.some((f) => f.includes("Honesty-guardrail") && f.includes("Gate V-honesty")),
    `expected a Gate V-honesty failure for a published %, got: ${JSON.stringify(result.failures)}`,
  );
});
