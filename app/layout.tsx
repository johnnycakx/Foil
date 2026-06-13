import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Fredoka } from "next/font/google";
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

// Brand wordmark font (ADR-055). Fredoka — bold, rounded, confident — sets the
// "FoilTCG" lockup. Exposed as the `font-wordmark` utility via globals.css.
const fredoka = Fredoka({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Brand metadata aligned with the deal-finder positioning (ADR-020) + the
// FoilTCG wordmark (ADR-055). The favicon is the foil-corner card mark
// (public/favicon.svg). OG + Twitter images are generated dynamically by
// app/opengraph-image.tsx + app/twitter-image.tsx (Next auto-discovers them),
// so the static /og-image.png is retired and not referenced here.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://foiltcg.com"),
  title: {
    default: "Foil — Host a Pokémon card vending machine in your business",
    template: "%s · Foil",
  },
  description:
    "Foil places, stocks, and services Pokémon card vending machines for Bay Area businesses. Zero cost, zero work, monthly revenue share.",
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
    title: "Foil — Host a Pokémon card vending machine in your business",
    description:
      "Foil places, stocks, and services Pokémon card vending machines for Bay Area businesses. Zero cost, zero work, monthly revenue share.",
    siteName: "Foil",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foil — Host a Pokémon card vending machine in your business",
    description:
      "Foil places, stocks, and services Pokémon card vending machines for Bay Area businesses. Zero cost, zero work, monthly revenue share.",
    creator: "@foilcards",
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
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${fredoka.variable} h-full antialiased`}
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
