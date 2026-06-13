// Machine-pricing disclosure copy (STRATEGY-VENDING-2026-06-12, amended §4).
// Rendered as a section of /pricing-methodology and scanned by the
// vending-surfaces test (Gate 13 anti-hype + no-em-dash + required policy
// markers). Lives in lib/vending, NOT lib/buy-signal: vending copy stays out
// of the buy-signal module the same way vending data stays out of its logic.
//
// Voice contract: every sentence is literally true today or is an explicit
// policy statement made before the first machine is placed. No em dashes
// (Gate 12). This page is deliberately the one place the deal-finder and the
// machines are discussed together; the vending SURFACES (/machines, /host)
// never borrow the deal vocabulary, while THIS page may name both sides
// because the contrast is the disclosure.

import type { MethodologySection } from "../buy-signal/methodology-content.ts";

export const MACHINE_PRICING_HEADING = "How Foil machine prices are set";

export const MACHINE_PRICING_SECTIONS: MethodologySection[] = [
  {
    heading: "How Foil machine prices are set",
    body:
      "Foil is preparing to operate Pokemon card vending machines under the FoilTCG brand. No machine is placed yet. The pricing policy is published here first, before the first placement, so it is on the record rather than discovered later.",
  },
  {
    heading: "Machine product is convenience-priced above the market",
    body:
      "A sealed pack from a Foil machine will cost more than the best price you can find online, including the prices this site surfaces. That premium is the price of the machine being there: stocked, working, and in front of you. The two sides of Foil are different products. The deal-finder on this site exists to get you the lowest credible price and is free to use. The machine exists for the moment you want sealed product in your hands right now. We will never describe a machine price as a deal, because it is not one.",
  },
  {
    heading: "Machine inventory never influences what this site shows you",
    body:
      "The listings this site selects, the rankings on the deals board, and the buy signals are computed with no knowledge of what any Foil machine stocks, holds, or needs to sell. That separation is structural, not editorial: the code that selects and ranks listings has no access to machine inventory, and keeping it that way is a standing engineering rule with its own automated checks. If Foil machines are ever overstocked on a product, this site will not know and cannot care.",
  },
  {
    heading: "Per-customer purchase limits, printed on the machine",
    body:
      "Every Foil machine will carry a per-customer purchase limit, stated on the machine itself. Limits are how product stays available to the person who walks up rather than the person who empties the machine to relist it. The limit is part of the offer, not fine print.",
  },
  {
    heading: "The gap is shown at the machine, not hidden",
    body:
      "Each machine will link to this site's live price view for the products it stocks, so the difference between the machine price and the online market is visible at the point of sale, on our own screen. We would rather show you the premium and let you choose than have you discover it afterward. If the convenience is not worth it to you, the better online price is one scan away, and we are pointing at it ourselves.",
  },
];

/** Concatenated string for the test-side voice scan (mirrors methodologyText). */
export function machinePricingText(): string {
  return MACHINE_PRICING_SECTIONS.flatMap((s) => [s.heading, s.body]).join("\n\n");
}
