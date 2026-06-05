// Shared content module for /legal/ebay-api-compliance. The Next.js page
// renders this; the drift-detection test in
// lib/__tests__/legal-ebay-api-compliance.test.ts asserts the
// REQUIREMENTS array stays synchronized with the section-c table in
// docs/EBAY-COMPLIANCE.md.
//
// When a new requirement row lands in EBAY-COMPLIANCE.md, the test fails
// until the matching entry is added here. Drift cannot happen silently.
//
// What's intentionally NOT in this module: internal file:line references.
// Those belong in the canonical doc for code reviewers. The public page
// describes the compliance posture in reviewer-facing prose, without
// asking reviewers to navigate a private codebase.

export type PublicRequirement = {
  /** Matches the bold-prefix text of the corresponding row in
   *  EBAY-COMPLIANCE.md section c, verbatim. The drift test asserts
   *  set equality against the markdown's first table column. */
  title: string;
  /** Reviewer-facing description — what we do to comply, no file:line. */
  body: string;
};

export const REQUIREMENTS: readonly PublicRequirement[] = [
  {
    title: "2025 License Agreement — no caching of listing payloads.",
    body: "Every eBay Browse API response is fetched server-side at the moment a visitor loads the page and discarded the moment the response returns. The Next.js route is force-dynamic; the underlying fetch uses cache: 'no-store'. Foil persists no listing data in any cache or database — no cached_listings table exists in the schema, and the function signature that would let a future contributor add one has no caching parameter.",
  },
  {
    title: "2025 License Agreement — no AI training on eBay data.",
    body: "Foil's content-generation pipeline (autonomous blog posts) never imports the affiliate / Browse module and never calls api.ebay.com. The architectural absence is enforced by a structural test that fails the build if the boundary is crossed. Listing data is read render-time and discarded; nothing from it ever reaches a model prompt or training corpus.",
  },
  {
    title: "2025 License Agreement — no AI-generated claims about specific listings.",
    body: "Editorial copy on per-card landing pages (the 'About this card' block) describes the card itself — its set, release year, rarity, and history. AI-generated copy never references specific live listings, prices, sellers, or item IDs. The 'Best current listing' block on each page self-describes from the Browse response at render time and changes on every page load.",
  },
  {
    title: "Marketplace Account Deletion — public webhook required.",
    body: "Foil subscribes to eBay's Marketplace Account Deletion notifications via a public webhook at https://foiltcg.com/api/webhooks/ebay-marketplace-deletion. The endpoint handles eBay's GET verification challenge (SHA-256 of challenge + verification token + endpoint URL) and HMAC-SHA256 verifies every POST notification. The production keyset is verified compliant in the eBay developer dashboard.",
  },
  {
    title: "Marketplace Account Deletion — handler must respond within 3 seconds, must not persist user data.",
    body: "The webhook handler is synchronous — no database writes, no outbound fetches, no awaited work beyond reading the request body. Every POST acknowledges with HTTP 200 and discards the payload. The endpoint stores nothing about eBay users, by design.",
  },
  {
    title: "Browse API auth — `client_credentials` grant with application scope only.",
    body: "Foil authenticates against eBay's Browse API using OAuth's client_credentials grant. The only scope requested is the public Browse scope (https://api.ebay.com/oauth/api_scope) — no user-context scopes, no sell.* scopes, no commerce.* scopes, no fulfillment scopes. Tokens are short-lived (2-hour TTL) and held in process memory only.",
  },
  {
    title: "Browse-call telemetry — operational metadata only, no listing payload.",
    body: "Foil maintains an internal telemetry table that records when Browse calls happened, which surface initiated each (page render vs alert cron), whether the call succeeded, and how long it took. The schema has exactly five columns: id, called_at, surface, success, latency_ms. There are no columns for titles, prices, item URLs, card slugs, sellers, or any other listing-payload field. The telemetry API signature has no parameter that could pass listing data through.",
  },
  {
    title: "EPN affiliate attribution — every outbound eBay click stamped with campaign + custom id.",
    body: "Every outbound eBay link Foil generates carries the documented EPN tracking parameters (mkevt, mkcid, mkrid, toolid) plus Foil's campaign ID and a custom-id identifying the originating surface (foil-card-page for the per-card page, foil-wishlist-alert for the alert cron). Affiliate URL construction is centralized in a single module; a structural test fails the build if any other code path constructs these parameters directly.",
  },
  {
    title: "Browse API rate limits — default 5,000 calls/day, must not exceed quota.",
    body: "The hourly wishlist alert cron caps itself at 200 Browse calls per run (200 × 24 = 4,800 per day, leaving 200 headroom for live page renders). A daily Discord summary surfaces 'approaching daily ceiling' when 24-hour usage crosses 80% of 5,000. Foil's Application Growth Check application is pending to lift the cap once organic traffic justifies it.",
  },
  {
    title: "Marketplace ID required on Buy API calls.",
    body: "Every Browse API call carries the X-EBAY-C-MARKETPLACE-ID: EBAY_US header. Foil serves the US marketplace exclusively at launch; the header is hard-coded rather than parameterized so a typo can't silently route requests to the wrong marketplace.",
  },
  {
    title: "Credentials must not be logged or surfaced to clients.",
    body: "OAuth credentials (App ID and Cert ID) are server-side environment variables. They are never logged, never returned in any response body, and never embedded in any client-side bundle. The OAuth access token itself is held in module-level memory only and never logged. The Browse module is server-only — it cannot be imported from any client component without a build error.",
  },
  {
    title: "No fallback to scraping eBay search HTML.",
    body: "Foil's only server-side connection to eBay is the official Browse API. The fallback CTA shown when the Browse response is empty is a navigable browser-facing eBay search URL (sponsored via EPN affiliate parameters) — but it is a link the visitor's browser follows, not a server-side fetch. The 2025 License Agreement's prohibition on automated HTML scraping is honored architecturally: Foil constructs no fetch call to www.ebay.com from server-side code.",
  },
  {
    title: "2025 License Agreement — `/deals` leaderboard precompute persists DERIVED metadata only, never an eBay listing payload.",
    body: "Foil's 'Today's best deals' leaderboard is precomputed once a day by a background job that fetches each card's live eBay listing through the same official Browse API (cache: 'no-store'), classifies how its price compares to the card's recent sold prices, and then discards the listing. The cache that feeds the public board stores only Foil's derived signal (a below/at/above classification and the percentage), the recent sold reference from a separate pricing source, and basic catalog fields (card name, set, image) — never an eBay item ID, listing title, seller, listing URL, or raw asking price. The board makes no eBay call when a visitor loads it; the live listing resolves only when the visitor clicks through to an affiliate-tracked eBay search.",
  },
];

// ---------------------------------------------------------------------------
// Page narrative — sections a (purpose) + b (architecture summary). The
// drift test pins these reviewer-key phrases must appear: "Marketplace
// Account Deletion", "no-store", "force-dynamic", "client_credentials".
// ---------------------------------------------------------------------------

export const PAGE_TITLE = "eBay API Compliance — Foil";

export const PAGE_INTRO = "This page documents how Foil complies with eBay's 2025 License Agreement, Buy APIs program terms, Marketplace Account Deletion compliance, and the eBay Partner Network agreement. It is the public mirror of Foil's internal compliance documentation. Every requirement listed below is enforced by code that is structurally tested in continuous integration — a regression on any one of these requirements fails the build before it can reach production.";

export const ARCHITECTURE_PARAGRAPHS: readonly string[] = [
  "Foil's eBay integration follows a deliberately narrow architecture. Server-side code calls the Browse API at request time, reads the response, renders the page, and discards the response. There is no caching layer, no listing database, no AI training pipeline that touches eBay data.",
  "Every Browse fetch uses cache: 'no-store' and the consuming Next.js page is configured force-dynamic. Authentication is OAuth's client_credentials grant scoped to the public Browse application scope only — no user-context scopes are requested. Every outbound visitor-facing eBay link is wrapped with the documented EPN affiliate tracking parameters via a single source-of-truth function.",
  "From the listings the Browse API returns, Foil's per-card page surfaces the cheapest credible listing — a pure-function picker filters out keyword-stuffed multi-card lots, damaged-condition titles, and statistical-outlier prices before selecting the lowest-priced survivor. When every returned listing fails curation, the page falls back to a sponsored search-results link rather than recommending a misleading listing.",
  "Marketplace Account Deletion notifications are received at a public webhook (https://foiltcg.com/api/webhooks/ebay-marketplace-deletion). The handler verifies eBay's signature, acknowledges with HTTP 200, and discards the payload. Foil persists no eBay user data of any kind.",
];

export const CONTACT_FOOTER = "Questions? Contact john.c.craig24@gmail.com.";

/** Page-only reference to the broader privacy policy. Rendered on the
 *  reviewer-facing public page (`/legal/ebay-api-compliance`) but NOT
 *  on the compliance PDF — the PDF is single-A4-page-budgeted and this
 *  cross-link doesn't add value for the eBay reviewer use case. */
export const PRIVACY_CROSS_LINK = "For Foil's general privacy practices (data collected, what we never do with it, how to unsubscribe), see /legal/privacy.";
