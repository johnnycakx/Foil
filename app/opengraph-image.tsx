// Dynamically generated 1200x630 OG image for the homepage. Next renders
// this at request time, so social cards always reflect the current copy.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Foil — know what any Pokémon listing is worth in 10 seconds";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0B1428",
          color: "white",
          padding: "72px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              backgroundColor: "#FF6B5C",
            }}
          />
          <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5 }}>Foil</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h1
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: -2,
              margin: 0,
              maxWidth: 980,
            }}
          >
            Know what any Pokémon listing is worth in{" "}
            <span style={{ color: "#FF6B5C" }}>10 seconds</span>.
          </h1>
          <p
            style={{
              fontSize: 30,
              color: "#C9D1E4",
              maxWidth: 920,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Snap one photo. AI reads every card and pulls live eBay + TCGplayer + graded prices
            before the next buyer clicks Buy.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            color: "#8B97B5",
            fontSize: 22,
          }}
        >
          <span style={{ color: "#FF6B5C", fontWeight: 600 }}>foil</span>
          <span>· Pokémon TCG card valuation in seconds</span>
        </div>
      </div>
    ),
    size,
  );
}
