// Per-line OG/social card (eve-line-tracker, ADR-095) — THIS page gets shared,
// so the card must stop the scroll. LEFT: the seal + "Foil", "Every <Pokémon>
// card", a value line, sakura petal accent on cream. RIGHT: a fan of the top-3
// priciest printings' art. nodejs runtime (not edge) so it can read the baked
// snapshot via lib/lines/data + fetch the card art; NEVER 500s — if the art or
// font fetch fails it falls back to the text-only sakura card.

import { ImageResponse } from "next/og";
import { getLineConfig, LAUNCH_LINES } from "@/lib/lines/config";
import { getLineData } from "@/lib/lines/data";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return LAUNCH_LINES.map((pokemon) => ({ pokemon }));
}

const NAVY = "#0f1e3a";
const CREAM = "#f8f5f0";
const SAKURA = "#d98aa0";
const SAKURA_WASH = "#f6e6ea";
const SLATE = "#8B97B5";

// The seal mark as a data-URL SVG (ADR-094), rendered via <img>.
const SEAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.6" fill="#D85A30"/><rect x="8.9" y="5.4" width="6.2" height="9.6" rx="1.1" fill="none" stroke="${CREAM}" stroke-width="1.5"/><path d="M6 14.4h12v1.5a2.9 2.9 0 0 1-2.9 2.9H8.9A2.9 2.9 0 0 1 6 15.9z" fill="${CREAM}"/></svg>`;
const SEAL_DATA_URL = `data:image/svg+xml;base64,${Buffer.from(SEAL).toString("base64")}`;

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:\/\/[^)]+\.(?:woff2?|ttf))\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Fetch a card image → base64 data URL. Null on any failure (soft-fall). */
async function loadArt(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/") || type.includes("webp")) return null; // Satori WebP is unreliable
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ pokemon: string }> }) {
  const { pokemon } = await params;
  const config = getLineConfig(pokemon);
  const [font] = await Promise.all([loadFont()]);
  const wordmarkFont = font ? "Bricolage Grotesque" : "sans-serif";

  const cards = config ? getLineData(config).cards : [];
  const topArt = (await Promise.all(cards.slice(0, 3).map((c) => loadArt(c.image)))).filter(
    (x): x is string => Boolean(x),
  );
  const hasArt = topArt.length > 0;
  const name = config?.pokemon ?? "Foil";
  const count = cards.length;

  const FAN = [
    { tx: -140, ty: 8, rot: -8 },
    { tx: 140, ty: 8, rot: 8 },
    { tx: 0, ty: -10, rot: 0 },
  ];
  const fan = topArt.length >= 3 ? [topArt[1], topArt[2], topArt[0]] : topArt;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: CREAM, fontFamily: "sans-serif" }}>
        {/* soft sakura wash top-right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 520,
            height: 520,
            borderRadius: 9999,
            backgroundImage: `radial-gradient(circle, ${SAKURA_WASH}, ${CREAM} 70%)`,
            display: "flex",
          }}
        />
        {/* petals */}
        {[
          { l: 90, t: 70, s: 26 },
          { l: 640, t: 40, s: 20 },
          { l: 520, t: 470, s: 22 },
          { l: 200, t: 520, s: 18 },
        ].map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.l,
              top: p.t,
              width: p.s,
              height: p.s * 0.82,
              background: SAKURA,
              opacity: 0.55,
              borderRadius: "70% 30% 62% 38% / 62% 40% 60% 38%",
              display: "flex",
            }}
          />
        ))}

        {/* LEFT — wordmark + headline */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, width: hasArt ? 660 : "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SEAL_DATA_URL} width={60} height={60} alt="" />
            <div style={{ display: "flex", fontFamily: wordmarkFont, fontWeight: 600, fontSize: 40, letterSpacing: -1, color: NAVY }}>Foil</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontFamily: wordmarkFont, fontWeight: 600, fontSize: hasArt ? 68 : 88, lineHeight: 1.02, letterSpacing: -2, color: NAVY, maxWidth: hasArt ? 520 : 1000 }}>
              Every {name} card, tracked.
            </div>
            <div style={{ display: "flex", fontSize: 27, color: "#5b6b86", maxWidth: hasArt ? 500 : 900, lineHeight: 1.3 }}>
              {count} printings · real prices · what each one sold for.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: SLATE }}>
            <span style={{ color: SAKURA, fontWeight: 600, fontFamily: wordmarkFont }}>foiltcg.com/lines/{pokemon}</span>
          </div>
        </div>

        {/* RIGHT — the top-3 card fan */}
        {hasArt ? (
          <div style={{ display: "flex", position: "relative", flex: 1, alignItems: "center", justifyContent: "center" }}>
            {fan.map((art, i) => {
              const t = topArt.length >= 3 ? FAN[i] : FAN[2];
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={art}
                  width={250}
                  height={348}
                  alt=""
                  style={{ position: "absolute", borderRadius: 14, boxShadow: "0 22px 55px rgba(15,30,58,0.35)", transform: `translate(${t.tx}px, ${t.ty}px) rotate(${t.rot}deg)` }}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Bricolage Grotesque", data: font, weight: 600 as const, style: "normal" as const }] : [] },
  );
}
