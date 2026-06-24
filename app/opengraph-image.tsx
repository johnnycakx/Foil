// Dynamically generated 1200x630 OG/social card (ADR-055). Renders the FoilTCG
// wordmark lockup on navy: foil-corner mark + cream "Foil" + gold "TCG", in
// Fredoka where it loads (best-effort fetch; falls back to Satori's default so
// the card never 500s). Replaces the retired Pokeball / coral scanner card.

import { ImageResponse } from "next/og";

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

export default async function Image() {
  const fredoka = await loadFredoka();
  const wordmarkFont = fredoka ? "Fredoka" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: NAVY,
          color: CREAM,
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={MARK_DATA_URL} width={72} height={72} alt="" />
          <div style={{ display: "flex", fontFamily: wordmarkFont, fontWeight: 700, fontSize: 56, letterSpacing: -1 }}>
            <span style={{ color: CREAM }}>Foil</span>
            <span style={{ color: GOLD }}>TCG</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontFamily: wordmarkFont,
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
            }}
          >
            The best price on any Pokémon card.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#C9D1E4", maxWidth: 940, lineHeight: 1.3 }}>
            Live eBay listings, scrubbed for the best real deal. Free wishlist alerts when prices drop.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, color: SLATE, fontSize: 24 }}>
          <span style={{ color: GOLD, fontWeight: 700, fontFamily: wordmarkFont }}>foiltcg.com</span>
          <span>· Built by John Craig</span>
        </div>
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
