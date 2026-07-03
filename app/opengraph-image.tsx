// Dynamically generated 1200x630 OG/social card (brand-og-unification,
// 2026-07-02 — supersedes the ADR-094 seal treatment). LEFT: the Shrikhand
// "Foil" wordmark (the shared lib/og/brand block — cream on charcoal, exactly
// the live header) + one value line. RIGHT: a premium fan of holo cards
// (Charizard base1-4 anchor) over a sakura glow, mirroring the landing hero.
//
// EDGE-SAFE card art: Satori's WebP support is unreliable and the hero art is
// .webp, and the edge runtime has no fs/sharp — so the cards are pre-converted
// webp->jpeg + base64-inlined at build time into app/og-card-art.generated.ts
// (regenerate via scripts/generate-og-card-art.ts). NEVER 500s: if the
// generated art is empty the card falls back to text-only; if the font can't
// load, the wordmark renders as styled text in the bundled default (Geist —
// Foil's body font), never the retired seal.

import { ImageResponse } from "next/og";
import { OG_CARD_ART } from "./og-card-art.generated";
import { loadOgFonts, OgWordmark, OG_BODY_FONT, OG_COLORS } from "../lib/og/brand";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Foil — the best price on any Pokémon card";

// Card display size + the fan's per-card transform (back -> front). Center card
// upright on top; flankers rotated + offset so they overlap into a tasteful fan.
const CARD_W = 250;
const CARD_H = 348;
const FAN: { tx: number; ty: number; rot: number }[] = [
  { tx: -150, ty: 6, rot: -9 }, // back-left
  { tx: 150, ty: 6, rot: 9 }, // back-right
  { tx: 0, ty: -12, rot: 0 }, // front-center (anchor)
];

export default async function Image() {
  const { fonts, wordmarkLoaded } = await loadOgFonts();

  // Up to 3 cards in fan z-order: render the flankers first, the anchor last
  // (front). The generated module lists [anchor, ...] so reorder to [l, r, anchor].
  const art = OG_CARD_ART.slice(0, 3);
  const hasArt = art.length > 0;
  const fanCards =
    art.length >= 3 ? [art[1], art[2], art[0]] : art; // flankers behind, anchor front

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          backgroundColor: OG_COLORS.charcoal,
          color: OG_COLORS.cream,
          fontFamily: OG_BODY_FONT,
        }}
      >
        {/* LEFT — wordmark + value line + CTA */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 72,
            width: hasArt ? 660 : "100%",
          }}
        >
          <OgWordmark size={84} tone="cream" fontLoaded={wordmarkLoaded} />

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                fontSize: hasArt ? 62 : 80,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -2,
                maxWidth: hasArt ? 500 : 1000,
              }}
            >
              The best price on any Pokémon card.
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "rgba(248,245,240,0.7)", maxWidth: hasArt ? 500 : 940, lineHeight: 1.3 }}>
              Live eBay deals, scrubbed for the best price. Free wishlist alerts.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, color: OG_COLORS.slate, fontSize: 24 }}>
            <span style={{ color: OG_COLORS.sakura, fontWeight: 600 }}>foiltcg.com</span>
            <span>· Built by John Craig</span>
          </div>
        </div>

        {/* RIGHT — the holo card fan over a soft sakura glow. Omitted (left goes
            full-width) if the generated art is empty — the never-500 soft-fall. */}
        {hasArt ? (
          <div style={{ display: "flex", position: "relative", flex: 1, alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                width: 460,
                height: 460,
                borderRadius: 9999,
                backgroundImage: `radial-gradient(circle, rgba(217,138,160,0.24), rgba(217,138,160,0) 70%)`,
              }}
            />
            {fanCards.map((c, i) => {
              const t = FAN[art.length >= 3 ? i : 2]; // single/2-card: use the upright transform
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={c.slug}
                  src={c.dataUrl}
                  width={CARD_W}
                  height={CARD_H}
                  alt=""
                  style={{
                    position: "absolute",
                    borderRadius: 14,
                    boxShadow: "0 22px 55px rgba(4,4,5,0.7)",
                    transform: `translate(${t.tx}px, ${t.ty}px) rotate(${t.rot}deg)`,
                  }}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}
