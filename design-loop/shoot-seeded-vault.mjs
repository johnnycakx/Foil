// eve-vault-template-claims: re-shoot the seeded vault's per-visitor states.
// Pre-claim = the clean token URL (what every fresh visitor sees — the page
// never locks); post-submit = the same URL with ?c=ok (the per-visitor
// confirmation the action redirects to). Usage:
//   node design-loop/shoot-seeded-vault.mjs <token>
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const token = process.argv[2];
if (!token) {
  console.error("usage: node design-loop/shoot-seeded-vault.mjs <seeded-token>");
  process.exit(1);
}
mkdirSync("design-loop/gallery/eve-vault", { recursive: true });

const STATES = [
  { name: "pre-claim", qs: "" },
  { name: "post-submit", qs: "?c=ok" },
];
const VIEWPORTS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
];

const browser = await puppeteer.launch({ headless: "new" });
for (const s of STATES) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const url = `http://localhost:3000/w/${encodeURIComponent(token)}${s.qs}`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1500));
    const out = `design-loop/gallery/eve-vault/${s.name}-${vp.tag}.png`;
    await page.screenshot({ path: out, fullPage: true });
    console.log("OK", out);
    await page.close();
  }
}
await browser.close();
