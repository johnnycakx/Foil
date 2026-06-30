// The recent-search queries the engagement engine runs (ADR-086). Pokemon-scoped,
// English, retweets/replies excluded, tuned to high buy/value intent — the posts
// where a real sold-data reply genuinely helps. Pure config; the engine reads
// these. (X v2 search operators: -is:retweet -is:reply lang:en.)
export const ENGAGEMENT_QUERIES: readonly string[] = [
  '(pokemon card OR pokemon tcg) (worth OR value OR "how much") -is:retweet -is:reply lang:en',
  'pokemon (card OR booster OR sealed) ("should i buy" OR "good buy" OR "worth it" OR "worth grading") -is:retweet -is:reply lang:en',
  '(charizard OR umbreon OR moonbreon OR "alt art") (worth OR price OR value OR "good buy") pokemon -is:retweet -is:reply lang:en',
];
