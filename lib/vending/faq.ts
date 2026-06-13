// Host-facing FAQ (vending pivot — copy source: docs/vending/01-HOST-LOCATION-OFFER.md).
//
// Single source of truth for: the /faq page, the homepage FAQ teaser, and the
// FAQPage JSON-LD on both. Answers are truthful and host-framed.
//
// HONESTY (Goal A guardrails + strategy §5b): the operator liability-insurance
// claim is NOT yet confirmed (founder-manual: get the $1M/occurrence policy
// before the first placement). So the licensing/insurance answer carries a
// visible [PLACEHOLDER] rather than asserting "fully insured" — an unconfirmed
// fact ships marked, never invented. John fills it in Goal B once the policy
// exists. No income projections, no "passive income" vocabulary, no deal
// vocabulary (these surfaces never borrow the deal-finder's trust words).

export type HostFaq = { question: string; answer: string };

export const HOST_FAQS: readonly HostFaq[] = [
  {
    question: "What does the machine sell?",
    answer:
      "Sealed Pokémon trading-card packs — a rotating mix of mid-tier and premium packs (roughly $18 to $100). We adjust the selection based on what's trending and what your customers respond to.",
  },
  {
    question: "How big is it, and will it fit?",
    answer:
      "About the size of a jukebox — roughly 3 by 2 feet, extending about a foot off the wall. We also offer a freestanding tower. It needs only 3 to 4 square feet of wall or floor space, and we can show you exactly how it looks in your space before anything is installed.",
  },
  {
    question: "What do I have to provide?",
    answer:
      "Just the space (about 3 to 4 square feet), a standard power outlet, and wifi. We handle everything else.",
  },
  {
    question: "What does it cost me?",
    answer:
      "Nothing. There's no purchase, lease, or fee. The machine draws about as much power as a TV (around $4 a month).",
  },
  {
    question: "How do I get paid?",
    answer:
      "A monthly revenue share — 10 to 15% of gross sales — paid by your preferred method: direct deposit, ACH, check, Zelle, Venmo, or Cash App. You also get sales analytics so you can see exactly what's selling.",
  },
  {
    question: "Do I need any licenses or insurance?",
    answer:
      "You don't need to obtain any licenses or carry any insurance of your own to host the machine — it's our equipment and our responsibility to run, including the business licensing and sales-tax compliance for operating it. [PLACEHOLDER: John to confirm operator liability coverage before we publish that the machine itself is fully insured.]",
  },
  {
    question: "Am I liable if it's damaged or broken into?",
    answer:
      "The machine is our property, so operating it and keeping it running is on us, not on you. [PLACEHOLDER: John to confirm the operator liability/property coverage before we state that damage, theft, or malfunction is fully covered on our end.]",
  },
  {
    question: "Does it have to be drilled into the wall?",
    answer:
      "Not at all. Wall-mount, pedestal, or freestanding — whatever works best for your space. The freestanding option needs no drilling.",
  },
  {
    question: "What if a customer pays and nothing comes out?",
    answer:
      "The machine has a guaranteed-drop system with a refund sensor. If product doesn't drop, the customer is refunded automatically and the screen confirms it. Every machine also has a support code so customers report any issue directly to us — your staff never handles refunds or complaints.",
  },
  {
    question: "Do I have to sign a contract?",
    answer:
      "No. Most of our placements run on a handshake and a risk-free trial month. If you'd prefer something in writing, we're happy to provide a simple placement agreement.",
  },
  {
    question: "What if it doesn't perform in my location?",
    answer:
      "If it's not pulling the numbers we'd expect, we first try adjusting the product mix to your customers. If it still isn't a fit, we pull it and relocate it — no cost or hassle to you.",
  },
  {
    question: "I don't really get kids in here.",
    answer:
      "Pokémon isn't a kids' product anymore. Around 60% of buyers are adults 25 to 40 — collectors and resellers with real money to spend. A pack with a shot at pulling a far more valuable card is an easy impulse buy for that crowd.",
  },
  {
    question: "I already have a vending machine.",
    answer:
      "Ours is a completely different category — sealed trading cards, not snacks or drinks — so it complements what you already have rather than competing with it.",
  },
];

/** Short subset for the homepage FAQ teaser (full set lives on /faq). */
export const HOST_FAQ_TEASER: readonly HostFaq[] = HOST_FAQS.filter((f) =>
  [
    "What does it cost me?",
    "What do I have to provide?",
    "How do I get paid?",
    "Do I have to sign a contract?",
  ].includes(f.question),
);
