/**
 * scripts/capture-screens.mjs
 *
 * Uses puppeteer-core with system Google Chrome to capture real responsive
 * screenshots of SlotBazaar at 375px, 768px, and 1280px (with wallet popover open).
 */

import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("docs/screens");
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const executablePath = fs.existsSync(CHROME_PATH) ? CHROME_PATH : EDGE_PATH;
console.log(`Using browser: ${executablePath}`);

async function run() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const url = "http://localhost:5173/";

  // 1. Mobile (375x812)
  console.log("Capturing 375px (mobile)...");
  const pageMobile = await browser.newPage();
  await pageMobile.setViewport({ width: 375, height: 812 });
  await pageMobile.goto(url, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2000));
  await pageMobile.screenshot({ path: path.join(OUT_DIR, "screen-375px.png") });
  await pageMobile.close();

  // 2. Tablet (768x1024)
  console.log("Capturing 768px (tablet)...");
  const pageTablet = await browser.newPage();
  await pageTablet.setViewport({ width: 768, height: 1024 });
  await pageTablet.goto(url, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2000));
  await pageTablet.screenshot({ path: path.join(OUT_DIR, "screen-768px.png") });
  await pageTablet.close();

  // 3. Desktop (1280x800)
  console.log("Capturing 1280px (desktop)...");
  const pageDesktop = await browser.newPage();
  await pageDesktop.setViewport({ width: 1280, height: 800 });
  await pageDesktop.goto(url, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 2000));
  await pageDesktop.screenshot({ path: path.join(OUT_DIR, "screen-1280px.png") });

  // 4. Desktop with Wallet Popover Open
  console.log("Capturing 1280px with wallet popover open...");
  await pageDesktop.click("#wallet-btn-connect");
  await new Promise((r) => setTimeout(r, 800));
  await pageDesktop.screenshot({ path: path.join(OUT_DIR, "screen-1280px-wallet-popover.png") });
  await pageDesktop.close();

  await browser.close();
  console.log("All screenshots captured and saved to docs/screens/!");
}

run().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
