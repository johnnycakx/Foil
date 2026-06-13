// Service-area city data (vending pivot — docs/vending Goal A + doc 04 §1).
//
// These power /service-areas/[city]. The hard rule from doc 04 §1: each city
// page must be GENUINELY UNIQUE, not one template with the city name swapped
// (Google penalizes doorway pages). So every entry below carries its own
// local venue landscape, its own angle, and its own city-specific FAQ written
// against that city's real geography. The geography referenced here is public
// fact (malls, corridors, downtowns); NONE of it claims Foil has a machine in
// that city yet (no machine is placed — Gate 13 honesty). The pages pitch the
// city's business owners on HOSTING, in the established present-tense operator
// voice (doc 01 positioning), which is a legitimate "we operate across the Bay
// Area" framing, not a fabricated placement claim.
//
// Pure data module — no Next imports — so the hub/sitemap can read it under
// the bare node test runner the same way sitemap-landings.ts is read.

export type CityFaq = { question: string; answer: string };

export type ServiceCity = {
  /** URL segment under /service-areas/. */
  slug: string;
  /** Display name. */
  name: string;
  /** County (used in copy + areaServed context). */
  county: string;
  /** One-line lead under the H1. */
  lead: string;
  /** 2–3 paragraphs of genuinely city-specific body copy. */
  paragraphs: readonly string[];
  /** City-specific FAQ (feeds the page FAQ + FAQPage JSON-LD). */
  faqs: readonly CityFaq[];
  /** Neighboring city slugs to cross-link (local-SEO internal linking). */
  nearby: readonly string[];
};

// Tier-1 home-radius cities (doc 01 → Service area). Order is the hub +
// sitemap order. Start with these 8; expand into Tier 2 as real placements
// give local proof to add (doc 04: quality over volume).
export const SERVICE_CITIES: readonly ServiceCity[] = [
  {
    slug: "napa",
    name: "Napa",
    county: "Napa County",
    lead: "A Pokémon card vending machine for your Napa business, fully run by us.",
    paragraphs: [
      "Napa runs on foot traffic that other towns would envy: First Street and the downtown core move a steady mix of locals and visitors past tasting rooms, the Oxbow market, restaurants, and the shops along Main. That browse-and-wait rhythm is exactly where an impulse buy lands, and a Pokémon card machine reads as an experience rather than a vending box.",
      "We place and operate the machine end to end for Napa hosts: we deliver it, stock it with sealed packs, restock it on a schedule built around your hours, and handle every customer question through the on-machine support code. You provide about three square feet and a standard outlet. Convenience stores and gas stations along Soscol Avenue, downtown retail, and barbershops all fit the profile.",
      "Pokémon is not a kids' product anymore. Around 60% of buyers are adults, many of them the visitors and locals already spending in Napa, and a sealed pack with a shot at a valuable pull is an easy add to a day downtown.",
    ],
    faqs: [
      {
        question: "Where in Napa does a card machine make sense?",
        answer:
          "Anywhere with steady browse-or-wait foot traffic: downtown and First Street retail, the Soscol Avenue convenience and gas corridor, barbershops, and family entertainment spots. We help you pick the spot and size the machine to it.",
      },
      {
        question: "Does the tourist season matter for a Napa placement?",
        answer:
          "Visitor traffic helps, but Napa's local collector base spends year-round, and new Pokémon set releases drive their own bumps regardless of season. We adjust the product mix to what your specific location responds to.",
      },
    ],
    nearby: ["american-canyon", "vallejo", "fairfield"],
  },
  {
    slug: "fairfield",
    name: "Fairfield",
    county: "Solano County",
    lead: "Hands-off Pokémon card vending for Fairfield businesses, with a monthly revenue share.",
    paragraphs: [
      "Fairfield sits on the I-80 midpoint between the Bay and Sacramento, which makes it a natural stop: the Solano Town Center, the travel plazas and gas stations along the freeway, and the restaurants and shops that catch both commuters and locals. High through-traffic with a few minutes of dwell time is the ideal home for a card machine.",
      "We handle everything operationally. Foil delivers, mounts, and stocks the machine, restocks it on a 7-to-14-day cadence, processes the cashless payments, and resolves any customer issue through the QR support code on the machine itself. Your staff never touches it. You give us roughly three square feet and a 120V outlet.",
      "With a large nearby military and family population, Fairfield's buyer base spans every age. The machine is positioned as an amenity for the customers already in your space, not a primary income line, and you earn a share of every sale.",
    ],
    faqs: [
      {
        question: "Is a freeway-adjacent Fairfield location good for this?",
        answer:
          "Yes. Gas stations and convenience stores along the I-80 corridor see exactly the high-volume, short-dwell traffic that drives impulse pack sales, and the cashless machine needs no staff involvement to run.",
      },
      {
        question: "What does it cost a Fairfield host?",
        answer:
          "Nothing. There is no purchase, lease, or fee. The machine draws about as much power as a TV (roughly $4 a month). You receive a 10–15% revenue share of gross sales, paid monthly.",
      },
    ],
    nearby: ["suisun-city", "vacaville", "benicia"],
  },
  {
    slug: "vacaville",
    name: "Vacaville",
    county: "Solano County",
    lead: "A Pokémon card machine for your Vacaville business: we stock it, you earn from it.",
    paragraphs: [
      "Vacaville pulls regional shoppers to the Premium Outlets and the Nut Tree area, and that destination retail traffic, plus the family entertainment and arcades nearby, is a strong match for a card machine. People who are already out browsing and waiting are the people who buy a pack on impulse.",
      "Foil owns and operates the machine for Vacaville hosts. We size it to your space, install it in about an hour without disrupting your day, keep it stocked with a rotating mix of sealed packs, and handle refunds and support directly so your team is never pulled in. All you supply is the space and the outlet.",
      "The machine is cashless and monitored in real time, with a guaranteed-drop refund sensor, so a customer who pays always gets product or an automatic refund. That reliability is what keeps a Vacaville placement low-touch for you and trustworthy for your customers.",
    ],
    faqs: [
      {
        question: "Do arcades and family entertainment venues in Vacaville fit?",
        answer:
          "They are among the best fits. Those venues already draw the collector and family crowd, customers linger, and a card machine complements the experience instead of competing with food or games.",
      },
      {
        question: "How often will you restock a Vacaville machine?",
        answer:
          "Typically every 7 to 14 days, scheduled around your hours. Card machines need far less attention than snack machines because cards don't expire and a single machine holds a lot of product.",
      },
    ],
    nearby: ["fairfield", "suisun-city"],
  },
  {
    slug: "vallejo",
    name: "Vallejo",
    county: "Solano County",
    lead: "Free, fully-managed Pokémon card vending for Vallejo businesses.",
    paragraphs: [
      "Vallejo combines waterfront and ferry traffic, the Georgia Street downtown, and the steady neighborhood flow of its convenience stores, smoke shops, and barbershops. It's a working city with real daily foot traffic, and that's what a card machine needs far more than a fancy address.",
      "We place and run the machine for Vallejo hosts at no cost to you: delivery, install, stocking, restocking, payments, and customer support are all on us. You provide about three square feet and a standard outlet, and you collect a monthly revenue share. There's no contract required to start, just a risk-free trial.",
      "If a placement isn't pulling the numbers we'd expect, we first adjust the product mix to your customers, and if it still isn't a fit we relocate the machine at no cost or hassle to you. The downside for a Vallejo host is genuinely close to zero.",
    ],
    faqs: [
      {
        question: "I run a smoke shop in Vallejo. Is this a fit?",
        answer:
          "Smoke and vape shops are one of the strongest fits. They have steady adult foot traffic and impulse-purchase behavior, and a sealed-card machine is a completely different category from your existing products, so it adds rather than competes.",
      },
      {
        question: "Do I have to sign a contract to host in Vallejo?",
        answer:
          "No. Most placements run on a handshake and a no-commitment trial month. If you'd prefer something in writing, we provide a simple placement agreement.",
      },
    ],
    nearby: ["benicia", "american-canyon", "napa"],
  },
  {
    slug: "walnut-creek",
    name: "Walnut Creek",
    county: "Contra Costa County",
    lead: "An upscale, low-footprint Pokémon card machine for Walnut Creek businesses.",
    paragraphs: [
      "Walnut Creek's downtown around Broadway Plaza and North Main is one of the East Bay's busiest shopping and dining districts, with BART feeding a constant flow of browsers, diners, and weekend crowds. A sleek, jukebox-sized card machine fits that polished retail environment without looking like a clunky snack machine.",
      "Foil handles the entire operation for Walnut Creek hosts. We deliver and mount the machine (wall, pedestal, or freestanding, no drilling required for the freestanding option), keep it stocked, run the cashless payments, and field every customer issue ourselves. Your bars, restaurants, and shops get an amenity, not a chore.",
      "Around 60% of Pokémon buyers are adults 25 to 40 with disposable income, a demographic Walnut Creek has in abundance. The machine draws that collector traffic and gives your regulars one more reason to linger, while you earn a share of every sale.",
    ],
    faqs: [
      {
        question: "Will the machine look out of place in an upscale Walnut Creek storefront?",
        answer:
          "No. The machine is about the size of a jukebox with a clean touchscreen, and it can be wall-mounted, on a pedestal, or freestanding. We'll show you exactly how it looks in your space before anything is installed.",
      },
      {
        question: "Do Walnut Creek bars and restaurants make good hosts?",
        answer:
          "Yes. Spots where people wait, linger, or socialize convert impulse purchases well, and the machine runs entirely on its own so it never adds work for your staff.",
      },
    ],
    nearby: ["concord", "pleasant-hill"],
  },
  {
    slug: "concord",
    name: "Concord",
    county: "Contra Costa County",
    lead: "A fully-managed Pokémon card vending machine for your Concord business.",
    paragraphs: [
      "Concord moves a lot of people: Todos Santos Plaza and the downtown around it, the Sunvalley shopping center, and the Monument corridor's dense retail all see steady daily traffic. Bowling alleys, barbershops, convenience stores, and family entertainment venues across the city are exactly the high-flow, few-spare-feet spaces a card machine is built for.",
      "We do the work and carry the cost. Foil delivers, installs, stocks, and services the machine, processes the cashless transactions, and handles refunds and support through the on-machine code. You provide roughly three square feet and a standard outlet, and receive a monthly revenue share of gross sales.",
      "Because cards don't expire and the machine holds a large amount of product, a Concord placement needs restocking only every week or two, not several times a week like a snack machine. It's genuinely passive on your end.",
    ],
    faqs: [
      {
        question: "I already have a snack or drink machine. Does this compete?",
        answer:
          "Not at all. A sealed trading-card machine is a completely different category, so it complements what you already have rather than competing with it, and it tends to draw a different, higher-spend customer.",
      },
      {
        question: "What kinds of Concord venues do best?",
        answer:
          "Bowling alleys and entertainment centers, barbershops, convenience stores, and comic or hobby shops all do well, anywhere with consistent foot traffic and a little dwell time.",
      },
    ],
    nearby: ["walnut-creek", "pleasant-hill", "martinez"],
  },
  {
    slug: "benicia",
    name: "Benicia",
    county: "Solano County",
    lead: "Hands-off Pokémon card vending for Benicia's downtown and beyond.",
    paragraphs: [
      "Benicia's historic First Street downtown and the marina draw a loyal local crowd plus weekend visitors, and the city's tight-knit small-business scene is exactly where a distinctive amenity stands out. A Pokémon card machine gives a First Street shop, café, or barbershop something the next town doesn't have.",
      "Foil runs the whole thing for Benicia hosts. We deliver and set up the machine, keep it stocked with sealed packs, handle the cashless payments and every customer issue, and restock on a schedule that fits your hours. You contribute the space and the outlet, nothing else, and earn a monthly share.",
      "The footprint is small and the install is quick (about an hour), with no disruption to your day and no drilling required if you choose the freestanding option. For a smaller Benicia storefront, that low-commitment, low-footprint profile is the whole point.",
    ],
    faqs: [
      {
        question: "Is Benicia's smaller foot traffic enough for a machine?",
        answer:
          "Often, yes: a loyal repeat local base and a distinctive product can outperform a busier but indifferent location. We start with a risk-free trial, and if a spot isn't a fit we simply relocate the machine at no cost to you.",
      },
      {
        question: "Can the machine go in a historic First Street building without drilling?",
        answer:
          "Yes. The freestanding and pedestal options need no drilling at all, so the machine works in a historic or leased space without any modification to the building.",
      },
    ],
    nearby: ["vallejo", "fairfield"],
  },
  {
    slug: "suisun-city",
    name: "Suisun City",
    county: "Solano County",
    lead: "A no-cost, fully-serviced Pokémon card machine for Suisun City businesses.",
    paragraphs: [
      "Suisun City's Waterfront District, the Harbor Theatre area, and the train-depot corridor anchor a walkable downtown with steady community foot traffic. A card machine in a waterfront café, a barbershop, or a convenience store fits naturally into that come-and-stay rhythm.",
      "We own and operate the machine for Suisun City hosts at zero cost: install, stocking, restocking, cashless payments, refunds, and support are all handled by Foil. You provide about three square feet and a standard outlet. There's no fee, no lease, and no work on your end, just a monthly revenue share.",
      "Adjacent to Fairfield and the I-80 corridor, Suisun City sits squarely in our home service radius, which means fast restocks and quick response if anything ever needs attention. Proximity is part of why the nearest cities get our first and best service.",
    ],
    faqs: [
      {
        question: "Does being next to Fairfield help a Suisun City placement?",
        answer:
          "Yes. Suisun City is in our core service radius, so restocks are frequent and any issue gets a fast response. Nearby locations are the easiest for us to keep running smoothly.",
      },
      {
        question: "What does a Suisun City host actually have to do?",
        answer:
          "Provide the space and an outlet. That's the whole list. We handle licensing, install, stocking, payments, refunds, and customer support; your staff never touches the machine.",
      },
    ],
    nearby: ["fairfield", "vacaville"],
  },
];

/** Display names keyed by slug — used in nearby-city cross-links so a slug
 *  that isn't a published page (e.g. a Tier-2 neighbor) still renders a
 *  human label. */
export const CITY_NAMES: Record<string, string> = {
  ...Object.fromEntries(SERVICE_CITIES.map((c) => [c.slug, c.name])),
  // Tier-2 / adjacent labels referenced by `nearby` but not yet published.
  "american-canyon": "American Canyon",
  "pleasant-hill": "Pleasant Hill",
  martinez: "Martinez",
};

export function getCity(slug: string): ServiceCity | undefined {
  return SERVICE_CITIES.find((c) => c.slug === slug);
}

/** All published city slugs (for generateStaticParams + the sitemap). */
export const CITY_SLUGS: readonly string[] = SERVICE_CITIES.map((c) => c.slug);

/** Names of every city we serve, for areaServed schema + hub copy. */
export const SERVED_CITY_NAMES: readonly string[] = SERVICE_CITIES.map((c) => c.name);
