// Buy-signal methodology copy (ROADMAP #32 / ADR-053). Kept as data so the
// /pricing-methodology page renders it AND the quality gates (12: no em dashes;
// 13: anti-hype) scan it in tests. Brand voice: analytical, precise, calm.

export const METHODOLOGY_TITLE = "How Foil computes the buy signal";
// Page-level freshness marker (the /pricing-methodology header). Bumped
// 2026-06-12 for the machine-pricing disclosure section (lib/vending/
// machine-pricing-content.ts); the buy-signal sections below are unchanged.
export const METHODOLOGY_LAST_UPDATED = "2026-06-12";

export const METHODOLOGY_INTRO =
  "Some per-card pages show a buy signal: a calm read on whether the current asking price sits below, at, or above what the card has recently sold for. It is not advice and it is not a price prediction. It is one number, computed the same way every time, and the method is laid out here so you can judge it yourself.";

export type MethodologySection = { heading: string; body: string };

export const METHODOLOGY_SECTIONS: MethodologySection[] = [
  {
    heading: "What we compare",
    body:
      "The signal compares the current best asking price we surface against the card's recent sold prices over the last 30 days. Today that reference is the 30-day sold average reported by our pricing source, weighted by how many sales each condition tier carried. We say average, not median, because that is what the number currently is. When a per-sale feed becomes available, the same classifier runs on the median of individual sales, which resists outliers better than an average. We would rather name the limitation than imply a precision we do not have.",
  },
  {
    heading: "The three states and the thresholds",
    body:
      "The asking price is classified against that reference with a 10% band. Below 30-day sold means the ask is more than 10% under the reference. Above 30-day sold means it is more than 10% over. At 30-day sold means it is within 10% either way. The band is deliberate: a tighter cutoff would flip the signal on normal day-to-day noise, and a wider one would call meaningful gaps a tie. The percentage you see is the exact distance from the reference, rounded to one decimal.",
  },
  {
    heading: "Condition matters, so we filter it",
    body:
      "A raw card and a graded slab are different markets, and a PSA 10 can trade at many times the raw price. When the asking price is for a raw copy, graded-slab sales are excluded from the reference. Comparing across condition would produce a confident number that means nothing, so we do not do it. Condition is read from the data we have, which is itself imperfect, and the limitations section below is honest about where that can go wrong.",
  },
  {
    heading: "Matching the listing to its condition",
    body:
      "A buy signal is only honest if the asking price and the sold reference describe the same thing. The live listing rarely states its condition in a structured field, so we infer it from the title: explicit grades like PSA 10, raw phrases like Near Mint or Lightly Played, and their abbreviations. We then compare the ask against the sold average for that exact condition, never against a different one. When the title gives no clear condition, or names a different market, a lot, or a likely reproduction, we infer nothing and show no signal. We also refuse to classify an ask that sits below half the lowest sold tier on the card: at that point it is almost certainly damaged, mislabeled, or not the card it claims to be, and calling it a deal would be the opposite of useful. This is deliberately conservative. A missing signal means we were not confident enough to stand behind one, which is the honest outcome on a thin or mismatched listing.",
  },
  {
    heading: "Why some cards show no signal",
    body:
      "If fewer than five comparable sales exist in the 30-day window, we show no signal at all. A reference built from two or three sales is not a market read, it is a coincidence, and a badge would lend it a confidence it has not earned. Blank is the correct output for a thin sample. You will see this most on low-volume cards, vintage, and obscure printings, and that is working as intended rather than a gap to paper over.",
  },
  {
    heading: "Known limitations",
    body:
      "Three things to keep in mind. First, the 30-day window weights recent activity, so a single active week can pull the reference up or down, and the signal trails a fast move rather than predicting it. Second, the reference is currently an average, not a median, so a few unusual sales influence it more than they should until per-sale data lets us switch to a true median. Third, condition is inferred, and a mislabeled listing can skew a comparison in either direction. A buy signal is only as honest as the data beneath it, which is why we publish the data alongside it.",
  },
  {
    heading: "Where the numbers come from",
    body:
      "Every per-card page shows the 30-day sold-price history the signal is built from, broken out by condition, with the sale counts. The signal is a summary of those numbers, not a replacement for them. If a card matters to you, read the history and decide for yourself. The signal is there to save you a calculation, not to make the call.",
  },
];

/** Single concatenated string for the quality gates to scan in tests. */
export function methodologyText(): string {
  return [METHODOLOGY_TITLE, METHODOLOGY_INTRO, ...METHODOLOGY_SECTIONS.flatMap((s) => [s.heading, s.body])].join("\n\n");
}
