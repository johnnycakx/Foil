// Shared content for /legal/privacy and /legal/terms (Task #18 / Session 37).
//
// Two single-page documents, plain-language. Both render via the (site)
// route group so the brand chrome (sticky orange-dot nav, footer) wraps
// them automatically. The content lives here so the pages can be Server
// Components with zero data fetching, and so this becomes the source-of-
// truth a future "consent log" feature could reference.
//
// What this doc covers (Privacy):
//   - What we collect: email + watchlist preferences only.
//   - What we use it for: alerts you opted in to + newsletter (if opted in).
//   - What we don't do: sell/share the list; persist eBay listing data;
//     train AI on what you searched.
//   - Unsubscribe + deletion paths.
//
// What this doc covers (ToS):
//   - FTC affiliate disclosure — Foil earns affiliate commissions on
//     eBay clicks via the eBay Partner Network. Disclosed up front.
//   - Service is as-is. Listings come from a third party (eBay); we
//     surface them, we don't warrant them.
//   - User responsibilities (don't abuse the watchlist form, don't
//     scrape the site).
//
// Both docs intentionally avoid lawyer-ish framing — plain English is
// easier to comply with and matches Foil's voice. They are NOT a
// substitute for legal review; the founder will get formal review
// before any incorporation or expansion that increases liability surface.

export type PolicySection = {
  heading: string;
  body: string;
};

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

export const PRIVACY_TITLE = "Privacy Policy";

export const PRIVACY_LAST_UPDATED = "2026-05-25";

export const PRIVACY_INTRO =
  "Foil is built around watching Pokémon TCG card prices and emailing you when one drops to your target. This policy explains in plain language what data we collect to do that, what we never do with it, and how to remove yourself from the list whenever you want. If anything below is unclear, email john.c.craig24@gmail.com — Foil is a solo project and the answer comes from a human.";

export const PRIVACY_SECTIONS: readonly PolicySection[] = [
  {
    heading: "What we collect",
    body: "Two things, both supplied by you: your email address, and the cards plus target prices you ask us to watch. Nothing else. We do not collect device fingerprints, behavioural-analytics events, advertising identifiers, or anything you didn't explicitly type into a form. Visiting a page does not by itself put you on any list.",
  },
  {
    heading: "What we use it for",
    body: "Your email is used only for the things you opted into: (a) wishlist alerts when one of your watched cards drops to your target price, and (b) Foil's weekly deals newsletter if the opt-in checkbox was ticked when you joined. That's the complete list. We do not use your email for product cross-sells, account recovery for a service you didn't sign up for, or any kind of profiling.",
  },
  {
    heading: "What we never do",
    body: "We never sell, rent, share, or transfer your email or watchlist data to any third party. We do not use your email or your watch history to train AI models or fine-tune content-generation pipelines. We do not store or cache the eBay listing data that surfaces on per-card pages — every listing block is re-fetched live at the moment a page loads and discarded immediately after rendering (this is structurally required by our eBay license; see the public eBay API compliance page).",
  },
  {
    heading: "Where the data lives",
    body: "Watchlists live in a Supabase Postgres database, accessible only by Foil's service-role credentials. Newsletter subscriptions are stored by Beehiiv (our newsletter platform), which has its own privacy policy. Email is delivered via Resend (transactional alerts) and Beehiiv (newsletter). These three vendors are necessary subprocessors of Foil. We do not use any third-party analytics, advertising, or tracking vendors on the public site.",
  },
  {
    heading: "Unsubscribing + deleting your data",
    body: "Every email we send carries a one-click unsubscribe link in the email headers (so Gmail, Apple Mail, and other clients can offer a button) AND a visible unsubscribe link in the body. Clicking either removes you from the list immediately. If you want a full data deletion (watchlists too), email john.c.craig24@gmail.com from the address on file and we will remove every row associated with your email within seven days. There is no form for this because Foil is solo-operated and an email request is the lowest-friction path.",
  },
  {
    heading: "Cookies",
    body: "Foil uses cookies only for the authenticated parts of the site (which V1 visitors never reach — V1 is anonymous-friendly for the public pages). Public pages set no first-party cookies and no third-party cookies. There are no advertising trackers and no analytics-vendor pixels.",
  },
  {
    heading: "Children",
    body: "Foil is not designed for children under 13 and we do not knowingly collect data from anyone under 13. If you believe a child has subscribed, email john.c.craig24@gmail.com and we will remove the row.",
  },
  {
    heading: "Changes to this policy",
    body: `If this policy changes materially, the "Last updated" date at the top will move and we will note the change in Foil's next newsletter. Substantive changes (new data collected, new sharing relationships) will be opt-in rather than opt-out. This policy was last updated ${PRIVACY_LAST_UPDATED}.`,
  },
];

// ---------------------------------------------------------------------------
// Terms of Service
// ---------------------------------------------------------------------------

export const TERMS_TITLE = "Terms of Service";

export const TERMS_LAST_UPDATED = "2026-05-25";

export const TERMS_INTRO =
  "Foil is a Pokémon TCG deal-finder. We surface live eBay listings on per-card pages and email you when a watched card drops to your target price. By using Foil you agree to these terms. They're short and written in plain language; if anything is unclear, email john.c.craig24@gmail.com.";

export const TERMS_SECTIONS: readonly PolicySection[] = [
  {
    heading: "Affiliate disclosure (FTC)",
    body: "Foil is a participant in the eBay Partner Network. When you click an outbound eBay listing link on Foil and complete a purchase on eBay, Foil may earn an affiliate commission at no extra cost to you. Every outbound link on the site is affiliate-tagged. We never recommend a listing because it earns more commission — Foil's curation logic ranks listings by quality (filtering keyword-stuffed lots, damaged cards, and statistical outliers) and then by lowest credible price, with no signal from commission rate.",
  },
  {
    heading: "What Foil provides",
    body: "Foil provides live eBay listing surfaces and an email-alert system. Listings are fetched live from eBay's Browse API at the moment a page loads; the visible price, title, and image come directly from eBay's response. Foil's curation layer filters listings before recommending one — but we are surfacing third-party content, not authoring it.",
  },
  {
    heading: "As-is, no warranty on listing accuracy",
    body: "Listings come from a third party (eBay) and may contain errors, misclassifications, or pricing the seller does not actually honor at checkout. Foil's curation reduces the volume of obviously-bad listings (sleeves, lots, damaged cards) but cannot guarantee any individual listing's accuracy. You are responsible for verifying the listing, the seller's feedback, and the actual condition before buying. Foil is provided as-is, without warranty of merchantability or fitness for a particular purpose.",
  },
  {
    heading: "Acceptable use",
    body: "Don't use Foil to scrape the site, abuse the watchlist form (high-volume submissions, dictionary emails, etc.), or attempt to manipulate the alert system. Email is for alerts you opted into; bulk-subscribing addresses you don't own to receive Foil emails is a violation of US CAN-SPAM and we will remove and ban any source we detect doing it.",
  },
  {
    heading: "Eligibility + jurisdiction",
    body: "Foil is operated from the United States and is currently targeted at US-based collectors and buyers. The eBay listings surface specifically serves the EBAY_US marketplace. If you use Foil from outside the US, you do so at your own risk and you are responsible for compliance with any local consumer-protection laws.",
  },
  {
    heading: "Termination",
    body: "You can stop using Foil at any time — unsubscribe from emails via the link in any email, or email john.c.craig24@gmail.com to request full data deletion. Foil may suspend access to abusive sources without notice; this is a defensive measure against the watchlist-form abuse described above.",
  },
  {
    heading: "Changes to these terms",
    body: `If these terms change materially, the "Last updated" date at the top will move. Continued use of Foil after a material change constitutes acceptance of the new terms. These terms were last updated ${TERMS_LAST_UPDATED}.`,
  },
  {
    heading: "Contact",
    body: "Foil is a solo project run by John Craig. Email john.c.craig24@gmail.com for anything — terms questions, data deletion requests, bug reports, feedback.",
  },
];
