// Dynamically generated 1200x630 OG/social card (ADR-055, card-art amendment).
// LEFT: the FoilTCG wordmark lockup (foil-corner mark + cream "Foil" + gold
// "TCG") + one value line on navy. RIGHT: a premium fan of 2-4 holo Pokémon
// cards (Charizard base1-4 anchor) so a shared link stops the scroll, mirroring
// the landing-page hero (cream/navy/gold, scarce gold, soft navy-tinted shadows).
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
const GOLD = "#c9a24b";
const SLATE = "#8B97B5";

// Foil-corner card mark as a data-URL SVG (Satori renders <img> reliably).
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="72" height="72"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3c87a"/><stop offset="1" stop-color="${GOLD}"/></linearGradient></defs><rect width="32" height="32" rx="7" fill="${CREAM}"/><g transform="translate(0 0)"><path d="M 9.5 4 H 17 L 26 13 V 24.5 A 3.5 3.5 0 0 1 22.5 28 H 9.5 A 3.5 3.5 0 0 1 6 24.5 V 7.5 A 3.5 3.5 0 0 1 9.5 4 Z" fill="${NAVY}"/><path d="M 17 4 H 26 V 13 Z" fill="#a8842f"/><path d="M 17 4 L 26 13 H 17 Z" fill="url(#s)"/></g></svg>`;
const MARK_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;

// Best-effort Fredoka 700 load via the Google Fonts CSS API. Returns null on any
// failure so the card renders in Satori's default font rather than 500-ing.
async function loadFredoka(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Fredoka:wght@700", {
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
  const fredoka = await loadFredoka();
  const wordmarkFont = fredoka ? "Fredoka" : "sans-serif";

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
            <img src={MARK_DATA_URL} width={72} height={72} alt="" />
            <div style={{ display: "flex", fontFamily: wordmarkFont, fontWeight: 700, fontSize: 56, letterSpacing: -1 }}>
              <span style={{ color: CREAM }}>Foil</span>
              <span style={{ color: GOLD }}>TCG</span>
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
            <span style={{ color: GOLD, fontWeight: 700, fontFamily: wordmarkFont }}>foiltcg.com</span>
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
                backgroundImage: `radial-gradient(circle, rgba(201,162,75,0.30), rgba(201,162,75,0) 70%)`,
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
      fonts: fredoka
        ? [{ name: "Fredoka", data: fredoka, weight: 700 as const, style: "normal" as const }]
        : [],
    },
  );
}
