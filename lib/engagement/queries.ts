// The recent-search queries the engagement engine runs (ADR-086; widened in the
// ADR-086 amendment engagement-brief-widen-scan). Pokemon-scoped, English,
// retweets/replies excluded, tuned to high buy/value intent — the posts where a
// real sold-data reply genuinely helps. Pure config; the engine reads these.
// (X v2 search operators: -is:retweet -is:reply lang:en.)
//
// Widened 3 → 9 for more high-reach SURFACE AREA (not lower quality): the
// candidate filter's POKEMON_SIGNAL + VALUE_INTENT guards + the opportunityScore
// ranking still gate quality, so extra queries only add reach — the top of the
// brief stays best-first. Quota is a non-issue (project cap 2M/mo, ~480 used at
// widen time; 9 × 50 × 3 runs/day ≈ 40k/mo ≈ 2% of cap). Each query MUST stay
// Pokemon-scoped and carry `-is:retweet -is:reply lang:en` (pinned in tests).
export const ENGAGEMENT_QUERIES: readonly string[] = [
  // — original 3 (value / buy intent) —
  '(pokemon card OR pokemon tcg) (worth OR value OR "how much") -is:retweet -is:reply -giveaway -"giving away" lang:en',
  'pokemon (card OR booster OR sealed) ("should i buy" OR "good buy" OR "worth it" OR "worth grading") -is:retweet -is:reply -giveaway -"giving away" lang:en',
  '(charizard OR umbreon OR moonbreon OR "alt art") (worth OR price OR value OR "good buy") pokemon -is:retweet -is:reply -giveaway -"giving away" lang:en',
  // — grading intent (raw-vs-graded spread is exactly where sold data helps) —
  'pokemon (card OR tcg) ("should i grade" OR "worth grading" OR "psa 10" OR "gem mint" OR "get it graded") -is:retweet -is:reply -giveaway -"giving away" lang:en',
  // — pulls / mail days (surfaces the value-intent subset of pull chatter) —
  'pokemon (card OR tcg) ("just pulled" OR "mail day" OR "pulled this" OR "look what i pulled") (worth OR value OR rare OR "how much" OR grail) -is:retweet -is:reply -giveaway -"giving away" lang:en',
  // — hot current sets by name + value intent —
  'pokemon ("Destined Rivals" OR "Prismatic Evolutions" OR "Surging Sparks" OR "151") (worth OR value OR price OR "good buy" OR chase) -is:retweet -is:reply -giveaway -"giving away" lang:en',
  // — price movement / investment intent —
  'pokemon (card OR tcg) ("price drop" OR "going up" OR tanking OR investment OR "worth holding" OR "worth investing") -is:retweet -is:reply -giveaway -"giving away" lang:en',
  // — authenticity / is-it-worth value questions —
  'pokemon (card OR tcg) ("is this real" OR "is this legit" OR "is this worth" OR "fake or real") -is:retweet -is:reply -giveaway -"giving away" lang:en',
  // — vintage / WOTC value —
  'pokemon (wotc OR "base set" OR "1st edition" OR vintage OR shadowless) (worth OR value OR price OR "how much") -is:retweet -is:reply -giveaway -"giving away" lang:en',
];
