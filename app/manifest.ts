import type { MetadataRoute } from "next";

// PWA web manifest (ADR-094). Next serves this as /manifest.webmanifest (the
// proxy already allowlists that metadata route). Icons are the hanko seal
// (full-bleed vermillion, rasterized from public/favicon.svg). Theme = the
// seal vermillion; background = cream, matching the app surface.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Foil — the best price on any Pokémon card",
    short_name: "Foil",
    description:
      "Search any Pokémon card and see the best live eBay deal. Free wishlist alerts when prices drop.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f5f0",
    theme_color: "#D85A30",
    icons: [
      { src: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
      // Maskable: the seal is full-bleed, so it survives the safe-zone crop.
      { src: "/icon-512.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}
