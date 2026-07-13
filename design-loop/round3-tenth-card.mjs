// Round-3 harness: the 10th-card rejection, SEEN at 390×844 for the first
// time in three tours — plus evidence shots of the round-2 fixes (whole tags,
// writing state, full dealt hand, success next-step).
//
// Drives the REAL wire against the dev server (real Supabase): fills 9
// sleeves, submits under a deletable +alias (digest UNCHECKED), reloads,
// seats a 10th card and submits again to render the server's page-full line.
// Usage: node design-loop/round3-tenth-card.mjs [baseUrl] [outDir]

import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "design-loop/round3-harness";
const QA_EMAIL = "john.c.craig24+round3qa@gmail.com"; // deletable tour data, per QA-PREVIEW-PROCESS
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const shot = async (name) => {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log("shot", name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click the first button whose visible text includes `text`. */
async function clickByText(text) {
  const ok = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(t) && !b.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!ok) throw new Error(`no clickable button containing: ${text}`);
}

const filledCount = () => page.$$eval(".pocket-filled:not(.pocket-demo)", (els) => els.length);

async function ripPack() {
  await page.waitForSelector(".pack", { timeout: 15000 });
  await page.focus(".pack");
  await page.keyboard.press("Enter"); // the keyboard path opens directly
  await page.waitForSelector(".pack-card-btn", { timeout: 10000 });
}

async function fillTo(n) {
  for (let guard = 0; guard < 30 && (await filledCount()) < n; guard++) {
    const seated = await page.evaluate(() => {
      const packCard = document.querySelector(".pack-card-btn:not([disabled])");
      if (packCard) return packCard.click() ?? "pack";
      const sleeveIt = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Sleeve it" && !b.disabled,
      );
      if (sleeveIt) return sleeveIt.click() ?? "suggestion";
      const empty = document.querySelector(".sleeve-empty");
      if (empty) return empty.click() ?? "fan-open";
      return null;
    });
    if (seated === "fan-open") {
      await page.waitForSelector(".fan-btn", { timeout: 8000 });
      await page.click(".fan-btn");
    }
    if (seated === null) throw new Error("no way left to seat a card");
    await sleep(350);
  }
  const got = await filledCount();
  if (got < n) throw new Error(`only seated ${got}/${n}`);
}

async function submitEmail() {
  // Digest opt-in OFF for QA data (no newsletter writes for the alias).
  await page.evaluate(() => {
    const box = document.querySelector(".note-check input");
    if (box && box.checked) box.click();
  });
  await page.click(".note-input", { clickCount: 3 });
  await page.type(".note-input", QA_EMAIL);
  await clickByText("Foil watches");
}

// ---- Pass 1: fill the page to exactly 9 and submit -------------------------
await page.goto(`${base}/start`, { waitUntil: "networkidle2", timeout: 60000 });
await ripPack();
await sleep(400);
await shot("1-dealt-hand-390"); // fan-clipping fix: all 7 cards whole

await fillTo(1);
await shot("2-writing-state"); // flicker fix: blank pencil stroke, no "any good price"
await sleep(1400); // TAG_WRITE_DELAY passes; Foil writes the tag
await shot("3-tag-written-short"); // truncation fix: "under $NN" whole

await fillTo(9);
await sleep(1500);
await shot("4-page-full-9");
const pass1Ids = await page.$$eval('.pocket-filled[id^="pocket-"]', (els) => els.map((e) => e.id));
await submitEmail();
await page.waitForFunction(
  () => document.body.textContent?.includes("The binder is yours"),
  { timeout: 20000 },
);
await shot("5-success-next-step");
console.log("pass 1: 9-card submit accepted for", QA_EMAIL);

// ---- Pass 2: the 10th card --------------------------------------------------
// Must be a card NOT among the 9 — a whole-page duplicate resubmit is an
// UPDATE by design (ADR-116), which is exactly why the first cut of this
// harness saw success instead of the rejection.
await page.goto(`${base}/start`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForSelector(".sleeve-empty", { timeout: 15000 });
let seatedNew = false;
for (let i = 0; i < 9 && !seatedNew; i++) {
  await page.click(".sleeve-empty");
  await page.waitForSelector(".fan-btn", { timeout: 8000 });
  const btns = await page.$$(".fan-btn");
  if (i >= btns.length) break;
  await btns[i].click();
  await sleep(400);
  const id = await page.$eval('.pocket-filled[id^="pocket-"]', (el) => el.id);
  if (pass1Ids.includes(id)) {
    await page.click(".sleeve-remove"); // a duplicate exercises nothing; put it back
    await sleep(250);
  } else {
    seatedNew = true;
    console.log("pass 2: seated a genuinely new 10th card:", id);
  }
}
if (!seatedNew) throw new Error("could not find a card outside the pass-1 nine");
await submitEmail();
await page.waitForSelector("[role=alert]", { timeout: 20000 });
const alertText = await page.$eval("[role=alert]", (el) => el.textContent ?? "");
console.log("pass 2 alert:", alertText.trim());
await page.evaluate(() => document.querySelector("[role=alert]")?.scrollIntoView({ block: "center" }));
await sleep(300);
await shot("6-tenth-card-rejected");
if (!alertText.includes("full")) {
  console.error("UNEXPECTED: alert does not read as the page-full rejection");
  process.exitCode = 1;
}

await browser.close();
console.log("done →", outDir);
