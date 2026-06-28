// Branded "Good buys this week" newsletter email (ADR-079). react-email template
// — compiles to email-safe table HTML that Gmail/Outlook/Apple Mail render. It
// renders the typed DigestModel (lib/newsletter/movers-digest.ts::buildDigestModel),
// never the landing-page React components (web flex/grid don't survive email).
//
// DESIGN: the soft-skill register (DESIGN.md / ADR-029) adapted to email's hard
// constraints. The HARD CONSTRAINT is Gmail PRIMARY placement — image-heavy,
// button-heavy "marketing template" layouts get sorted to Promotions, where opens
// crater. So this is BRANDED BUT RESTRAINED / TEXT-FORWARD: zero images (a text
// wordmark, not a banner), styled text links (not big colored buttons), cream
// surface + navy ink, gold rationed to the few "heating up" deltas (Scarce-Gold
// ≤10%), and NO coral at rest (Coral-Hover-Only). All CSS inline (email clients
// strip <head> styles); a system serif/sans stack approximates Fraunces/Geist
// (custom webfonts are unreliable in email — never depended on).

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import type { DigestCardModel, DigestModel } from "../lib/newsletter/movers-digest.ts";

// Brand tokens (DESIGN.md). No #000/#fff — navy is the ink, cream is the surface.
const NAVY = "#0f1e3a";
const CREAM = "#f8f5f0";
const SLATE = "#4a5568";
const GOLD = "#c9a24b";
const PANEL = "#fffdf8"; // a hair lighter than cream for the content card (still not pure white)
const NAVY_HAIRLINE = "#e3e0d9"; // navy/10 flattened onto cream (email can't do alpha borders reliably)
const NAVY_PILL_BG = "#eceae4"; // navy/6 flattened — the neutral "cooling" delta
const GOLD_PILL_BG = "#f4ecd8"; // gold/12 flattened — the scarce "heating" delta

// Fraunces → Georgia; Geist → system sans. Never depend on a webfont loading.
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

const RESEND_UNSUBSCRIBE = "{{{RESEND_UNSUBSCRIBE_URL}}}";
const CAN_SPAM = "Foil TCG, LLC, 2710 Southern Hills Ct, Fairfield, CA 94534";

function DeltaBadge({ card }: { card: DigestCardModel }) {
  const up = card.arrow === "up";
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: SANS,
        fontSize: "12px",
        fontWeight: 600,
        // Down (cooling, the bulk) = neutral navy; up (heating, the few) = scarce gold.
        color: up ? "#8a6d23" : NAVY,
        backgroundColor: up ? GOLD_PILL_BG : NAVY_PILL_BG,
        borderRadius: "999px",
        padding: "2px 9px",
        whiteSpace: "nowrap",
      }}
    >
      {up ? "↑" : "↓"} {Math.abs(card.momentumPct)}%
    </span>
  );
}

function figuresLine(card: DigestCardModel): string {
  if (card.avg7dUsd && card.avg30dUsd) {
    return `Near Mint averaged ${card.avg7dUsd} over 7 days vs ${card.avg30dUsd} over 30, across ${card.saleCount} recent sales.`;
  }
  return `Near Mint is ${card.moveWords} vs its 30-day average, across ${card.saleCount} recent sales.`;
}

function CoolingCard({ card }: { card: DigestCardModel }) {
  return (
    <Section style={{ padding: "14px 0", borderBottom: `1px solid ${NAVY_HAIRLINE}` }}>
      <Text style={{ margin: "0 0 4px", fontFamily: SANS, fontSize: "16px", lineHeight: "1.4", color: NAVY }}>
        <span style={{ fontWeight: 700 }}>{card.name}</span>{" "}
        <span style={{ color: SLATE, fontSize: "14px" }}>({card.set})</span>{" "}
        <DeltaBadge card={card} />
      </Text>
      <Text style={{ margin: "0 0 6px", fontFamily: SANS, fontSize: "14px", lineHeight: "1.5", color: SLATE }}>
        {figuresLine(card)}
      </Text>
      <Link
        href={card.browseUrl}
        style={{ fontFamily: SANS, fontSize: "14px", fontWeight: 600, color: NAVY, textDecoration: "underline", textDecorationColor: GOLD }}
      >
        Browse Near Mint {card.name} on eBay {"→"}
      </Link>
    </Section>
  );
}

function HeatingRow({ card }: { card: DigestCardModel }) {
  return (
    <Text style={{ margin: "0 0 10px", fontFamily: SANS, fontSize: "14px", lineHeight: "1.5", color: SLATE }}>
      <span style={{ fontWeight: 700, color: NAVY }}>{card.name}</span> ({card.set}){" "}
      <DeltaBadge card={card} />
      {card.avg7dUsd && card.avg30dUsd ? ` ${card.avg7dUsd} (7d) vs ${card.avg30dUsd} (30d), ${card.saleCount} sales. ` : ` ${card.saleCount} sales. `}
      <Link href={card.browseUrl} style={{ color: NAVY, fontWeight: 600, textDecoration: "underline", textDecorationColor: GOLD }}>
        Browse {"→"}
      </Link>
    </Text>
  );
}

export function MoversDigestEmail({ model }: { model: DigestModel }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{model.previewText}</Preview>
      <Body style={{ backgroundColor: CREAM, margin: 0, padding: "24px 0", fontFamily: SANS }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: PANEL, borderRadius: "12px", padding: "32px 28px" }}>
          {/* Header — text wordmark, no image (Primary-safe + degrades perfectly). */}
          <Section style={{ paddingBottom: "8px" }}>
            <Text style={{ margin: 0, fontFamily: SANS, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span style={{ color: NAVY }}>Foil</span>
              <span style={{ color: GOLD }}>TCG</span>
            </Text>
            {/* A single short gold hairline — the one scarce-gold structural accent up top. */}
            <div style={{ height: "2px", width: "40px", backgroundColor: GOLD, borderRadius: "2px", marginTop: "10px" }} />
          </Section>

          {/* Headline + intro */}
          <Heading as="h1" style={{ margin: "16px 0 4px", fontFamily: SERIF, fontSize: "26px", fontWeight: 600, lineHeight: "1.15", color: NAVY }}>
            Good buys this week
          </Heading>
          <Text style={{ margin: "0 0 18px", fontFamily: SANS, fontSize: "14px", lineHeight: "1.6", color: SLATE }}>
            Here is what the Pok{"é"}mon card market did this week, {model.dateLine}. These are cards whose Near Mint
            copies are trading below their own 30-day sold average, a candidate worth a look, not a guarantee. Every number is a
            real recent sold average.
          </Text>

          {/* Cooling off */}
          {model.down.length > 0 && (
            <Section>
              <Heading as="h2" style={{ margin: "8px 0 2px", fontFamily: SERIF, fontSize: "19px", fontWeight: 600, color: NAVY }}>
                Cooling off
              </Heading>
              <Text style={{ margin: "0 0 4px", fontFamily: SANS, fontSize: "12px", letterSpacing: "0.04em", textTransform: "uppercase", color: SLATE }}>
                Candidate buys
              </Text>
              {model.down.map((card) => (
                <CoolingCard key={`${card.name}-${card.set}`} card={card} />
              ))}
            </Section>
          )}

          {/* Heating up — the scarce-gold section */}
          {model.up.length > 0 && (
            <Section style={{ marginTop: "22px" }}>
              <Heading as="h2" style={{ margin: "0 0 2px", fontFamily: SERIF, fontSize: "19px", fontWeight: 600, color: NAVY }}>
                Heating up
              </Heading>
              <Text style={{ margin: "0 0 12px", fontFamily: SANS, fontSize: "13px", lineHeight: "1.5", color: SLATE }}>
                The other side of the same signal, cards trading above their 30-day average.
              </Text>
              {model.up.map((card) => (
                <HeatingRow key={`${card.name}-${card.set}`} card={card} />
              ))}
            </Section>
          )}

          {/* Lead-magnet CTA — lightly styled, not a loud button */}
          <Section style={{ marginTop: "20px", backgroundColor: CREAM, borderRadius: "8px", padding: "16px 18px" }}>
            <Text style={{ margin: 0, fontFamily: SANS, fontSize: "14px", lineHeight: "1.6", color: NAVY }}>
              Want the quick reference for pricing any card by condition? Grab the free{" "}
              <Link href={model.leadMagnetUrl} style={{ color: NAVY, fontWeight: 600, textDecoration: "underline", textDecorationColor: GOLD }}>
                Pok{"é"}mon Card Pricing Cheat Sheet {"→"}
              </Link>
              .
            </Text>
          </Section>

          {/* Affiliate disclosure */}
          <Text style={{ margin: "18px 0 0", fontFamily: SANS, fontSize: "12px", lineHeight: "1.5", color: SLATE }}>
            Browse links are eBay affiliate searches. Foil is free, and when you buy through a link eBay pays us a commission at
            no cost to you. We rank by the move, not the payout.
          </Text>

          <Hr style={{ border: "none", borderTop: `1px solid ${NAVY_HAIRLINE}`, margin: "20px 0 14px" }} />

          {/* Footer — muted, on-brand, with the CAN-SPAM address + native unsubscribe */}
          <Text style={{ margin: 0, fontFamily: SANS, fontSize: "12px", lineHeight: "1.6", color: SLATE }}>
            Built by John Craig.
            <br />
            {CAN_SPAM}. You are receiving this because you subscribed at foiltcg.com.{" "}
            <Link href={RESEND_UNSUBSCRIBE} style={{ color: SLATE, textDecoration: "underline" }}>
              Unsubscribe
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Render the branded digest email to an HTML string for the Resend broadcast. */
export async function renderMoversDigestEmail(model: DigestModel): Promise<string> {
  return render(<MoversDigestEmail model={model} />);
}

export default MoversDigestEmail;
