import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque, Shrikhand } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { siteUrl } from "@/lib/seo/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Not above the fold on the homepage (used for blog/card breadcrumbs + mono
  // labels). Don't preload it — preloading all 5 fonts competes with the LCP
  // display font (Fraunces) on mobile Slow-4G (homepage-perf-and-a11y).
  preload: false,
});

// Display font for hero headlines + brand surfaces — Fraunces, a variable
// humanist serif (Session 46 / ADR-036: the opsz axis adapts the cut from text
// to display sizes; the SOFT axis warms the terminals so headlines read
// "trusted concierge", not "indie SaaS"). Body stays Geist Sans.
//
// SELF-HOSTED SUBSET (mobile-lcp-font-js-floor goal). Fraunces is the mobile-LCP
// element (the homepage H1), and next/font/google served it as a 120KB "latin"
// woff2 whose weight is almost all VARIABLE-AXIS delta data. app/fonts/
// fraunces-display.woff2 is a brand-IDENTICAL 57KB subset (regenerate via
// scripts/subset-fraunces.py): SOFT is baked at 30 — the only value the site
// ever renders, so the warmth is preserved, not dropped — while opsz [9,72] and
// wght [400,700] stay VARIABLE so font-optical-sizing:auto and the font-weight
// utilities still compose exactly as before. next/font/local keeps the
// automatic fallback-metric override (adjustFontFallback) so the swap is CLS-0.
const fraunces = localFont({
  src: "./fonts/fraunces-display.woff2",
  variable: "--font-display",
  weight: "400 700",
  display: "swap",
  preload: true,
  adjustFontFallback: "Times New Roman",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

// Brand wordmark font (ADR-094). Bricolage Grotesque 600 — a carved, slightly
// idiosyncratic grotesque that pairs with the hanko seal mark; it replaces
// Fredoka's rounded playfulness, which clashed with the carved-seal aesthetic.
// Sets the "Foil" lockup ("TCG" dropped from the display wordmark). Exposed as
// the `font-wordmark` utility via globals.css.
const bricolage = Bricolage_Grotesque({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["600", "700"],
  // Below the fold on the homepage (footer wordmark + the carved logo variant +
  // OG surfaces). Don't preload — the visible above-the-fold wordmark is the
  // Shrikhand bubble cut, which stays preloaded (homepage-perf-and-a11y).
  preload: false,
});

// Bubble wordmark cut (design-loop-round2 §1/§8, John's 1am verdict):
// "Foil" in a genuinely bubbly balloon face, wordmark-first. Shrikhand won the
// round-2 ten-face bake-off as the closest LICENSED (OFL) match to John's
// Skylens-Italic taste ref (fat, bouncy, italic-leaning bubble-script —
// Skylens itself is personal-use-only and must never ship). Supersedes the
// round-1 Baloo 2 soft cut. Rendered via Logo face="bubble"; Bricolage stays
// pinned as --font-wordmark for the carved cut + OG surfaces pending John's
// brand-asset follow-up.
const shrikhand = Shrikhand({
  variable: "--font-wordmark-bubble",
  subsets: ["latin"],
  weight: "400",
});

// Brand metadata aligned with the deal-finder positioning (ADR-020) + the
// hanko seal mark + "Foil" wordmark (ADR-094). The favicon is the seal
// (public/favicon.svg). OG + Twitter images are generated dynamically by
// app/opengraph-image.tsx + app/twitter-image.tsx (Next auto-discovers them),
// so the static /og-image.png is retired and not referenced here.
export const metadata: Metadata = {
  // ONE canonical-origin constant across layout, card pages, and the sitemap
  // (lib/seo/site-url.ts) — the fallbacks had drifted www vs non-www.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Foil: the best price on any Pokémon card",
    template: "%s · Foil",
  },
  description:
    "Search any Pokémon card and instantly see the best live deal across eBay. Free wishlist alerts when prices drop.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    title: "Foil: the best price on any Pokémon card",
    description:
      "Search any Pokémon card and instantly see the best live deal across eBay. Free wishlist alerts when prices drop.",
    siteName: "Foil",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foil: the best price on any Pokémon card",
    description:
      "Search any Pokémon card and instantly see the best live deal across eBay. Free wishlist alerts when prices drop.",
    creator: "@FoilTCG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${bricolage.variable} ${shrikhand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Impact.com affiliate program site verification - see ADR-020 once landed. */}
        <span className="sr-only">
          Impact-Site-Verification: b02776dd-2202-478a-9913-1cbc087e7931
        </span>
        {children}
        {/* Vercel Analytics (F1) — first-party page-view + Web-Vitals data so a
            paid creator pilot is measurable beyond raw EPN clicks. Loads
            after-interactive; does not block render. */}
        <Analytics />
      </body>
    </html>
  );
}
