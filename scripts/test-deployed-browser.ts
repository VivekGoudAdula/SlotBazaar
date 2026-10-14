/**
 * scripts/test-deployed-browser.ts
 *
 * Automated verification of deployed site: https://slotbazaar.vercel.app
 * Uses puppeteer-core to test:
 * 1. Fresh profile load (no wallet)
 * 2. Time to first pin visible
 * 3. All console errors & failed requests
 * 4. HTTP and WebSocket status from https origin
 * 5. Measured RPC load: 3-minute request counts in 3 states (healthy, WS blocked, tab hidden)
 */

import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = "https://slotbazaar.vercel.app";

async function run() {
  console.log("========================================================");
  console.log(`  STARTING DEPLOYED ORIGIN TEST: ${TARGET_URL}`);
  console.log("========================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs: { type: string; text: string }[] = [];
  const failedRequests: { url: string; errorText: string }[] = [];
  const httpRpcResponses: { url: string; status: number }[] = [];
  let wsConnected = false;
  let wsError: string | null = null;

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });
    if (text.includes("WebSocket") || text.includes("Socket")) {
      console.log(`  [Page Log] ${text}`);
    }
  });

  page.on("requestfailed", (req) => {
    failedRequests.push({
      url: req.url(),
      errorText: req.failure()?.errorText || "unknown failure",
    });
  });

  page.on("response", (res) => {
    const url = res.url();
    if (url.includes("rpc.tiramisu")) {
      httpRpcResponses.push({ url, status: res.status() });
    }
  });

  // Track WebSockets via CDP
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");

  client.on("Network.webSocketCreated", (params: any) => {
    console.log(`[CDP] WebSocket Created: ${params.url}`);
  });

  client.on("Network.webSocketHandshakeResponseReceived", (params: any) => {
    console.log(`[CDP] WebSocket Handshake status: ${params.response?.status}`);
    if (params.response?.status === 101) {
      wsConnected = true;
    }
  });

  client.on("Network.webSocketClosed", (params: any) => {
    console.log(`[CDP] WebSocket Closed at ${params.timestamp}`);
  });

  client.on("Network.webSocketFrameError", (params: any) => {
    console.log(`[CDP] WebSocket Error: ${params.errorMessage}`);
    wsError = params.errorMessage;
  });

  console.log(`\nNavigating to ${TARGET_URL}...`);
  const t0 = Date.now();
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  const domLoadedMs = Date.now() - t0;
  console.log(`DOM loaded in ${domLoadedMs} ms.`);

  // Wait for header and initial render
  await page.waitForSelector("#app-header", { timeout: 15000 });
  console.log("Header element visible.");

  // Wait for first marker pin visible
  console.log("Waiting for first map marker pin to appear (.leaflet-marker-icon)...");
  let pinElapsed = 0;
  try {
    await page.waitForSelector(".leaflet-marker-icon", { timeout: 20000 });
    pinElapsed = Date.now() - t0;
    console.log(`✅ First pin visible at ${pinElapsed} ms from navigation start.`);
  } catch (err) {
    console.warn("⚠️ Timed out waiting for .leaflet-marker-icon.");
  }

  // Count visible markers
  const markerCount = await page.evaluate(() => {
    return document.querySelectorAll(".leaflet-marker-icon").length;
  });
  console.log(`Total visible marker elements on map: ${markerCount}`);

  // Check socket pill text (LIVE vs POLLING)
  let pillText = "";
  try {
    await page.waitForFunction(
      () => {
        const el = document.getElementById("header-block-pill");
        return el && (el.innerText.includes("LIVE") || el.innerText.includes("POLLING"));
      },
      { timeout: 10000 }
    );
    pillText = await page.evaluate(() => {
      const el = document.getElementById("header-block-pill");
      return el ? el.innerText.trim() : "";
    });
    console.log(`Header block pill text: "${pillText}"`);
  } catch {
    console.log("Pill text timeout");
  }

  // Report console errors
  console.log("\n── Console Errors ──");
  const errors = consoleLogs.filter((l) => l.type === "error");
  if (errors.length === 0) {
    console.log("  ✅ Zero console errors.");
  } else {
    for (const e of errors) {
      console.log(`  ❌ [${e.type}] ${e.text}`);
    }
  }

  // Report failed network requests
  console.log("\n── Failed Network Requests ──");
  if (failedRequests.length === 0) {
    console.log("  ✅ Zero failed network requests.");
  } else {
    for (const f of failedRequests) {
      console.log(`  ❌ ${f.url} — ${f.errorText}`);
    }
  }

  // Report HTTP RPC and WebSocket status
  console.log("\n── Tiramisu RPC Connectivity from HTTPS Deployed Origin ──");
  console.log(`  HTTP RPC Requests observed: ${httpRpcResponses.length}`);
  const httpSuccessCount = httpRpcResponses.filter((r) => r.status === 200).length;
  console.log(`  HTTP RPC Status 200: ${httpSuccessCount} / ${httpRpcResponses.length}`);
  console.log(`  WebSocket Connected (101): ${wsConnected}`);
  if (wsError) console.log(`  WebSocket Error: ${wsError}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. MEASURED RPC LOAD: 3-minute request counts in each of 3 states
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n========================================================");
  console.log("  MEASURING REAL RPC REQUEST LOAD (3-MINUTE SAMPLES)");
  console.log("========================================================");

  async function measureRpcForMinutes(
    pageInstance: puppeteer.Page,
    stateName: string,
    minutes: number
  ): Promise<number[]> {
    console.log(`\nMeasuring state: "${stateName}" for ${minutes} minute(s)...`);
    const minuteCounts: number[] = [];

    for (let m = 1; m <= minutes; m++) {
      let rpcCount = 0;
      const countListener = (res: any) => {
        if (res.url().includes("rpc.tiramisu")) {
          rpcCount++;
        }
      };
      pageInstance.on("response", countListener);

      console.log(`  [${stateName}] Sampling Minute ${m}/${minutes}...`);
      await new Promise((r) => setTimeout(r, 60000));

      pageInstance.off("response", countListener);
      minuteCounts.push(rpcCount);
      console.log(`  [${stateName}] Minute ${m} request count: ${rpcCount}`);
    }

    return minuteCounts;
  }

  // State 1: Foreground idle with WebSocket healthy
  console.log("\n[STATE 1] Foreground Idle with WebSocket Healthy");
  const state1Counts = await measureRpcForMinutes(page, "Foreground Idle (WS Healthy)", 3);

  // State 2: Foreground with WebSocket blocked
  console.log("\n[STATE 2] Foreground with WebSocket Blocked");
  const wsBlockedPage = await browser.newPage();
  await wsBlockedPage.setViewport({ width: 1280, height: 800 });
  const blockedClient = await wsBlockedPage.target().createCDPSession();
  await blockedClient.send("Network.enable");
  // Block WebSocket traffic
  await blockedClient.send("Network.setBlockedURLs", {
    urls: ["*wss://rpc.tiramisu.db-chain.testnet.arkiv.network*"],
  });

  await wsBlockedPage.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await wsBlockedPage.waitForSelector("#app-header", { timeout: 15000 });
  const state2Counts = await measureRpcForMinutes(wsBlockedPage, "Foreground (WS Blocked)", 3);
  await wsBlockedPage.close();

  // State 3: Tab Hidden (backgrounded)
  console.log("\n[STATE 3] Tab Hidden (document.visibilityState === 'hidden')");
  const hiddenPage = await browser.newPage();
  await hiddenPage.setViewport({ width: 1280, height: 800 });
  await hiddenPage.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await hiddenPage.waitForSelector("#app-header", { timeout: 15000 });

  // Emulate tab hidden via document visibility
  await hiddenPage.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", writable: true });
    Object.defineProperty(document, "hidden", { value: true, writable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  const state3Counts = await measureRpcForMinutes(hiddenPage, "Tab Hidden", 3);
  await hiddenPage.close();

  await browser.close();

  console.log("\n========================================================");
  console.log("  MEASURED RPC SUMMARY TABLE");
  console.log("========================================================");
  console.log(`| State | Minute 1 | Minute 2 | Minute 3 | Average Req/Min |`);
  console.log(`|-------|----------|----------|----------|-----------------|`);
  const avg1 = (state1Counts.reduce((a, b) => a + b, 0) / state1Counts.length).toFixed(1);
  const avg2 = (state2Counts.reduce((a, b) => a + b, 0) / state2Counts.length).toFixed(1);
  const avg3 = (state3Counts.reduce((a, b) => a + b, 0) / state3Counts.length).toFixed(1);
  console.log(`| Foreground Idle (WS Healthy) | ${state1Counts[0]} | ${state1Counts[1]} | ${state1Counts[2]} | ${avg1} |`);
  console.log(`| Foreground (WS Blocked) | ${state2Counts[0]} | ${state2Counts[1]} | ${state2Counts[2]} | ${avg2} |`);
  console.log(`| Tab Hidden (Backgrounded) | ${state3Counts[0]} | ${state3Counts[1]} | ${state3Counts[2]} | ${avg3} |`);
}

run().catch((err) => {
  console.error("Deployed browser test failed:", err);
  process.exit(1);
});
