// Verifies the /start chase-card chips add a card end-to-end (iter-07).
import puppeteer from "puppeteer";

const b = await puppeteer.launch({ headless: "new" });
const pg = await b.newPage();
await pg.setViewport({ width: 1440, height: 900 });
await pg.goto("http://localhost:3000/start", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1000));

const chips = await pg.$$("button[type=button]");
let clicked = false;
for (const c of chips) {
  const t = await pg.evaluate((el) => el.textContent, c);
  if (t.includes("Moonbreon")) {
    await c.click();
    clicked = true;
    break;
  }
}
await new Promise((r) => setTimeout(r, 500));
const text = await pg.evaluate(() => document.body.innerText);
console.log("chip clicked:", clicked);
console.log("target row appears:", text.includes("Set target prices") && text.includes("Evolving Skies"));
console.log("button reads Track 1 card:", text.includes("Track 1 card"));
console.log("chips row hidden after pick:", !text.includes("Start with a grail"));
await b.close();
