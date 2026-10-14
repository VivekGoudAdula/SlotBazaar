/**
 * scripts/capture-header-screens.mjs
 *
 * Captures screenshots of the final header at 375px and 1280px width
 * and saves to docs/screens/screen-header-375px.png and docs/screens/screen-header-1280px.png.
 */

import fs from "fs";
import path from "path";
import http from "http";
import puppeteer from "puppeteer-core";
import { preview } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const CHROME_PATH = fs.existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function main() {
  console.log("Starting Vite preview server...");
  const server = await preview({
    root: REPO_ROOT,
    preview: { port: 4199, host: "127.0.0.1" },
  });

  const previewUrl = "http://127.0.0.1:4199";
  console.log(`Vite preview running at ${previewUrl}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const screensDir = path.resolve(REPO_ROOT, "docs/screens");
  if (!fs.existsSync(screensDir)) {
    fs.mkdirSync(screensDir, { recursive: true });
  }

  // 1. Capture at 1280px
  console.log("Capturing 1280px header...");
  const page1280 = await browser.newPage();
  await page1280.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page1280.goto(previewUrl, { waitUntil: "networkidle0" });
  await page1280.waitForSelector("#app-header", { timeout: 10000 });
  const header1280 = await page1280.$("#app-header");
  if (header1280) {
    const buf = await header1280.screenshot({ type: "png" });
    fs.writeFileSync(path.join(screensDir, "screen-header-1280px.png"), buf);
    console.log("Saved docs/screens/screen-header-1280px.png");
  }

  // 2. Capture at 375px
  console.log("Capturing 375px header...");
  const page375 = await browser.newPage();
  await page375.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await page375.goto(previewUrl, { waitUntil: "networkidle0" });
  await page375.waitForSelector("#app-header", { timeout: 10000 });
  const header375 = await page375.$("#app-header");
  if (header375) {
    const buf = await header375.screenshot({ type: "png" });
    fs.writeFileSync(path.join(screensDir, "screen-header-375px.png"), buf);
    console.log("Saved docs/screens/screen-header-375px.png");
  }

  await browser.close();
  await server.close();
  console.log("Header capture complete.");
}

main().catch((err) => {
  console.error("Error capturing header screens:", err);
  process.exit(1);
});
