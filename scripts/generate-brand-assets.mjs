/**
 * scripts/generate-brand-assets.mjs
 *
 * Generates web branding assets from src/assets/SlotBazaar Gradient Logo.png:
 * - public/logo.png (optimized original, under 200 KB)
 * - public/favicon-32x32.png (32x32)
 * - public/favicon-192x192.png (192x192)
 * - public/apple-touch-icon.png (180x180)
 * - public/favicon.ico (32x32)
 * - public/og-image.png (1200x630 on #FBF7F0 background with top-left logo and interactive India capacity map browser preview)
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

const ORIGINAL_LOGO = path.resolve(REPO_ROOT, "src/assets/SlotBazaar Gradient Logo.png");
const SOURCE_LOGO = fs.existsSync(ORIGINAL_LOGO) ? ORIGINAL_LOGO : path.resolve(REPO_ROOT, "public/logo.png");
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

  let iconDataUri = logoDataUri;
  if (fs.existsSync(ORIGINAL_LOGO)) {
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
    iconDataUri = await page.evaluate((b64) => {
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
  } else {
    console.log("Using existing cropped icon public/logo.png...");
  }

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

  // 5. Generate og-image.png (1200x630 on #FBF7F0 paper background with top-left logo and India Map mockup)
  console.log("Generating public/og-image.png (1200x630)...");
  const ogScale = process.env.OG_SCALE ? parseInt(process.env.OG_SCALE) : 1;
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: ogScale });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 1200px;
            height: 630px;
            background-color: #FBF7F0;
            background-image: 
              radial-gradient(#e2d9c8 1px, transparent 1px),
              radial-gradient(#e2d9c8 1px, #FBF7F0 1px);
            background-size: 32px 32px;
            background-position: 0 0, 16px 16px;
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 40px 48px;
            color: #1B1A17;
            position: relative;
            overflow: hidden;
          }

          /* Ambient glow for right side */
          .bg-glow {
            position: absolute;
            right: 40px;
            top: 50%;
            transform: translateY(-50%);
            width: 650px;
            height: 520px;
            background: radial-gradient(circle, rgba(15, 139, 141, 0.08) 0%, rgba(245, 166, 35, 0.05) 50%, transparent 70%);
            pointer-events: none;
            z-index: 0;
          }

          /* Left Column */
          .left-col {
            width: 470px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            height: 100%;
            z-index: 10;
            padding: 6px 0;
          }

          .brand-row {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .brand-logo {
            width: 48px;
            height: 48px;
            object-fit: contain;
          }
          .brand-name {
            font-size: 34px;
            font-weight: 800;
            letter-spacing: -0.03em;
            color: #1B1A17;
            display: flex;
            align-items: baseline;
            gap: 8px;
          }
          .brand-badge {
            font-size: 11px;
            font-weight: 700;
            background: #E8452C;
            color: #ffffff;
            padding: 2px 7px;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            letter-spacing: 0.04em;
          }

          .network-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 14px;
            background: #ffffff;
            border: 1px solid #dfd5c2;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            width: fit-content;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            margin-top: 14px;
          }
          .pulse-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
          }

          .hero-text {
            margin: auto 0;
            padding: 10px 0;
          }
          h1 {
            font-size: 44px;
            font-weight: 800;
            line-height: 1.12;
            letter-spacing: -0.025em;
            color: #1B1A17;
            margin-bottom: 14px;
          }
          h1 span {
            color: #0F8B8D;
          }
          .tagline {
            font-size: 17px;
            line-height: 1.45;
            color: #524e46;
            font-weight: 500;
          }

          .features-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 18px;
          }
          .feature-pill {
            background: #ffffff;
            border: 1px solid #dfd5c2;
            border-radius: 6px;
            padding: 7px 10px;
            font-size: 12.5px;
            font-weight: 600;
            color: #2c2820;
            display: flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          }

          .footer-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid #dfd5c2;
            padding-top: 14px;
            font-size: 13px;
            color: #78716c;
            font-weight: 600;
          }
          .footer-url {
            color: #0F8B8D;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12.5px;
          }

          /* Right Column: Browser Window */
          .right-col {
            width: 610px;
            height: 530px;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .browser-frame {
            width: 100%;
            height: 100%;
            background: #ffffff;
            border: 1px solid #cfc4b0;
            border-radius: 12px;
            box-shadow: 0 20px 45px -10px rgba(27, 26, 23, 0.16), 0 0 0 1px rgba(0,0,0,0.04);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
          }

          .browser-bar {
            height: 38px;
            background: #f6f1e8;
            border-bottom: 1px solid #dfd5c2;
            display: flex;
            align-items: center;
            padding: 0 14px;
            gap: 12px;
          }
          .window-dots {
            display: flex;
            gap: 6px;
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
          }
          .dot-red { background: #ef4444; }
          .dot-yellow { background: #f59e0b; }
          .dot-green { background: #10b981; }

          .browser-tab {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #ffffff;
            border: 1px solid #dfd5c2;
            border-bottom: none;
            padding: 5px 14px;
            border-radius: 6px 6px 0 0;
            font-size: 12px;
            font-weight: 700;
            color: #2c2820;
            margin-top: 6px;
          }
          .tab-dot {
            width: 6px;
            height: 6px;
            background: #0F8B8D;
            border-radius: 50%;
          }

          .browser-url {
            margin-left: auto;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #64748b;
            background: #ffffff;
            padding: 3px 10px;
            border: 1px solid #e2d9c8;
            border-radius: 4px;
          }

          .map-wrap {
            flex: 1;
            position: relative;
            background: #FBF7F0;
          }
          #leaflet-map {
            width: 100%;
            height: 100%;
            background: #FBF7F0;
          }

          /* OSM Tile Tinting (Paper Look matching SlotBazaar CSS) */
          .leaflet-tile-pane {
            filter: grayscale(0.8) sepia(0.2) brightness(1.05) contrast(0.95);
          }

          /* Custom Teardrop Marker */
          .pin-marker {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: 2.5px solid #1B1A17;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 8px rgba(0,0,0,0.18);
          }
          .pin-marker__inner {
            transform: rotate(45deg);
            font-size: 13px;
          }

          .pin-badge {
            position: absolute;
            top: -24px;
            left: 50%;
            transform: translateX(-50%);
            white-space: nowrap;
            background: #1B1A17;
            color: #ffffff;
            font-size: 10.5px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            font-family: 'Plus Jakarta Sans', sans-serif;
            letter-spacing: -0.01em;
          }
          .pin-badge::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 50%;
            transform: translateX(-50%);
            border-width: 3px 3px 0;
            border-style: solid;
            border-color: #1B1A17 transparent transparent;
          }

          /* Floating Preview Card */
          .floating-card {
            position: absolute;
            bottom: 14px;
            right: 14px;
            width: 255px;
            background: #ffffff;
            border: 1.5px solid #1B1A17;
            border-radius: 6px;
            padding: 10px 12px;
            box-shadow: 0 8px 20px rgba(27, 26, 23, 0.2);
            z-index: 1000;
            font-family: 'Plus Jakarta Sans', sans-serif;
          }
          .fc-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .fc-cat {
            font-size: 10px;
            font-weight: 700;
            color: #0F8B8D;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          .fc-time {
            font-size: 11px;
            font-weight: 700;
            color: #E8452C;
            background: rgba(232, 69, 44, 0.1);
            padding: 1px 6px;
            border-radius: 3px;
            font-family: 'JetBrains Mono', monospace;
          }
          .fc-title {
            font-size: 13px;
            font-weight: 800;
            color: #1B1A17;
            line-height: 1.25;
            margin-bottom: 6px;
          }
          .fc-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-top: 1px dashed #e2d9c8;
            padding-top: 6px;
            font-size: 10.5px;
            font-weight: 600;
            color: #64748b;
          }
          .fc-badge {
            color: #0F8B8D;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="bg-glow"></div>

        <!-- Left Column -->
        <div class="left-col">
          <div>
            <div class="brand-row">
              <img src="${iconDataUri}" class="brand-logo" alt="Logo" />
              <div class="brand-name">
                SlotBazaar
                <span class="brand-badge">ARKIV</span>
              </div>
            </div>
            <div class="network-pill">
              <span class="pulse-dot"></span>
              Live on Arkiv Tiramisu · Chain 7738577
            </div>
          </div>

          <div class="hero-text">
            <h1>Real-Time Expiring <span>Industrial Capacity</span></h1>
            <p class="tagline">Decentralized idle machine hours, transport freight & verifiable MSME reputation across India on Arkiv.</p>

            <div class="features-grid">
              <div class="feature-pill">⏱️ Autonomous Expiration</div>
              <div class="feature-pill">🏆 Two-Sided Reputation</div>
              <div class="feature-pill">🛡️ 100% On-Chain State</div>
              <div class="feature-pill">🇮🇳 5 Industrial Clusters</div>
            </div>
          </div>

          <div class="footer-info">
            <div>Global Tour Devcon · Pre-Devcon Hackathon</div>
            <div class="footer-url">slotbazaar.vercel.app</div>
          </div>
        </div>

        <!-- Right Column: Browser Window with India Map -->
        <div class="right-col">
          <div class="browser-frame">
            <!-- Window Bar -->
            <div class="browser-bar">
              <div class="window-dots">
                <span class="dot dot-red"></span>
                <span class="dot dot-yellow"></span>
                <span class="dot dot-green"></span>
              </div>
              <div class="browser-tab">
                <span class="tab-dot"></span>
                <span>India Capacity Map</span>
              </div>
              <div class="browser-url">
                <span>🔒 slotbazaar.vercel.app</span>
              </div>
            </div>

            <!-- Leaflet Map Container -->
            <div class="map-wrap">
              <div id="leaflet-map"></div>

              <!-- Floating Live Card -->
              <div class="floating-card">
                <div class="fc-header">
                  <span class="fc-cat">⚙️ Machine Hour</span>
                  <span class="fc-time">🔴 01:42:15</span>
                </div>
                <div class="fc-title">Precision 4-Axis CNC Milling</div>
                <div class="fc-footer">
                  <span>Jeedimetla (Hyd) · 0.05 GLM</span>
                  <span class="fc-badge">🏆 1 Verified Job</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <script>
          // Initialize Leaflet Map focused squarely on India
          const map = L.map('leaflet-map', {
            zoomControl: false,
            attributionControl: false,
            scrollWheelZoom: false,
            dragging: false,
            doubleClickZoom: false
          }).setView([21.5, 79.0], 4.8);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
          }).addTo(map);

          // 5 Industrial Hub Pins
          const clusters = [
            { name: "Ludhiana", sub: "Auto Tools", lat: 30.9010, lon: 75.8573, color: "#F5A623", icon: "⚙" },
            { name: "Morbi", sub: "Ceramics", lat: 22.8173, lon: 70.8370, color: "#F5A623", icon: "⚙" },
            { name: "Surat", sub: "Textiles", lat: 21.1702, lon: 72.8311, color: "#0F8B8D", icon: "🚚" },
            { name: "Jeedimetla", sub: "CNC Hub", lat: 17.5190, lon: 78.4480, color: "#E8452C", icon: "⚙", pulse: true },
            { name: "Tiruppur", sub: "Knitwear", lat: 11.1085, lon: 77.3411, color: "#3B3F9E", icon: "💻" }
          ];

          clusters.forEach(c => {
            const html = '<div style="position:relative; width:32px; height:32px;">' +
              '<div class="pin-badge">' + c.name + '</div>' +
              '<div class="pin-marker" style="background:' + c.color + '; color:#1B1A17;">' +
                '<div class="pin-marker__inner" style="font-weight:bold; color:#1B1A17;">' + c.icon + '</div>' +
              '</div>' +
            '</div>';
            const icon = L.divIcon({
              className: 'custom-pin',
              html: html,
              iconSize: [32, 32],
              iconAnchor: [16, 32]
            });
            L.marker([c.lat, c.lon], { icon: icon }).addTo(map);
          });
        </script>
      </body>
    </html>
  `);
  await page.waitForNetworkIdle({ timeout: 10000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
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
