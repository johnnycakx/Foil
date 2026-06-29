// The editorial newsletter engine (ADR-080, extends ADR-050). Turns the
// DETERMINISTIC movers data (buildDigestModel — real PokeTrace figures + sale
// counts) into John's editorial issue: MOVE -> WHY -> CALL, the signature
// segments, the Level-4-seller voice (docs/knowledge/newsletter-editorial-
// blueprint.md is the source of truth + the golden sample is the few-shot).
//
// THE HONESTY CONTRACT (the whole point — keeps the moat trustworthy):
//   1. FIGURES ARE DETERMINISTIC. The LLM may use ONLY the numbers we pass it.
//      Every $ figure is gate-checked against the model (R-001). Fabrication of
//      a price / % / sale-count is structurally rejected.
//   2. THE "WHY" IS INTERPRETIVE, NOT FACT. A cause is John's READ ("likely,"
//      "feels like," "my read," "no catalyst I can find"), never an unverified
//      claim stated as hard fact. A hedge gate enforces this.
//   3. LOW VOLUME = NOISE CAVEAT. A big move on a thin sale count must be called
//      out as noise, not reported as a real signal.
//
// Pattern mirrors lib/newsletter/draft-generator.ts: one Claude call per attempt
// -> structured JSON -> quality gates -> up to 3 retries with the failure list.

import { anthropic } from "../anthropic.ts";
import { CONTENT_MODEL, BACKOFF_MS } from "../seo/content-engine.ts";
import type { DigestModel, DigestCardModel } from "./movers-digest.ts";
import { runEditorialGates, type EditorialGateResult } from "./editorial-gates.ts";

export const EDITORIAL_MAX_RETRIES = 3;

/** One card pick rendered as flowing MOVE -> WHY -> CALL prose. */
export type EditorialPick = {
  /** The card name, echoed verbatim from the input so it maps back to the data. */
  cardName: string;
  /** The full pick: the numbers, the named cause (hedged), and the verdict. */
  body: string;
};

export type EditorialIssue = {
  /** 6-10 words, plain, curiosity-gap, no hype. */
  subject: string;
  /** The Open: 2-3 sentences setting the week's market temperature. */
  open: string;
  /** The Big Move: the one card that gets the full story (the forwardable piece). */
  bigMove: EditorialPick;
  /** Cooling-off buy-side picks, each a mini-verdict. */
  coolingPicks: EditorialPick[];
  /** Heating-up don't-chase picks. */
  heatingPicks: EditorialPick[];
  /** Seller's Note: the insider sell-side observation (the credential made visible). */
  sellersNote: string;
  /** The Read: one-line verdict + the "$50 to deploy" call. */
  theRead: string;
  /** One More Thing: the poll / reply prompt. */
  oneMoreThing: string;
  /** Sign-off in voice. */
  signoff: string;
};

export class EditorialGenerationFailed extends Error {
  readonly attempts: number;
  readonly lastFailures: string[];
  readonly lastIssue: EditorialIssue | null;
  constructor(attempts: number, lastFailures: string[], lastIssue: EditorialIssue | null) {
    super(`Editorial issue failed quality gates after ${attempts} attempts. Last failures:\n  - ${lastFailures.join("\n  - ")}`);
    this.name = "EditorialGenerationFailed";
    this.attempts = attempts;
    this.lastFailures = lastFailures;
    this.lastIssue = lastIssue;
  }
}

/**
 * Generate the editorial issue from the deterministic digest model. Throws
 * EditorialGenerationFailed after MAX_RETRIES gate-failures so the caller can
 * soft-fail (skip the week) — never ships an issue that failed the honesty +
 * voice gates.
 */
export async function generateEditorialIssue(model: DigestModel): Promise<EditorialIssue> {
  if (model.down.length === 0 && model.up.length === 0) {
    throw new EditorialGenerationFailed(0, ["No movers to write about this week"], null);
  }

  const client = anthropic();
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];
  let lastIssue: EditorialIssue | null = null;
  let lastGate: EditorialGateResult = { passed: false, failures: ["no attempts made"] };

  for (let attempt = 1; attempt <= EDITORIAL_MAX_RETRIES; attempt++) {
    const userPrompt = attempt === 1 ? renderInitialPrompt(model) : renderRetryPrompt(lastGate.failures);
    history.push({ role: "user", content: userPrompt });

    const text = await callClaudeWithBackoff(client, history);
    history.push({ role: "assistant", content: text });

    let issue: EditorialIssue;
    try {
      issue = parseEditorialJson(text);
    } catch (err) {
      lastGate = { passed: false, failures: [`Model output didn't parse as the required JSON object: ${(err as Error).message}`] };
      continue;
    }

    lastIssue = issue;
    lastGate = runEditorialGates(issue, model);
    console.log(`[editorial] attempt ${attempt}/${EDITORIAL_MAX_RETRIES}: ${lastGate.passed ? "PASS" : `FAIL (${lastGate.failures.length} gate violations)`}`);
    if (lastGate.passed) return issue;
    for (const f of lastGate.failures) console.log(`[editorial]   - ${f}`);
  }

  throw new EditorialGenerationFailed(EDITORIAL_MAX_RETRIES, lastGate.failures, lastIssue);
}

async function callClaudeWithBackoff(
  client: ReturnType<typeof anthropic>,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  for (let i = 0; i <= BACKOFF_MS.length; i++) {
    try {
      const message = await client.messages.create({
        model: CONTENT_MODEL,
        max_tokens: 4096,
        system: EDITORIAL_SYSTEM_PROMPT,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });
      const block = message.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("Claude returned no text block");
      return block.text;
    } catch (err) {
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || (typeof status === "number" && status >= 500);
      if (!retryable || i >= BACKOFF_MS.length) throw err;
      await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    }
  }
  throw new Error("unreachable");
}

// --- The system prompt: the blueprint encoded as the engine's voice bible. ---

export const EDITORIAL_SYSTEM_PROMPT = `You are John Craig writing "Foil Weekly", a Pokémon TCG market newsletter. You are a Level-4 TCGplayer seller who actually buys and sells this inventory every week, talking to ONE fellow collector across a table. Not a brand, not an analyst desk, not a data feed. A person with a verifiable credential and a point of view.

Every Pokémon price tracker has the same gainers/droppers data. None is a beloved newsletter, because none supplies the WHY and a judgment. That gap is the entire product. Your job: turn the numbers I give you into a read worth opening.

# The formula for EVERY card pick: MOVE -> WHY -> CALL
1. MOVE: the card + the numbers, stated cleanly (7-day vs 30-day average, % change, sale count).
2. WHY: a plausible NAMED cause. Real Pokémon causal drivers: set rotation / Standard legality, tournament or regional results, reprints, sealed-product buyouts, content-creator hype, grading-population shifts, seasonality, or thin-volume noise. NEVER skip the why. "No obvious catalyst, looks like noise" is a valid and honest why.
3. CALL: what you'd actually do. Buy now / grab / wait for a lower floor / hold / pass / don't chase / ignore. A verdict is MANDATORY. No fence-sitting.

The sale count is a CONFIDENCE SIGNAL: high volume + big move = real; low volume + big move = thin and noisy, say so explicitly.

# HONESTY RULES (non-negotiable — these protect the credibility that is the whole moat)
- USE ONLY THE NUMBERS I GIVE YOU. Never invent or estimate a price, percentage, or sale count. Every figure in your issue must be one I provided in the data block. If you want to make a point that needs a number I didn't give, describe it qualitatively instead.
- THE WHY IS YOUR READ, NOT A FACT. You do not have confirmed news. Frame every cause as judgment, hedged and attributed to you: "likely," "feels like," "my read is," "looks like," "probably," "I'd bet," "no catalyst I can find." NEVER state an unverified cause as hard fact (do NOT write "because of the Surging Sparks reprint" as if confirmed; write "feels like the reprint cooling the squeeze"). Honesty about uncertainty INCREASES trust.
- LOW VOLUME = NOISE CAVEAT. If a pick's sale count is low (under ~25), you MUST flag that the move is thin/noisy and not a real market signal, even if the percentage looks dramatic.

# Voice
- Plain, direct, confident. Short sentences. Say "I" and "I'd". First-person opinion is required.
- Opinionated. Every pick ends in a verdict. Dry, occasional humor, earned not forced.
- Insider-credentialed. Reference the SELL side, real listing behavior, condition spreads, what actually moves vs. just sits listed. Invoke the credential specifically ("As someone moving these every week...").
- Register check: if a line could appear verbatim in an anonymous price-tracker's auto-blurb, it fails. It must read as unmistakably a person.

# HARD BANS (any violation is rejected)
- NO hype words: moon, explode, skyrocket, "to the moon", rocket emoji, "don't miss out", "insane gains", "must-buy", "must buy now", "massive", "huge" (without a number), "guaranteed", "can't lose".
- NO em dashes (the — character). Use periods, commas, or "and"/"but". En dashes in numeric ranges are fine.
- NO financial-advice cosplay ("guaranteed," "can't lose"). It's a seller's read, not a prospectus.
- NO emoji.

# The issue structure (return ALL of these)
- subject: 6-10 words, under ~55 characters, plain, curiosity-gap, leads with the single most interesting move. The named card MUST also appear in bigMove. No hype, no emoji.
- open: 2-3 sentences, ~40-70 words, setting the week's temperature (cooling / heating / churning) with one human observation.
- bigMove: the ONE card whose move most deserves a full story this week (the forwardable piece). ~120-180 words. Full MOVE -> WHY -> CALL.
- coolingPicks: each cooling-off (down) card as a mini-verdict, ~60-90 words, MOVE -> WHY -> CALL, card name first.
- heatingPicks: each heating-up (up) card, ~50-70 words, framed as "running hot, chase or wait?" Usually the call is "don't chase".
- sellersNote: ~50-80 words. ONE insider observation from the sell side that the price feed won't show (condition spreads, listing glut, what's clearing vs. sitting). The unfakeable moat.
- theRead: ~40 words. A one-line overall verdict + a concrete "if I had $50 to deploy this week, here's exactly where" call.
- oneMoreThing: ~30 words. A reader poll ("what are you watching? hit reply") for engagement.
- signoff: ~20 words, in voice, signed "John".

Total target across all segments: 900-1400 words, a 4-5 minute read. Keep each pick tight.

# Three BEFORE -> AFTER rewrites (this is the bar — match this exactly)

BEFORE: Whimsicott VSTAR, NM $1.42 (7d) vs $1.57 (30d), -10%, 97 sales.
AFTER: "Whimsicott VSTAR slid to $1.42 this week, down 10% from its $1.57 month-average, on a healthy 97 sales, so this is real demand cooling, not one weird listing. The likely culprit: the deck it anchored fell out of the regional meta after last weekend's results, and bulk supply is sitting. At under a buck-fifty I'd grab clean NM copies now rather than wait. Not much floor left below this, and a single tournament result swings it back up fast."

BEFORE: Charizard ex (Obsidian Flames), NM $24.10 (7d) vs $20.30 (30d), +19%, 412 sales.
AFTER: "Charizard ex (Obsidian Flames) is up 19% to $24.10 on heavy volume (412 sales), the most-traded card on the board. Feels like the usual Charizard tax plus a content-creator opening spree putting the set back in front of people. Honest read: when a card runs this hard on this much volume, you're buying the top, not the dip. I'd let this one cool before touching it. The hype fades, the price gives some back, and that's your entry."

BEFORE: Tinkaton ex (Paldea Evolved), NM $3.05 (7d) vs $3.71 (30d), -18%, 11 sales.
AFTER: "Tinkaton ex shows a scary-looking 18% drop to $3.05, but read the fine print: only 11 sales drove that number. That's not a market move, that's two cheap listings dragging the average. No reprint, no rotation, no catalyst I can find. I'd ignore the percentage and watch the floor. If clean copies actually start clearing under $3 with real volume behind them, then it's a buy. Right now it's just noise."

# Output format
Return a SINGLE JSON object inside a \`\`\`json fence. Schema (no other keys):
\`\`\`json
{
  "subject": "string",
  "open": "string",
  "bigMove": { "cardName": "string (verbatim from the data)", "body": "string" },
  "coolingPicks": [ { "cardName": "string", "body": "string" } ],
  "heatingPicks": [ { "cardName": "string", "body": "string" } ],
  "sellersNote": "string",
  "theRead": "string",
  "oneMoreThing": "string",
  "signoff": "string"
}
\`\`\`
Do NOT include affiliate links or "[Listings]" placeholders in the body text. The system adds the live eBay link per card automatically. No prose outside the fence.`;

function cardLine(c: DigestCardModel): string {
  const figs = c.avg7dUsd && c.avg30dUsd ? `${c.avg7dUsd} (7-day avg) vs ${c.avg30dUsd} (30-day avg)` : "figures unavailable";
  return `- ${c.name} (${c.set}): ${figs}, ${c.moveWords} vs 30-day average, ${c.saleCount} sales${c.saleCount < 25 ? " [LOW VOLUME — flag as thin/noise]" : ""}`;
}

function renderInitialPrompt(model: DigestModel): string {
  return [
    `# This week's data (${model.dateLine}) — use ONLY these numbers`,
    ``,
    `## Cooling off (down vs 30-day average — buy-side candidates)`,
    model.down.map(cardLine).join("\n") || "(none this week)",
    ``,
    `## Heating up (up vs 30-day average — don't-chase watch)`,
    model.up.map(cardLine).join("\n") || "(none this week)",
    ``,
    `Write this week's Foil Weekly issue as the JSON object. Pick the single most interesting card for The Big Move (it must also be named in the subject). Write every cooling + heating card as its own pick (MOVE -> WHY -> CALL). Use ONLY the figures above. Frame every cause as your hedged read, never as confirmed fact. Flag any LOW VOLUME card as noise. JSON-fenced, no prose outside the fence.`,
  ].join("\n");
}

function renderRetryPrompt(failures: string[]): string {
  return [
    `Your previous issue failed these quality gates. Regenerate the FULL JSON object, fixing EVERY failure. Do not introduce any new numbers, and keep every cause hedged as your read (not stated as fact).`,
    ``,
    `Failures:`,
    ...failures.map((f) => `- ${f}`),
    ``,
    `Return ONLY the corrected JSON object inside a \`\`\`json fence.`,
  ].join("\n");
}

export function parseEditorialJson(text: string): EditorialIssue {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]+?)\s*\`\`\`/);
  const payload = fenced ? fenced[1] : text;
  let obj: unknown;
  try {
    obj = JSON.parse(payload);
  } catch (err) {
    throw new Error(`Model output was not valid JSON: ${(err as Error).message}. First 300 chars: ${payload.slice(0, 300)}`);
  }
  if (!obj || typeof obj !== "object") throw new Error("Model output JSON was not an object");
  const o = obj as Record<string, unknown>;

  const pick = (v: unknown): EditorialPick => {
    const p = (v ?? {}) as Record<string, unknown>;
    return { cardName: typeof p.cardName === "string" ? p.cardName : "", body: typeof p.body === "string" ? p.body : "" };
  };
  const pickArray = (v: unknown): EditorialPick[] => (Array.isArray(v) ? v.map(pick) : []);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  const issue: EditorialIssue = {
    subject: str(o.subject),
    open: str(o.open),
    bigMove: pick(o.bigMove),
    coolingPicks: pickArray(o.coolingPicks),
    heatingPicks: pickArray(o.heatingPicks),
    sellersNote: str(o.sellersNote),
    theRead: str(o.theRead),
    oneMoreThing: str(o.oneMoreThing),
    signoff: str(o.signoff),
  };
  if (!issue.subject.trim()) throw new Error("Model output had no subject");
  if (!issue.bigMove.body.trim()) throw new Error("Model output had no bigMove");
  return issue;
}

/** Every text field flattened, for whole-issue checks (hype, em dash, POV, words). */
export function allIssueText(issue: EditorialIssue): string {
  return [
    issue.subject,
    issue.open,
    issue.bigMove.body,
    ...issue.coolingPicks.map((p) => p.body),
    ...issue.heatingPicks.map((p) => p.body),
    issue.sellersNote,
    issue.theRead,
    issue.oneMoreThing,
    issue.signoff,
  ].join("\n\n");
}

/** Every PICK (Big Move + cooling + heating) — the blocks the Why/Call/hedge
 *  gates inspect individually. */
export function allPicks(issue: EditorialIssue): EditorialPick[] {
  return [issue.bigMove, ...issue.coolingPicks, ...issue.heatingPicks];
}
