// Twitter card image (ADR-055) — identical to the OG card. Reuses the
// opengraph-image renderer so the FoilTCG wordmark lockup is the single source
// for both og:image and twitter:image. Next requires literal, statically
// parseable route-segment config (no `export ... from`), so the config consts
// are redeclared here and only the renderer is imported.

import OgImage from "./opengraph-image";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Foil — host a Pokémon card vending machine in your business";

export default OgImage;
