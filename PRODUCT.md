# Product

## Register

brand

The V1 surface is buyer-side and mostly free: per-card landing pages, best-deal
recommendations, the content blog, SEO pillar pages, and the newsletter. On these
surfaces design IS the product, it carries trust and drives the affiliate click,
so brand is the default register. Gated app surfaces (`/upload`, `/account`,
wishlist) override to the **product** register per-task, where design serves a
workflow rather than selling one.

## Users

An active Pokémon TCG collector who already knows the specific card they want and
does not want to scrub eBay for the best live listing themselves. They arrive from
search or the newsletter, often on a phone while scrolling a marketplace, wanting a
fast, trustworthy answer to "what's the best price on this card right now, and tell
me when it drops." Secondary user: the power-buyer who wants alerts and
multi-marketplace coverage (a V2 Pro audience). Founder John Craig is a Level 4
TCGplayer seller, so the audience skews toward people who take the hobby seriously.

## Product Purpose

Foil finds a collector the best live deal on a specific Pokémon card across the
major marketplaces (eBay first, TCGplayer affiliate planned), presents it on a
per-card landing page with an affiliate-tracked CTA, and lets them set a wishlist
email alert for a target price. Revenue is primarily affiliate; the product is
mostly free by design. Success looks like: a collector lands on a card page, trusts
the recommendation enough to click through, and subscribes to an alert. Day-90
target is $1.5K MRR; the early growth engine is SEO content + the best-deals
newsletter.

## Brand Personality

**Trusted collector concierge.** Three words: confident, knowledgeable, calm. The
voice is a sharp dealer who already did the scrubbing for you, never a hype machine.
Gold is a premium signal used sparingly, not a flashy decoration. The interface
should evoke trust and quiet expertise, the relief of "someone reliable already
checked this," not urgency or FOMO. Warmth comes from the cream surface and the
hobby itself, restraint comes from the navy and the disciplined use of gold.

## Anti-references

This should NOT look like any of:

- **Generic AI SaaS template.** No gradient-text heroes, no identical icon-card
  grids, no big-number hero-metric cliché. This is the aesthetic ADR-028 / ADR-029
  / ADR-032 / ADR-033 have actively de-risked; do not regress toward it.
- **Loud crypto / hype marketplace.** No neon-on-dark, no countdown-timer urgency,
  no aggressive "DEALS!" energy. It cheapens the collectible niche.
- **Sterile enterprise dashboard.** No cold gray, no warmth-free dense data tables.
  Wrong register for a hobby-collector audience.
- **Bargain-bin coupon site.** No RetailMeNot / Honey clutter, no ad-heavy,
  discount-screaming, low-trust visual noise. Foil curates; it does not shout.

## Design Principles

1. **Earned trust over persuasion.** Show the real listing, the real price, the
   confidence behind it. Transparency (per-card + overall confidence, "manual review
   needed" over fake certainty) is the brand. Never fabricate, never oversell.
2. **Speed beats completeness.** Show the partial best answer fast rather than
   waiting for a perfect one. A collector mid-scroll will not wait.
3. **Mobile-first, always.** The primary moment is a phone in hand. Layout, touch
   targets, and reading length are designed for that first, desktop second.
4. **Restraint is the premium signal.** Gold and coral are scarce on purpose. The
   collectible niche reads as expensive through discipline, not decoration.
5. **Graceful degradation.** Missing data, an unidentified card, an API outage,
   none of these become an error wall. They degrade to an honest, calm fallback.

## Accessibility & Inclusion

- **WCAG 2.1 AA** contrast on all text and interactive elements; verify gold and
  coral against cream before using them for anything load-bearing (small text,
  borders that must read).
- **Honor `prefers-reduced-motion`** on every animation and scroll-triggered
  reveal (tracked as an ADR-029 followup).
- **Mobile-first touch targets** sized for thumb use as the primary input.
