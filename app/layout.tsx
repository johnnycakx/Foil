import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Bricolage_Grotesque } from "next/font/google";
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
});

// Display font for hero headlines + brand surfaces. Session 46 (ADR-036)
// swapped Bricolage Grotesque (geometric grotesque) for Fraunces — a
// variable humanist serif. The opsz axis lets the cut adapt from text
// to display sizes; the SOFT axis (applied in globals.css) warms the
// terminals so headlines read "trusted concierge", warm but considered,
// rather than "indie SaaS". Body stays Geist Sans.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${bricolage.variable} h-full antialiased`}
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
