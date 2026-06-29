// The SOFT-FALL is the whole point of NL-EDIT-SHIP: an editorial-generation
// failure must NEVER block the weekly send. This pins composeDigestForSend's
// branch logic with injected fakes (no LLM, no render, no network) so the
// editorial -> deterministic -> skip ladder is verified deterministically.
//
// Also pins the shared affiliateLinkIntegrity helper (the render-layer revenue
// invariant both templates must satisfy) and the pure editorial serializer.

import test from "node:test";
import assert from "node:assert/strict";

import {
  composeDigestForSend,
  isSkip,
  type ComposeDigestDeps,
  type ComposedDigest,
} from "../newsletter/digest-compose.ts";
import { affiliateLinkIntegrity } from "../newsletter/digest-quality-gate.ts";
import { editorialPreviewText, serializeEditorialIssue, matchModelCard } from "../newsletter/editorial-serialize.ts";
import type { EditorialIssue } from "../newsletter/editorial-engine.ts";
import type { DigestModel, MoversDigestParts } from "../newsletter/movers-digest.ts";
import type { MarketMovers } from "../deals/market-movers-read.ts";

// --- minimal fixtures (the composer passes model/movers through to the injected
//     IO and never inspects them itself, so these can be skeletal) ---------------
const MODEL = {
  subject: "det subject",
  previewText: "det preview",
  dateLine: "June 29, 2026",
  down: [{ name: "Petrel", set: "Destined Rivals", momentumPct: -9.3, moveWords: "down 9.3%", arrow: "down", avg7dUsd: "$10.98", avg30dUsd: "$12.11", saleCount: 568, browseUrl: "https://www.ebay.com/sch/i.html?_nkw=petrel&campid=5339154326" }],
  up: [{ name: "Pikachu", set: "151", momentumPct: 13.9, moveWords: "up 13.9%", arrow: "up", avg7dUsd: "$103.28", avg30dUsd: "$90.66", saleCount: 619, browseUrl: "https://www.ebay.com/sch/i.html?_nkw=pikachu&campid=5339154326" }],
  leadMagnetUrl: "https://foiltcg.com/free/pokemon-card-pricing-cheat-sheet",
} as DigestModel;

const MOVERS = { down: [], up: [] } as unknown as MarketMovers;

const PARTS: MoversDigestParts = {
  subject: "8 Pokémon cards trading below their 30-day average",
  previewText: "The cards cooling off versus their recent average.",
  bodyMarkdown: "# Good buys this week\n\nDeterministic body.",
  downCount: 8,
  upCount: 4,
};

const ISSUE: EditorialIssue = {
  subject: "Ho-Oh ex just jumped fifteen percent today",
  open: "The market this week is running two speeds. A couple of cards deserve a second look.",
  bigMove: { cardName: "Ho-Oh ex", body: "Ho-Oh ex is up. My read is nostalgia. I'd wait." },
  coolingPicks: [{ cardName: "Petrel", body: "Petrel slipped. Demand normalizing. I'd grab clean copies." }],
  heatingPicks: [{ cardName: "Pikachu", body: "Pikachu running hot on volume. Don't chase." }],
  sellersNote: "Condition spread is wide on the sell side this week.",
  theRead: "The buy side lives in the trainers. If I had $50 to deploy, I'd split it on clean NM Petrel.",
  oneMoreThing: "What are you watching? Hit reply.",
  signoff: "See you next week. John",
};

const WRAPPED_HTML = `<a href="https://www.ebay.com/sch/i.html?_nkw=hooh&campid=5339154326">Browse</a>`;
const UNWRAPPED_HTML = `<a href="https://www.ebay.com/sch/i.html?_nkw=hooh">Browse</a>`;
const DET_HTML = `<a href="https://www.ebay.com/sch/i.html?_nkw=det&campid=5339154326">Browse</a>`;

/** Build deps with per-test overrides + call spies. */
function makeDeps(over: Partial<ComposeDigestDeps> & { spy?: Record<string, number> } = {}): ComposeDigestDeps {
  const spy = over.spy ?? {};
  const inc = (k: string) => (spy[k] = (spy[k] ?? 0) + 1);
  return {
    model: MODEL,
    movers: MOVERS,
    parts: PARTS,
    generateEditorial: over.generateEditorial ?? (async () => { inc("generate"); return ISSUE; }),
    renderEditorial: over.renderEditorial ?? (async () => { inc("renderEditorial"); return WRAPPED_HTML; }),
    renderDeterministic: over.renderDeterministic ?? (async () => { inc("renderDeterministic"); return DET_HTML; }),
    runDeterministicGate: over.runDeterministicGate ?? (() => { inc("gate"); return { passed: true, failures: [] }; }),
    onEditorialSuccess: over.onEditorialSuccess ?? (() => inc("success")),
    onEditorialFallback: over.onEditorialFallback ?? (() => inc("fallback")),
  };
}

test("editorial success → source is editorial, deterministic path is never touched", async () => {
  const spy: Record<string, number> = {};
  const res = await composeDigestForSend(makeDeps({ spy }));
  assert.ok(!isSkip(res));
  const ok = res as ComposedDigest;
  assert.equal(ok.source, "editorial");
  assert.equal(ok.subject, ISSUE.subject);
  assert.equal(ok.previewText, editorialPreviewText(ISSUE));
  assert.equal(ok.html, WRAPPED_HTML);
  assert.match(ok.markdownBody, /The Big Move/);
  assert.equal(ok.downCount, 8);
  assert.equal(ok.upCount, 4);
  assert.equal(spy.success, 1);
  assert.equal(spy.fallback, undefined, "fallback hook must not fire on success");
  assert.equal(spy.renderDeterministic, undefined, "deterministic render must not run on editorial success");
});

test("editorial 3-strike throw → soft-falls to the deterministic digest", async () => {
  const spy: Record<string, number> = {};
  const res = await composeDigestForSend(makeDeps({
    spy,
    generateEditorial: async () => { throw new Error("Editorial issue failed quality gates after 3 attempts"); },
  }));
  assert.ok(!isSkip(res));
  const ok = res as ComposedDigest;
  assert.equal(ok.source, "deterministic");
  assert.equal(ok.subject, PARTS.subject);
  assert.equal(ok.previewText, PARTS.previewText);
  assert.equal(ok.markdownBody, PARTS.bodyMarkdown);
  assert.equal(ok.html, DET_HTML);
  assert.equal(spy.fallback, 1, "fallback hook fires when editorial throws");
  assert.equal(spy.success, undefined);
});

test("editorial renders an UNWRAPPED affiliate link → soft-falls (never ships untracked links)", async () => {
  const spy: Record<string, number> = {};
  let fallbackErr: Error | null = null;
  const res = await composeDigestForSend(makeDeps({
    spy,
    renderEditorial: async () => UNWRAPPED_HTML,
    onEditorialFallback: (e) => { spy.fallback = (spy.fallback ?? 0) + 1; fallbackErr = e; },
  }));
  assert.ok(!isSkip(res));
  assert.equal((res as ComposedDigest).source, "deterministic");
  assert.equal(spy.fallback, 1);
  assert.match(String(fallbackErr), /affiliate/i, "the fallback reason names the affiliate-link failure");
});

test("editorial render THROWS (template/runtime error) → soft-falls to deterministic", async () => {
  const spy: Record<string, number> = {};
  const res = await composeDigestForSend(makeDeps({
    spy,
    renderEditorial: async () => { throw new Error("render blew up"); },
  }));
  assert.ok(!isSkip(res));
  assert.equal((res as ComposedDigest).source, "deterministic");
  assert.equal(spy.fallback, 1);
});

test("editorial fails AND deterministic gate fails → skip the send (a genuinely bad-data week)", async () => {
  const spy: Record<string, number> = {};
  const res = await composeDigestForSend(makeDeps({
    spy,
    generateEditorial: async () => { throw new Error("3-strike"); },
    runDeterministicGate: () => ({ passed: false, failures: ["No cooling-off candidates this week"] }),
  }));
  assert.ok(isSkip(res));
  if (isSkip(res)) {
    assert.equal(res.reason, "deterministic_gate_failed");
    assert.deepEqual(res.failures, ["No cooling-off candidates this week"]);
  }
  assert.equal(spy.fallback, 1);
});

// --- affiliateLinkIntegrity (the shared render-layer revenue invariant) ---------
test("affiliateLinkIntegrity: a wrapped eBay link passes, an unwrapped one fails", () => {
  const wrapped = affiliateLinkIntegrity(`<a href="https://www.ebay.com/sch/i.html?_nkw=x&amp;campid=5339154326">b</a>`);
  assert.equal(wrapped.ok, true);
  assert.equal(wrapped.total, 1);

  const unwrapped = affiliateLinkIntegrity(`<a href="https://www.ebay.com/sch/i.html?_nkw=x">b</a>`);
  assert.equal(unwrapped.ok, false);
  assert.equal(unwrapped.unwrapped, 1);

  const none = affiliateLinkIntegrity(`<p>no links here</p>`);
  assert.equal(none.ok, false);
  assert.equal(none.total, 0);
});

// --- pure serializer + helpers --------------------------------------------------
test("serializeEditorialIssue lays out every segment in order", () => {
  const md = serializeEditorialIssue(ISSUE, { gatesPassed: true });
  for (const heading of ["The Open", "The Big Move", "Cooling Off", "Heating Up", "Seller's Note", "The Read", "One More Thing"]) {
    assert.ok(md.includes(heading), `missing segment: ${heading}`);
  }
  assert.ok(md.includes(ISSUE.bigMove.cardName));
  assert.ok(md.includes(ISSUE.signoff));
  assert.match(md, /Gates: PASS/);
});

test("editorialPreviewText takes the first sentence of The Open and caps length", () => {
  const preview = editorialPreviewText(ISSUE);
  assert.equal(preview, "The market this week is running two speeds.");
  const long = editorialPreviewText({ ...ISSUE, open: "x".repeat(300) }, 50);
  assert.ok(long.length <= 50);
  assert.ok(long.endsWith("…"));
});

test("matchModelCard maps a pick name back to its model card (exact + lenient)", () => {
  assert.equal(matchModelCard("Pikachu", MODEL)?.name, "Pikachu");
  assert.equal(matchModelCard("Petrel", MODEL)?.name, "Petrel");
  // lenient: a fuller name still resolves to the model card it contains
  assert.equal(matchModelCard("Team Rocket's Petrel", MODEL)?.name, "Petrel");
  assert.equal(matchModelCard("Nonexistent Card", MODEL), null);
});
