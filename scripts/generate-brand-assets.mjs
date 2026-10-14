/**
 * scripts/generate-brand-assets.mjs
 *
 * Generates web branding assets from src/assets/SlotBazaar Gradient Logo.png:
 * - public/logo.png (optimized original, under 200 KB)
 * - public/favicon-32x32.png (32x32)
 * - public/favicon-192x192.png (192x192)
 * - public/apple-touch-icon.png (180x180)
 * - public/favicon.ico (32x32)
 * - public/og-image.png (1200x630 on #FBF7F0 background with tagline, under 200 KB)
 */

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const CHROME_PATH = fs.existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
  ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
  : "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const SOURCE_LOGO = path.resolve(REPO_ROOT, "src/assets/SlotBazaar Gradient Logo.png");
const PUBLIC_DIR = path.resolve(REPO_ROOT, "public");

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const logoBase64 = fs.readFileSync(SOURCE_LOGO).toString("base64");
  const logoDataUri = `data:image/png;base64,${logoBase64}`;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  // Crop location icon from source image (removes bottom "SlotBazaar" name)
  console.log("Cropping location icon from source logo (removing bottom name)...");
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; background:transparent;">
        <canvas id="c"></canvas>
      </body>
    </html>
  `);
  const iconDataUri = await page.evaluate((b64) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Icon bounding box: minX: 511, maxX: 1158, minY: 35, maxY: 819
        // Add slight margin around icon: sx=490, sy=25, sw=685, sh=795
        const sx = 490;
        const sy = 25;
        const sw = 1175 - 490; // 685
        const sh = 820 - 25;   // 795
        const canvas = document.getElementById("c");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, sw, sh);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = "data:image/png;base64," + b64;
    });
  }, logoBase64);

  // 1. Generate optimized logo.png (clean icon only, transparent, under 200 KB)
  console.log("Generating public/logo.png (icon only)...");
  await page.setViewport({ width: 400, height: 464, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent; display: flex; align-items: center; justify-content: center; width: 400px; height: 464px; overflow: hidden; }
          img { max-width: 100%; max-height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${iconDataUri}" alt="SlotBazaar Logo" />
      </body>
    </html>
  `);
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
  const logoBuf = await page.screenshot({ omitBackground: true, type: "png" });
  fs.writeFileSync(path.join(PUBLIC_DIR, "logo.png"), logoBuf);

  // 2. Generate 192x192 favicon (icon only)
  console.log("Generating public/favicon-192x192.png...");
  await page.setViewport({ width: 192, height: 192, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent; display: flex; align-items: center; justify-content: center; width: 192px; height: 192px; }
          img { width: 172px; height: 172px; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${iconDataUri}" />
      </body>
    </html>
  `);
  const fav192 = await page.screenshot({ omitBackground: true, type: "png" });
  fs.writeFileSync(path.join(PUBLIC_DIR, "favicon-192x192.png"), fav192);

  // 3. Generate 32x32 favicon (icon only)
  console.log("Generating public/favicon-32x32.png...");
  await page.setViewport({ width: 32, height: 32, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: transparent; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; }
          img { width: 30px; height: 30px; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${iconDataUri}" />
      </body>
    </html>
  `);
  const fav32 = await page.screenshot({ omitBackground: true, type: "png" });
  fs.writeFileSync(path.join(PUBLIC_DIR, "favicon-32x32.png"), fav32);
  fs.writeFileSync(path.join(PUBLIC_DIR, "favicon.ico"), fav32);

  // 4. Generate 180x180 apple-touch-icon (icon only on #FBF7F0)
  console.log("Generating public/apple-touch-icon.png...");
  await page.setViewport({ width: 180, height: 180, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #FBF7F0; display: flex; align-items: center; justify-content: center; width: 180px; height: 180px; border-radius: 36px; overflow: hidden; }
          img { width: 144px; height: 144px; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${iconDataUri}" />
      </body>
    </html>
  `);
  const appleTouch = await page.screenshot({ omitBackground: false, type: "png" });
  fs.writeFileSync(path.join(PUBLIC_DIR, "apple-touch-icon.png"), appleTouch);

  // 5. Generate og-image.png (1200x630 on #FBF7F0 paper background)
  console.log("Generating public/og-image.png (1200x630)...");
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 1200px;
            height: 630px;
            background-color: #FBF7F0;
            background-image: 
              radial-gradient(#e5decf 1px, transparent 1px),
              radial-gradient(#e5decf 1px, #FBF7F0 1px);
            background-size: 40px 40px;
            background-position: 0 0, 20px 20px;
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 60px 80px;
            color: #1e293b;
            position: relative;
            overflow: hidden;
          }
          .header-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 8px 18px;
            background: #ffffff;
            border: 1px solid #e2d9c8;
            border-radius: 9999px;
            font-size: 16px;
            font-weight: 700;
            color: #475569;
            width: fit-content;
            box-shadow: 0 2px 4px rgba(0,0,0,0.03);
          }
          .pulse {
            width: 10px;
            height: 10px;
            background: #10b981;
            border-radius: 50%;
          }
          .content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 40px;
          }
          .text-col {
            flex: 1;
          }
          .logo-col {
            width: 380px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .logo-col img {
            width: 360px;
            height: auto;
            object-fit: contain;
            filter: drop-shadow(0 12px 24px rgba(37, 99, 235, 0.12));
          }
          h1 {
            font-size: 54px;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.15;
            letter-spacing: -0.02em;
            margin-bottom: 16px;
          }
          .tagline {
            font-size: 24px;
            color: #475569;
            line-height: 1.4;
            font-weight: 500;
            max-width: 620px;
          }
          .footer-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid #e2d9c8;
            padding-top: 24px;
            font-size: 16px;
            color: #64748b;
          }
          .pills {
            display: flex;
            gap: 12px;
          }
          .pill {
            padding: 6px 14px;
            background: #ffffff;
            border: 1px solid #e2d9c8;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            color: #1e293b;
          }
        </style>
      </head>
      <body>
        <div class="header-badge">
          <span class="pulse"></span>
          Live India Map · Powered by Arkiv Tiramisu (Chain ID: 7738577)
        </div>
        <div class="content">
          <div class="text-col">
            <h1>SlotBazaar</h1>
            <p class="tagline">Real-Time Expiring Industrial Capacity & Portable MSME Reputation on Arkiv</p>
          </div>
          <div class="logo-col">
            <img src="${iconDataUri}" alt="SlotBazaar Logo" />
          </div>
        </div>
        <div class="footer-bar">
          <div class="pills">
            <span class="pill">⏱️ Autonomous Consensus Expiration</span>
            <span class="pill">🏆 Mutual Signed Reputation</span>
            <span class="pill">🌐 Decentralized Discovery</span>
          </div>
          <div>slotbazaar.vercel.app</div>
        </div>
      </body>
    </html>
  `);
  await page.waitForNetworkIdle({ timeout: 6000 }).catch(() => {});
  const ogBuf = await page.screenshot({ omitBackground: false, type: "png" });
  fs.writeFileSync(path.join(PUBLIC_DIR, "og-image.png"), ogBuf);

  await browser.close();

  // Print generated file sizes
  console.log("\n=== Generated Assets ===");
  ["logo.png", "favicon-32x32.png", "favicon-192x192.png", "apple-touch-icon.png", "favicon.ico", "og-image.png"].forEach(f => {
    const s = fs.statSync(path.join(PUBLIC_DIR, f));
    console.log(`- public/${f}: ${s.size} bytes (${(s.size / 1024).toFixed(1)} KB)`);
  });
}

main().catch((err) => {
  console.error("Error generating brand assets:", err);
  process.exit(1);
});
