// Per-line OG/social card (eve-line-tracker, ADR-095) — THIS page gets shared,
// so the card must stop the scroll. LEFT: the Shrikhand "Foil" wordmark
// (shared lib/og/brand block), "Every <Pokémon> card", a value line, sakura
// petal accent on cream. RIGHT: a fan of the top-3 priciest printings' art.
// nodejs runtime (not edge) so it can read the baked snapshot via
// lib/lines/data + fetch the card art; NEVER 500s — if the art or font load
// fails it falls back to the text-only sakura card.

import { ImageResponse } from "next/og";
import { getLineConfig, LAUNCH_LINES } from "@/lib/lines/config";
import { loadOgFonts, OgWordmark, OG_BODY_FONT } from "@/lib/og/brand";
import { getLineData } from "@/lib/lines/data";
import { blossomMarkup, petalMarkup, type PetalShape } from "@/components/lines/petal-shapes";

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

// Identity block: the shared Shrikhand wordmark (lib/og/brand — the seal is
// retired from brand surfaces; the old Google-css2 font fetch never worked in
// Satori anyway, see brand-og-unification).

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
  const { fonts, wordmarkLoaded } = await loadOgFonts();
  const bodyFont = OG_BODY_FONT; // headline/body: Geist, the site's body font

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
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: CREAM, fontFamily: bodyFont }}>
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
        {/* petals — the shared shape library (petal-fidelity-pass: a static
            share card needs MORE shape fidelity than the live page, so the
            real notched silhouettes + gradient, never a border-radius blob).
            Satori can't render SVG children, so each petal ships as a
            data-URI <img>. */}
        {(
          [
            { l: 306, t: 132, s: 32, r: -24, shape: "classic", o: 0.85 },
            { l: 640, t: 40, s: 26, r: 40, shape: "curl", o: 0.75 },
            { l: 520, t: 466, s: 28, r: 15, shape: "classic", o: 0.75 },
            { l: 200, t: 518, s: 24, r: -52, shape: "slender", o: 0.65 },
            { l: 56, t: 420, s: 22, r: 66, shape: "classic", o: 0.6 },
          ] as const
        ).map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={`data:image/svg+xml,${encodeURIComponent(
              petalMarkup({ shape: p.shape as PetalShape, size: p.s, rot: p.r, tone: "day", id: `og-p${i}` }),
            )}`}
            width={p.s}
            height={p.s}
            alt=""
            style={{ position: "absolute", left: p.l, top: p.t, opacity: p.o }}
          />
        ))}
        {/* one five-petal blossom (the sparing accent) anchoring the motif */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml,${encodeURIComponent(blossomMarkup({ size: 34, rot: 14, tone: "day", id: "og-bl" }))}`}
          width={34}
          height={37}
          alt=""
          style={{ position: "absolute", left: 596, top: 88, opacity: 0.8 }}
        />

        {/* LEFT — wordmark + headline */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, width: hasArt ? 660 : "100%" }}>
          <OgWordmark size={58} tone="navy" fontLoaded={wordmarkLoaded} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", fontFamily: bodyFont, fontWeight: 600, fontSize: hasArt ? 68 : 88, lineHeight: 1.02, letterSpacing: -2, color: NAVY, maxWidth: hasArt ? 520 : 1000 }}>
              Every {name} card, tracked.
            </div>
            <div style={{ display: "flex", fontSize: 27, color: "#5b6b86", maxWidth: hasArt ? 500 : 900, lineHeight: 1.3 }}>
              {count} printings · real prices · what each one sold for.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: SLATE }}>
            <span style={{ color: SAKURA, fontWeight: 600, fontFamily: bodyFont }}>foiltcg.com/lines/{pokemon}</span>
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
    { ...size, fonts },
  );
}
