# Brand mark swap — off-repo checklist (ADR-094)

The hanko seal mark + "Foil" wordmark shipped across every in-repo surface
(favicon, header/footer, OG/Twitter cards, email mastheads, manifest). These
three live on platforms the bot can't touch — do them so no surface lags with
the old foil-corner/gold-TCG mark:

1. **X (@FoilTCG):** replace the avatar with the seal (use `public/icon-512.png`
   — full-bleed vermillion, X rounds the corners) and the banner if it carries
   the old wordmark.
2. **Discord server icon:** upload `public/icon-512.png` as the server icon.
3. **Beehiiv publication logo:** replace with the seal + "Foil" (export
   `public/icon.svg` to PNG, or use `icon-512.png` for the square logo slot).
