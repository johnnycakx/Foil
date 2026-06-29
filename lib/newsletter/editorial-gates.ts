// Editorial quality gates (ADR-080). The structural enforcement that makes the
// editorial issue "amazing" by construction, not by hope — mirroring how the
// blog engine enforces its 8 gates. Runs on the EditorialIssue (the LLM output)
// against the deterministic DigestModel (the real figures). A failing issue is
// re-prompted (up to 3x) or the week is skipped; it never ships.
//
// The blueprint's 9 gates (Why, Call, Signature-segment, Volume-honesty, POV,
// Hype-ban + em-dash, Length/skim, Subject-line) PLUS two honesty gates the
// "interpretive why" demands: Figures-trace (R-001 — every $ figure is one we
// supplied) and Causal-hedge (causes are framed as a read, never hard fact).
// (The 9th blueprint gate, Affiliate-placement, is enforced at the render layer
// — the template places one inline eBay link per pick, no footer banner — and
// is pinned by the template test, not here, since the LLM emits no links.)

import { extractDollarFigures, bannedPhraseMatches } from "./quality-gates.ts";
import type { DigestModel, DigestCardModel } from "./movers-digest.ts";
import { allIssueText, allPicks, type EditorialIssue, type EditorialPick } from "./editorial-engine.ts";

export type EditorialGateResult = { passed: boolean; failures: string[] };

/** Sale count below which a move is "thin/noisy" and must carry a caveat. */
export const MIN_SALE_VOLUME = 25;
export const EDITORIAL_WORD_MIN = 850;
export const EDITORIAL_WORD_MAX = 1500;
/** Cooling/heating picks stay tight; the Big Move is the one full story (the
 *  blueprint allows it ~120-180 words), so it gets a higher cap. */
export const PICK_WORD_MAX = 110;
export const BIG_MOVE_WORD_MAX = 200;
export const SUBJECT_CHAR_MAX = 60;

// A named cause must come from one of these mechanisms (the blueprint's drivers).
// "No catalyst / noise" counts — honest uncertainty is a valid why.
const CAUSAL_KEYWORDS = [
  "reprint", "rotation", "rotat", "standard", "tournament", "regional", "meta", "deck",
  "hype", "creator", "youtuber", "opening", "buyout", "bought out", "sealed", "supply",
  "oversupplied", "oversupply", "glut", "season", "holiday", "noise", "thin", "volume",
  "few sales", "catalyst", "demand", "cooling", "cooled", "population", "pop ", "psa",
  "grading", "reprinted", "listing", "floor", "drift", "settling",
];

// A verdict token — every pick must end in a decision.
const VERDICT_TOKENS = [
  "i'd buy", "i'd grab", "i'd take", "i'd pick", "i'd hold", "i'd wait", "i'd pass",
  "i'd skip", "i'd ignore", "i'd let", "i'd leave", "i'd avoid", "i'd watch", "i'd make",
  "buy now", "grab", "take clean", "wait", "hold", "pass", "skip", "ignore", "don't chase",
  "do not chase", "watch the floor", "watch it", "make offers", "pick up", "leave it", "avoid",
  "not a discount", "no rush", "buy, not", "this is the kind of dip you buy",
];

// First-person opinion markers (POV gate).
const POV_MARKERS = ["i'd", "i'm", "my read", "i think", "i'd bet", "i move", "i list", "as someone", "here's what i", "i read", "i'm seeing", "i've"];

// Hedge/uncertainty markers — a cause must be framed as a READ, not a fact.
const HEDGE_MARKERS = [
  "likely", "feels like", "feel like", "my read", "looks like", "probably", "seems", "i'd bet",
  "no catalyst", "can't find", "i think", "reads like", "my sense", "my guess", "no obvious",
  "nothing obvious", "looks more like", "appears", "i suspect", "best guess", "no clean catalyst",
  "just ", "honest read", "the tell", "read the fine print", "not a", "no reprint", "no rotation",
];

// Banned hype words (extends the shared banned-phrase list). Word-boundaried where
// a substring would false-positive (e.g. "huge" only banned without a nearby number
// is handled by the anti-hype gate elsewhere; here we ban the hard hype set).
const HYPE_BANNED = [
  "to the moon", "🚀", "skyrocket", "explode", "exploding", "moonshot", "don't miss out",
  "do not miss out", "insane gains", "must-buy", "must buy now", "guaranteed", "can't lose",
  "cannot lose", "massive gains",
];

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
}

function normalizeDollar(raw: string): string {
  const d = raw.replace(/[$,]/g, "");
  if (d.endsWith(".00")) return d.slice(0, -3);
  if (d.endsWith(".0")) return d.slice(0, -2);
  return d;
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function containsAny(haystack: string, needles: string[]): boolean {
  const low = haystack.toLowerCase();
  return needles.some((n) => low.includes(n));
}

/** Find the model card a pick refers to (lenient name match). */
function matchCard(pick: EditorialPick, model: DigestModel): DigestCardModel | null {
  const target = normName(pick.cardName);
  const all = [...model.down, ...model.up];
  return (
    all.find((c) => normName(c.name) === target) ??
    all.find((c) => target && (normName(c.name).includes(target) || target.includes(normName(c.name)))) ??
    null
  );
}

export function runEditorialGates(
  issue: EditorialIssue,
  model: DigestModel,
  opts: { wordMin?: number; wordMax?: number } = {},
): EditorialGateResult {
  const wordMin = opts.wordMin ?? EDITORIAL_WORD_MIN;
  const wordMax = opts.wordMax ?? EDITORIAL_WORD_MAX;
  const failures: string[] = [];
  const picks = allPicks(issue);
  const whole = allIssueText(issue);

  // (1) Why-gate: every pick names a cause.
  for (const p of picks) {
    if (!containsAny(p.body, CAUSAL_KEYWORDS)) {
      failures.push(`Why-gate: the "${p.cardName}" pick has no named cause (reprint/rotation/tournament/hype/buyout/seasonal/noise/etc.). Every pick must explain the WHY.`);
    }
  }

  // (2) Call-gate: every pick ends in a verdict.
  for (const p of picks) {
    if (!containsAny(p.body, VERDICT_TOKENS)) {
      failures.push(`Call-gate: the "${p.cardName}" pick has no verdict (buy/grab/wait/hold/pass/don't chase/ignore). Every pick must end in a decision.`);
    }
  }

  // (3) Signature-segment gate: Big Move + Seller's Note + The Read ($50 call).
  if (!issue.bigMove.body.trim()) failures.push("Signature-segment gate: missing The Big Move.");
  if (!issue.sellersNote.trim()) failures.push("Signature-segment gate: missing the Seller's Note.");
  if (!issue.theRead.trim()) failures.push("Signature-segment gate: missing The Read ($50 call).");
  else if (!/\$?\s?50\b/.test(issue.theRead) && !/fifty/i.test(issue.theRead)) {
    failures.push("Signature-segment gate: The Read must contain the concrete '$50 to deploy' call.");
  }

  // (4) Volume-honesty gate: a thin-volume move must carry a noise caveat.
  for (const p of picks) {
    const card = matchCard(p, model);
    if (card && card.saleCount < MIN_SALE_VOLUME) {
      const flagged = /noise|thin|fine print|few sales|low volume|only \d+ sales|not a (real )?market move|two cheap listings|drag/i.test(p.body);
      if (!flagged) {
        failures.push(`Volume-honesty gate: "${p.cardName}" moved on only ${card.saleCount} sales but the pick presents it as a real move with no thin-volume/noise caveat.`);
      }
    }
  }

  // (5) POV gate: at least one first-person opinion line.
  if (!containsAny(whole, POV_MARKERS) && !/\bI\b/.test(whole)) {
    failures.push("POV gate: no first-person opinion anywhere. The issue must read as John, not a data feed.");
  }

  // (6) Hype-ban + em-dash gate.
  const emDashes = (whole.match(/—/g) || []).length;
  if (emDashes > 0) failures.push(`Hype/em-dash gate: ${emDashes} em dash(es) found. Recast with commas, periods, or "and"/"but".`);
  const hype = HYPE_BANNED.filter((h) => whole.toLowerCase().includes(h));
  const banned = bannedPhraseMatches(whole);
  if (hype.length + banned.length > 0) {
    failures.push(`Hype/em-dash gate: banned phrases detected: ${[...hype, ...banned].map((p) => `"${p}"`).join(", ")}.`);
  }

  // (7) Length/skim gate.
  const words = wordCount(whole);
  if (words < wordMin) failures.push(`Length gate: ${words} words, under the ${wordMin} minimum (target a 4-5 min read). Expand the picks' WHY + CALL.`);
  if (words > wordMax) failures.push(`Length gate: ${words} words, over the ${wordMax} maximum. Tighten each pick.`);
  if (wordCount(issue.bigMove.body) > BIG_MOVE_WORD_MAX) {
    failures.push(`Length gate: The Big Move ("${issue.bigMove.cardName}") is ${wordCount(issue.bigMove.body)} words, over ${BIG_MOVE_WORD_MAX}.`);
  }
  for (const p of [...issue.coolingPicks, ...issue.heatingPicks]) {
    if (wordCount(p.body) > PICK_WORD_MAX) {
      failures.push(`Length gate: the "${p.cardName}" pick is ${wordCount(p.body)} words, over ${PICK_WORD_MAX}. Keep each pick tight.`);
    }
  }

  // (8) Subject-line gate: short, plain, curiosity-gap; the named card appears in Big Move.
  const subj = issue.subject.trim();
  const subjWords = wordCount(subj);
  if (subjWords < 4 || subjWords > 12) failures.push(`Subject-line gate: ${subjWords} words (target 6-10).`);
  if (subj.length > SUBJECT_CHAR_MAX) failures.push(`Subject-line gate: ${subj.length} chars, over ${SUBJECT_CHAR_MAX}. Inbox previews truncate.`);
  if (containsAny(subj, HYPE_BANNED) || bannedPhraseMatches(subj).length > 0 || /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(subj)) {
    failures.push("Subject-line gate: contains a hype phrase or emoji.");
  }
  if (subj.includes("—")) failures.push("Subject-line gate: contains an em dash.");
  // Soft curiosity-gap-payoff: a significant word of the Big Move card appears in the subject.
  const bigWords = normName(issue.bigMove.cardName).split(" ").filter((w) => w.length >= 4);
  if (bigWords.length && !bigWords.some((w) => normName(subj).includes(w))) {
    failures.push(`Subject-line gate: the subject should name the Big Move card ("${issue.bigMove.cardName}") so the curiosity gap pays off in-issue.`);
  }

  // (HONESTY A) Figures-trace gate (R-001): every $ figure is one we supplied.
  // Allowed = the exact supplied figures AND their integer-rounded form (writing
  // "$216" for a real "$216.33" is the same figure rounded, not a fabrication).
  const allowed = new Set<string>();
  const addAllowed = (usd: string | null) => {
    if (!usd) return;
    allowed.add(normalizeDollar(usd));
    const n = parseFloat(usd.replace(/[$,]/g, ""));
    if (Number.isFinite(n)) allowed.add(String(Math.round(n)));
  };
  for (const c of [...model.down, ...model.up]) {
    addAllowed(c.avg7dUsd);
    addAllowed(c.avg30dUsd);
  }
  const fabricated: string[] = [];
  const seen = new Set<string>();
  for (const f of extractDollarFigures(whole)) {
    const n = normalizeDollar(f);
    if (n === "50") continue; // the "$50 to deploy" call is editorial, not a market figure
    if (allowed.has(n) || seen.has(n)) continue;
    seen.add(n);
    fabricated.push(f);
  }
  if (fabricated.length > 0) {
    failures.push(`Figures-trace gate (honesty): $ figures not in the supplied data: ${fabricated.join(", ")}. Use ONLY the prices I gave you.`);
  }

  // (HONESTY B) Causal-hedge gate: causes are framed as a READ, not hard fact.
  for (const p of picks) {
    if (!containsAny(p.body, HEDGE_MARKERS)) {
      failures.push(`Causal-hedge gate (honesty): the "${p.cardName}" pick states its cause without hedging ("likely," "feels like," "my read," "no catalyst I can find"). The WHY is interpretation, never asserted as confirmed fact.`);
    }
  }

  return { passed: failures.length === 0, failures };
}
