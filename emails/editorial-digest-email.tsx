// Branded "Foil Weekly" EDITORIAL newsletter email (NL-EDIT-SHIP, extends
// ADR-079/080). react-email template that renders the LLM-generated
// EditorialIssue (lib/newsletter/editorial-engine.ts) — the MOVE -> WHY -> CALL
// issue in John's voice — through the same branded, Primary-safe primitives the
// deterministic movers email uses. The deterministic emails/movers-digest-email.tsx
// stays as the SOFT-FALL render (lib/newsletter/digest-compose.ts).
//
// DESIGN — same hard constraint as ADR-079: Gmail PRIMARY placement. So even
// with the richer editorial structure it stays BRANDED BUT RESTRAINED /
// TEXT-FORWARD: zero images (text wordmark), styled text links (never big
// colored buttons), cream surface + navy ink, gold rationed (Scarce-Gold ≤10%:
// the wordmark, one top hairline, the heating badges, and the single "The Read"
// highlight). The new segment treatments (Big Move panel, Seller's Note callout,
// The Read highlight) are cream/navy panels with thin accents — no new images,
// no buttons, so they don't tip the email into Promotions.
//
// The LLM is told NOT to emit links ("the system adds the live eBay link per
// card automatically"); this template attaches one affiliate browse link per
// pick by mapping the pick's cardName back to the DigestModel card.

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
import type { CSSProperties } from "react";
import type { EditorialIssue, EditorialPick } from "../lib/newsletter/editorial-engine.ts";
import type { DigestCardModel, DigestModel } from "../lib/newsletter/movers-digest.ts";
import { editorialPreviewText, matchModelCard } from "../lib/newsletter/editorial-serialize.ts";

// Brand tokens (DESIGN.md). No #000/#fff — navy is the ink, cream is the surface.
const NAVY = "#0f1e3a";
const CREAM = "#f8f5f0";
const SLATE = "#4a5568";
const GOLD = "#c9a24b";
const GOLD_INK = "#8a6d23"; // readable gold for small text on a light tint
const PANEL = "#fffdf8"; // the content card (still not pure white)
const PANEL_2 = "#fbf8f1"; // a hair warmer — the Big Move / Seller's Note panels
const NAVY_HAIRLINE = "#e3e0d9";
const NAVY_PILL_BG = "#eceae4"; // navy/6 flattened — the neutral "cooling" delta
const GOLD_PILL_BG = "#f4ecd8"; // gold/12 flattened — the scarce "heating" delta + The Read

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, Helvetica, sans-serif";

const RESEND_UNSUBSCRIBE = "{{{RESEND_UNSUBSCRIBE_URL}}}";
const CAN_SPAM = "Foil TCG, LLC, 2710 Southern Hills Ct, Fairfield, CA 94534";

const EYEBROW: CSSProperties = {
  margin: "0 0 6px",
  fontFamily: SANS,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

function DeltaBadge({ card }: { card: DigestCardModel }) {
  const up = card.arrow === "up";
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: SANS,
        fontSize: "12px",
        fontWeight: 600,
        color: up ? GOLD_INK : NAVY,
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

/** One eBay browse link for a pick, mapped back to the model card. Renders
 *  nothing when the pick's card can't be matched (never fabricate a link). */
function BrowseLink({ card, label }: { card: DigestCardModel | null; label: string }) {
  if (!card) return null;
  return (
    <Link
      href={card.browseUrl}
      style={{ fontFamily: SANS, fontSize: "14px", fontWeight: 600, color: NAVY, textDecoration: "underline", textDecorationColor: GOLD }}
    >
      {label} {"→"}
    </Link>
  );
}

/** A cooling/heating pick: card name + set + delta, the verdict prose, the link. */
function PickRow({ pick, model, browseLabel }: { pick: EditorialPick; model: DigestModel; browseLabel: (name: string) => string }) {
  const card = matchModelCard(pick.cardName, model);
  return (
    <Section style={{ padding: "14px 0", borderBottom: `1px solid ${NAVY_HAIRLINE}` }}>
      <Text style={{ margin: "0 0 5px", fontFamily: SANS, fontSize: "16px", lineHeight: "1.4", color: NAVY }}>
        <span style={{ fontWeight: 700 }}>{pick.cardName}</span>
        {card ? <span style={{ color: SLATE, fontSize: "14px" }}>{" "}({card.set})</span> : null}{" "}
        {card ? <DeltaBadge card={card} /> : null}
      </Text>
      <Text style={{ margin: "0 0 6px", fontFamily: SANS, fontSize: "14px", lineHeight: "1.6", color: SLATE }}>
        {pick.body}
      </Text>
      <BrowseLink card={card} label={browseLabel(pick.cardName)} />
    </Section>
  );
}

export function EditorialDigestEmail({ issue, model }: { issue: EditorialIssue; model: DigestModel }) {
  const bigCard = matchModelCard(issue.bigMove.cardName, model);
  const preview = editorialPreviewText(issue);
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: CREAM, margin: 0, padding: "24px 0", fontFamily: SANS }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: PANEL, borderRadius: "12px", padding: "32px 28px" }}>
          {/* Masthead — text wordmark, no image (Primary-safe + degrades perfectly). */}
          <Section style={{ paddingBottom: "8px" }}>
            <Text style={{ margin: 0, fontFamily: SANS, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.01em" }}>
              <span style={{ color: NAVY }}>Foil</span>
              <span style={{ color: GOLD }}>TCG</span>
              <span style={{ color: SLATE, fontWeight: 600, fontSize: "14px" }}> {"·"} Foil Weekly</span>
            </Text>
            <div style={{ height: "2px", width: "40px", backgroundColor: GOLD, borderRadius: "2px", marginTop: "10px" }} />
          </Section>

          {/* The Open — the week's temperature, in voice. */}
          <Heading as="h1" style={{ margin: "16px 0 10px", fontFamily: SERIF, fontSize: "24px", fontWeight: 600, lineHeight: "1.18", color: NAVY }}>
            {issue.subject}
          </Heading>
          <Text style={{ margin: "0 0 4px", fontFamily: SANS, fontSize: "13px", color: SLATE }}>{model.dateLine}</Text>
          <Text style={{ margin: "0 0 18px", fontFamily: SANS, fontSize: "15px", lineHeight: "1.65", color: NAVY }}>
            {issue.open}
          </Text>

          {/* The Big Move — the featured, forwardable piece. Cream panel, navy hairline. */}
          <Section style={{ backgroundColor: PANEL_2, border: `1px solid ${NAVY_HAIRLINE}`, borderRadius: "10px", padding: "18px 18px 16px" }}>
            <Text style={{ ...EYEBROW, color: GOLD_INK }}>The Big Move</Text>
            <Text style={{ margin: "0 0 8px", fontFamily: SANS, fontSize: "17px", lineHeight: "1.35", color: NAVY }}>
              <span style={{ fontWeight: 700 }}>{issue.bigMove.cardName}</span>
              {bigCard ? <span style={{ color: SLATE, fontSize: "14px" }}>{" "}({bigCard.set})</span> : null}{" "}
              {bigCard ? <DeltaBadge card={bigCard} /> : null}
            </Text>
            <Text style={{ margin: "0 0 8px", fontFamily: SANS, fontSize: "15px", lineHeight: "1.7", color: NAVY }}>
              {issue.bigMove.body}
            </Text>
            <BrowseLink card={bigCard} label={`Browse Near Mint ${issue.bigMove.cardName} on eBay`} />
          </Section>

          {/* Cooling off — the buy-side verdicts. */}
          {issue.coolingPicks.length > 0 && (
            <Section style={{ marginTop: "22px" }}>
              <Heading as="h2" style={{ margin: "0 0 2px", fontFamily: SERIF, fontSize: "19px", fontWeight: 600, color: NAVY }}>
                Cooling off
              </Heading>
              <Text style={{ margin: "0 0 2px", ...EYEBROW, color: SLATE }}>Candidate buys</Text>
              {issue.coolingPicks.map((p) => (
                <PickRow key={`cool-${p.cardName}`} pick={p} model={model} browseLabel={(n) => `Browse Near Mint ${n} on eBay`} />
              ))}
            </Section>
          )}

          {/* Heating up — the don't-chase watch. */}
          {issue.heatingPicks.length > 0 && (
            <Section style={{ marginTop: "22px" }}>
              <Heading as="h2" style={{ margin: "0 0 2px", fontFamily: SERIF, fontSize: "19px", fontWeight: 600, color: NAVY }}>
                Heating up
              </Heading>
              <Text style={{ margin: "0 0 2px", ...EYEBROW, color: SLATE }}>Running hot. Chase or wait?</Text>
              {issue.heatingPicks.map((p) => (
                <PickRow key={`heat-${p.cardName}`} pick={p} model={model} browseLabel={(n) => `Browse ${n}`} />
              ))}
            </Section>
          )}

          {/* Seller's Note — the insider, sell-side observation. Cream panel, navy edge. */}
          {issue.sellersNote.trim() && (
            <Section style={{ marginTop: "24px", backgroundColor: PANEL_2, borderLeft: `3px solid ${NAVY}`, borderRadius: "0 8px 8px 0", padding: "14px 16px" }}>
              <Text style={{ ...EYEBROW, color: NAVY }}>Seller's Note</Text>
              <Text style={{ margin: 0, fontFamily: SANS, fontSize: "14px", lineHeight: "1.7", color: NAVY }}>
                {issue.sellersNote}
              </Text>
            </Section>
          )}

          {/* The Read — the one overall verdict + the $50 call. The scarce-gold highlight. */}
          {issue.theRead.trim() && (
            <Section style={{ marginTop: "20px", backgroundColor: GOLD_PILL_BG, borderLeft: `3px solid ${GOLD}`, borderRadius: "0 8px 8px 0", padding: "14px 16px" }}>
              <Text style={{ ...EYEBROW, color: GOLD_INK }}>The Read</Text>
              <Text style={{ margin: 0, fontFamily: SANS, fontSize: "15px", lineHeight: "1.7", color: NAVY, fontWeight: 500 }}>
                {issue.theRead}
              </Text>
            </Section>
          )}

          {/* One More Thing — the reply prompt (engagement). */}
          {issue.oneMoreThing.trim() && (
            <Text style={{ margin: "20px 0 0", fontFamily: SANS, fontSize: "14px", lineHeight: "1.65", color: SLATE }}>
              <span style={{ fontWeight: 700, color: NAVY }}>One more thing. </span>
              {issue.oneMoreThing}
            </Text>
          )}

          {/* Sign-off, in voice. */}
          <Text style={{ margin: "14px 0 0", fontFamily: SERIF, fontSize: "15px", lineHeight: "1.6", color: NAVY }}>
            {issue.signoff}
          </Text>

          {/* Lead-magnet CTA — lightly styled, not a loud button. */}
          <Section style={{ marginTop: "22px", backgroundColor: CREAM, borderRadius: "8px", padding: "16px 18px" }}>
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

          {/* Footer — CAN-SPAM address + native one-click unsubscribe. */}
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

/** Render the branded editorial digest email to an HTML string for the broadcast. */
export async function renderEditorialDigestEmail(issue: EditorialIssue, model: DigestModel): Promise<string> {
  return render(<EditorialDigestEmail issue={issue} model={model} />);
}

export default EditorialDigestEmail;
