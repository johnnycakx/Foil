// Interactive verification of the holo-tilt signature (iter-06 sustain pass):
// drives a real pointer across a hero card and asserts the transform + sheen
// respond, plus confirms reduced-motion leaves the card static.
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1500));

const card = await page.$(".holo-card");
if (!card) throw new Error("no .holo-card found");
const box = await card.boundingBox();

const readState = () =>
  page.evaluate(() => {
    const el = document.querySelector(".holo-card");
    const sheen = el.querySelector(".holo-sheen");
    return {
      transform: getComputedStyle(el).transform,
      hx: el.style.getPropertyValue("--hx"),
      hy: el.style.getPropertyValue("--hy"),
      sheenOpacity: getComputedStyle(sheen).opacity,
    };
  });

const before = await readState();
// Sweep the pointer to the card's top-right quadrant.
await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 8 });
await new Promise((r) => setTimeout(r, 400));
const during = await readState();
// Leave the card.
await page.mouse.move(box.x - 200, box.y - 100, { steps: 4 });
await new Promise((r) => setTimeout(r, 400));
const after = await readState();

console.log("before:", JSON.stringify(before));
console.log("during:", JSON.stringify(during));
console.log("after :", JSON.stringify(after));

const tilted = during.hx !== "" && during.hx !== "0.5" && during.transform !== before.transform;
const sheenOn = parseFloat(during.sheenOpacity) > 0.5;
const reset = after.hx === "0.5" && after.hy === "0.5";
console.log(`TILT: ${tilted ? "OK" : "FAIL"} · SHEEN: ${sheenOn ? "OK" : "FAIL"} · RESET: ${reset ? "OK" : "FAIL"}`);

// Reduced-motion: listeners must not tilt.
const rmPage = await browser.newPage();
await rmPage.setViewport({ width: 1440, height: 900 });
await rmPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await rmPage.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1200));
const rmCard = await rmPage.$(".holo-card");
const rmBox = await rmCard.boundingBox();
await rmPage.mouse.move(rmBox.x + rmBox.width * 0.8, rmBox.y + rmBox.height * 0.2, { steps: 6 });
await new Promise((r) => setTimeout(r, 300));
const rmState = await rmPage.evaluate(() => {
  const el = document.querySelector(".holo-card");
  return { hx: el.style.getPropertyValue("--hx") };
});
console.log(`REDUCED-MOTION STATIC: ${rmState.hx === "" ? "OK" : "FAIL (hx=" + rmState.hx + ")"}`);

await browser.close();
