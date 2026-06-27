// X content-bot tests (ADR-058). The load-bearing one: X_BOT_LIVE=false NEVER
// calls the X API boundary. Plus angle rotation, the voice gate, and live posting.

import test from "node:test";
import assert from "node:assert/strict";
import { angleForDate, resolveAngle, POST_ANGLES } from "../social/angles.ts";
import { buildUserPrompt, generatePostText, type DealData, type SpotlightData, type PostInput } from "../social/post-text.ts";
import { runXBot, type XBotDeps } from "../social/bot.ts";
import { postToX } from "../social/x-client.ts";

const DEAL: DealData = { cardName: "Jolteon VMAX", setName: "Evolving Skies", slug: "swsh7-51-jolteon-vmax", deltaPct: -29.8, soldReference: 11.4, matchedTier: "NEAR_MINT" };
const SPOT: SpotlightData = { cardName: "Charizard", setName: "Base Set", slug: "base1-4-charizard", soldReference: 350, sampleSize: 168 };

function baseDeps(over: Partial<XBotDeps> = {}): XBotDeps {
  return {
    mode: "dry_run",
    now: new Date("2026-06-08T14:00:00Z"),
    getDeals: async () => [DEAL],
    getSpotlight: async () => SPOT,
    generateText: async (input) => ({ text: `post ${input.angle} https://foiltcg.com/deals`, angle: input.angle, link: "https://foiltcg.com/deals", attempts: 1 }),
    renderImage: async () => new Uint8Array([1, 2, 3]),
    post: async () => ({ ok: true, postId: "999" }),
    review: async () => {},
    ...over,
  };
}

// --- angle rotation ---

test("angleForDate cycles deal -> spotlight -> educational by UTC day", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(Date.UTC(2026, 5, 1 + i));
    seen.add(angleForDate(d));
  }
  assert.deepEqual([...seen].sort(), [...POST_ANGLES].sort());
  // Consecutive days differ (true rotation, not random).
  assert.notEqual(angleForDate(new Date(Date.UTC(2026, 5, 1))), angleForDate(new Date(Date.UTC(2026, 5, 2))));
});

test("resolveAngle falls back off deal_of_day when the board is empty", () => {
  // Find a date whose intended angle is deal_of_day, then starve it.
  let dealDate: Date | null = null;
  for (let i = 0; i < 3; i++) {
    const d = new Date(Date.UTC(2026, 5, 1 + i));
    if (angleForDate(d) === "deal_of_day") { dealDate = d; break; }
  }
  assert.ok(dealDate);
  assert.equal(resolveAngle(dealDate!, { hasDeal: false, hasSpotlight: true }), "price_spotlight");
  assert.equal(resolveAngle(dealDate!, { hasDeal: false, hasSpotlight: false }), "educational");
  assert.equal(resolveAngle(dealDate!, { hasDeal: true, hasSpotlight: true }), "deal_of_day");
});

// --- THE safety invariant ---

test("DRY-RUN (mode=dry_run) NEVER calls the X poster; it routes to review", async () => {
  let postCalls = 0;
  let reviewCalls = 0;
  const res = await runXBot(baseDeps({
    mode: "dry_run",
    post: async () => { postCalls++; return { ok: true, postId: "x" }; },
    review: async () => { reviewCalls++; },
  }));
  assert.equal(postCalls, 0, "the X API boundary must NOT be called in dry_run");
  assert.equal(reviewCalls, 1, "the draft must be routed to review");
  assert.equal(res.posted, false);
  assert.equal(res.reason, "dry_run");
  assert.equal(res.ok, true);
});

test("LIVE (mode=live) calls the X poster exactly once and reports the post id", async () => {
  let postCalls = 0;
  const res = await runXBot(baseDeps({ mode: "live", post: async () => { postCalls++; return { ok: true, postId: "1234" }; } }));
  assert.equal(postCalls, 1);
  assert.equal(res.posted, true);
  assert.equal(res.postId, "1234");
});

test("LIVE post failure soft-fails (ok:false, posted:false), never throws", async () => {
  const res = await runXBot(baseDeps({ mode: "live", post: async () => ({ ok: false, error: "create_post_http_403" }) }));
  assert.equal(res.ok, false);
  assert.equal(res.posted, false);
  assert.equal(res.error, "create_post_http_403");
});

test("a render failure does not block the post (image is best-effort)", async () => {
  let posted = false;
  await runXBot(baseDeps({ mode: "live", renderImage: async () => { throw new Error("satori boom"); }, post: async ({ imagePng }) => { posted = imagePng === null; return { ok: true, postId: "1" }; } }));
  assert.equal(posted, true, "post still goes out with null image");
});

// --- voice gate (Gates 12/13) ---

test("generatePostText retries past an em-dash/banned draft, returns a clean one", async () => {
  const input: PostInput = { angle: "educational", date: "June 8, 2026" };
  let call = 0;
  const generate = async () => {
    call++;
    return call === 1
      ? "This is an amazing deal — guaranteed https://foiltcg.com/deals" // em dash + hype
      : "Foil matches condition and language before calling anything a deal. https://foiltcg.com/deals";
  };
  const out = await generatePostText(input, { generate });
  assert.equal(out.attempts, 2);
  assert.doesNotMatch(out.text, /—/);
  assert.match(out.text, /foiltcg\.com/);
});

test("generatePostText throws when it can't pass the gates", async () => {
  const input: PostInput = { angle: "educational", date: "June 8, 2026" };
  const generate = async () => "guaranteed amazing deal — to the moon https://foiltcg.com/deals";
  await assert.rejects(generatePostText(input, { generate, maxAttempts: 2 }), /failed voice\/format gates/);
});

test("buildUserPrompt embeds the real deal numbers", () => {
  const p = buildUserPrompt({ angle: "deal_of_day", date: "June 8, 2026", deal: DEAL });
  assert.match(p, /30% below/); // 29.8 rounds to 30
  assert.match(p, /Jolteon VMAX/);
  assert.match(p, /Near Mint/);
});

// --- X-client boundary ---

test("postToX soft-fails with missing_x_credentials when creds absent (no throw)", async () => {
  const res = await postToX({ text: "hi", credentials: undefined, fetchImpl: (async () => new Response("{}")) as unknown as typeof fetch });
  // No X_* env in test → credentials null → soft-fail.
  if (process.env.X_API_KEY) { return; } // skip if a dev has real creds loaded
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.error, "missing_x_credentials");
});
