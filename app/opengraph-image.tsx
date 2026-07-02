// Dynamically generated 1200x630 OG/social card (ADR-094 mark refresh).
// LEFT: the Foil wordmark lockup (hanko seal mark + "Foil") + one value line on
// navy. RIGHT: a premium fan of 2-4 holo Pokémon cards (Charizard base1-4
// anchor) so a shared link stops the scroll, mirroring the landing-page hero.
// The accent is the seal vermillion (gold retired) — kept internal to this
// rendered card so it reads coherently next to the new mark.
//
// EDGE-SAFE card art: Satori's WebP support is unreliable and the hero art is
// .webp, and the edge runtime has no fs/sharp — so the cards are pre-converted
// webp->jpeg + base64-inlined at build time into app/og-card-art.generated.ts
// (regenerate via scripts/generate-og-card-art.ts). NEVER 500s: if the generated
// art is empty OR the font fetch fails, it falls back to the text-only card.

import { ImageResponse } from "next/og";
import { OG_CARD_ART } from "./og-card-art.generated";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Foil — the best price on any Pokémon card";

const NAVY = "#0f1e3a";
const CREAM = "#f8f5f0";
const VERMILLION = "#D85A30";
const SLATE = "#8B97B5";

// Hanko seal mark as a data-URL SVG (Satori renders <img> reliably). Rounded
// vermillion seal square + cream card/pocket knockout (ADR-094).
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="76" height="76"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.6" fill="${VERMILLION}"/><rect x="8.9" y="5.4" width="6.2" height="9.6" rx="1.1" fill="none" stroke="${CREAM}" stroke-width="1.5"/><path d="M6 14.4h12v1.5a2.9 2.9 0 0 1-2.9 2.9H8.9A2.9 2.9 0 0 1 6 15.9z" fill="${CREAM}"/></svg>`;
const MARK_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

// Best-effort Bricolage Grotesque 600 load via the Google Fonts CSS API (the
// brand wordmark cut, ADR-094). Returns null on any failure so the card renders
// in Satori's default font rather than 500-ing.
async function loadWordmarkFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:woff2?|ttf))\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

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
  const wordmark = await loadWordmarkFont();
  const wordmarkFont = wordmark ? "Bricolage Grotesque" : "sans-serif";

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
          backgroundColor: NAVY,
          color: CREAM,
          fontFamily: "sans-serif",
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
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MARK_DATA_URL} width={76} height={76} alt="" />
            <div style={{ display: "flex", fontFamily: wordmarkFont, fontWeight: 600, fontSize: 56, letterSpacing: -1, color: CREAM }}>
              Foil
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                fontFamily: wordmarkFont,
                fontSize: hasArt ? 64 : 82,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -2,
                maxWidth: hasArt ? 500 : 1000,
              }}
            >
              The best price on any Pokémon card.
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#C9D1E4", maxWidth: hasArt ? 500 : 940, lineHeight: 1.3 }}>
              Live eBay deals, scrubbed for the best price. Free wishlist alerts.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, color: SLATE, fontSize: 24 }}>
            <span style={{ color: VERMILLION, fontWeight: 600, fontFamily: wordmarkFont }}>foiltcg.com</span>
            <span>· Built by John Craig</span>
          </div>
        </div>

        {/* RIGHT — the holo card fan over a scarce gold glow. Omitted (left goes
            full-width) if the generated art is empty — the never-500 soft-fall. */}
        {hasArt ? (
          <div style={{ display: "flex", position: "relative", flex: 1, alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                position: "absolute",
                width: 460,
                height: 460,
                borderRadius: 9999,
                backgroundImage: `radial-gradient(circle, rgba(216,90,48,0.28), rgba(216,90,48,0) 70%)`,
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
                    boxShadow: "0 22px 55px rgba(8,15,30,0.55)",
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
      fonts: wordmark
        ? [{ name: "Bricolage Grotesque", data: wordmark, weight: 600 as const, style: "normal" as const }]
        : [],
    },
  );
}
