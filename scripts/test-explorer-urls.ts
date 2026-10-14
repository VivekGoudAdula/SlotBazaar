/**
 * scripts/test-explorer-urls.ts
 *
 * Verifies:
 * 1. https://tiramisu.explorer.arkiv.network/tx/<hash>
 * 2. https://data.arkiv.network/?q=<key>&chain=tiramisu
 *
 * Captures screenshots to docs/screens/ and checks what renders.
 *
 * Usage: npx tsx scripts/test-explorer-urls.ts
 */

import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TX_HASH = "0xd4cd0f79f0fcd44e4139f1d6f58625ee128ee116e679e0cc7c6af65e2cca08f6";
const ENTITY_KEY = "0x1a9dde27548ceb9f69747209ffaa524e94f0e740114b08dc319e73b2d1844b2f";

async function main() {
  const screensDir = path.resolve(process.cwd(), "docs/screens");
  if (!fs.existsSync(screensDir)) {
    fs.mkdirSync(screensDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // 1. Test tiramisu.explorer.arkiv.network
  const txUrl = `https://tiramisu.explorer.arkiv.network/tx/${TX_HASH}`;
  console.log(`\n1. Testing Blockscout Tx URL: ${txUrl}`);
  try {
    const res = await page.goto(txUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 4000));
    const status = res?.status();
    const title = await page.title();
    console.log(`   Status : ${status}`);
    console.log(`   Title  : ${title}`);

    const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log(`   Snippet: ${bodySnippet.replace(/\n+/g, " ").slice(0, 150)}...`);

    const txScreenPath = path.join(screensDir, "tiramisu-explorer-tx.png");
    await page.screenshot({ path: txScreenPath });
    console.log(`   ✓ Saved screenshot to: docs/screens/tiramisu-explorer-tx.png`);
  } catch (err: any) {
    console.error(`   ❌ Failed to load tx explorer:`, err.message);
  }

  // 2. Test data.arkiv.network
  const dataUrl = `https://data.arkiv.network/?q=${ENTITY_KEY}&chain=tiramisu`;
  console.log(`\n2. Testing Arkiv Data Explorer URL: ${dataUrl}`);
  try {
    const res = await page.goto(dataUrl, { waitUntil: "domcontentloaded", timeout: 25000 });
    await new Promise((r) => setTimeout(r, 4000));
    const status = res?.status();
    const title = await page.title();
    console.log(`   Status : ${status}`);
    console.log(`   Title  : ${title}`);

    const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log(`   Snippet: ${bodySnippet.replace(/\n+/g, " ").slice(0, 150)}...`);

    const entityScreenPath = path.join(screensDir, "data-arkiv-entity.png");
    await page.screenshot({ path: entityScreenPath });
    console.log(`   ✓ Saved screenshot to: docs/screens/data-arkiv-entity.png`);
  } catch (err: any) {
    console.error(`   ❌ Failed to load data explorer:`, err.message);
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
