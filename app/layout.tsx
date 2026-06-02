import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

// ADR-032 — brand metadata aligned with the deal-finder positioning
// (ADR-020) + the gold-rhombus mark. The OG + Twitter card reference
// /public/og-image.png so every share renders the new brand surface.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com"),
  title: {
    default: "Foil — The best price on any Pokémon card",
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
    title: "Foil — The best price on any Pokémon card",
    description:
      "Search any Pokémon card and instantly see the best live deal across eBay. Free wishlist alerts when prices drop.",
    siteName: "Foil",
    url: "/",
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Foil — the best price on any Pokémon card" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Foil — The best price on any Pokémon card",
    description:
      "Search any Pokémon card and instantly see the best live deal across eBay. Free wishlist alerts when prices drop.",
    creator: "@foilcards",
    images: ["/og-image.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
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
