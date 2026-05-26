import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font for hero headlines + onboarding surfaces (Session 38 /
// Task #20). Bricolage Grotesque is variable, geometric, distinctive
// — substituted for Cabinet Grotesk (which isn't on Google Fonts and
// would require a self-hosted file). Documented in ADR-028.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  title: "Foil — Value a Pokémon card in seconds",
  description: "Snap a Pokémon card, get a multi-source valuation in under 10 seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Impact.com affiliate program site verification - see ADR-020 once landed. */}
        <span className="sr-only">
          Impact-Site-Verification: b02776dd-2202-478a-9913-1cbc087e7931
        </span>
        {children}
      </body>
    </html>
  );
}
