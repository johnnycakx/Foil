// One-off single-page shot for gallery variants. Usage:
//   node design-loop/shoot-one.mjs <url> <outfile> [fullpage]
import puppeteer from "puppeteer";

const [url, out, full] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: "new" });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
await p.screenshot({ path: out, fullPage: full === "full" });
console.log("OK", out);
await b.close();
