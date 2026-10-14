/**
 * scripts/measure-rpc-load-2min.ts
 *
 * Measures HTTP requests made to Arkiv RPC per minute over 2 minutes
 * in the foreground idle state with WebSocket connected.
 *
 * Usage: npx tsx scripts/measure-rpc-load-2min.ts
 */

import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = "http://localhost:5173";

async function run() {
  console.log("========================================================");
  console.log("  MEASURING FOREGROUND RPC REQUESTS PER MINUTE (2 MIN)");
  console.log("========================================================");

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  let rpcRequestCount = 0;
  const requestsPerMinute: number[] = [0, 0];
  let minuteIndex = 0;

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("rpc.tiramisu") || url.includes("arkiv.network")) {
      rpcRequestCount++;
      requestsPerMinute[minuteIndex]++;
    }
  });

  console.log(`Navigating to ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: "networkidle2" });
  await page.waitForSelector("#filter-slot-count", { timeout: 15000 });
  console.log("Page ready. Baseline load complete. Resetting counter and starting 2-minute measurement...");

  rpcRequestCount = 0;
  requestsPerMinute[0] = 0;
  requestsPerMinute[1] = 0;

  // Minute 1
  console.log("Monitoring Minute 1 (0-60s)...");
  await new Promise((r) => setTimeout(r, 60000));
  console.log(`  Minute 1 RPC requests: ${requestsPerMinute[0]}`);

  // Minute 2
  minuteIndex = 1;
  console.log("Monitoring Minute 2 (60-120s)...");
  await new Promise((r) => setTimeout(r, 60000));
  console.log(`  Minute 2 RPC requests: ${requestsPerMinute[1]}`);

  await browser.close();

  const total = requestsPerMinute[0] + requestsPerMinute[1];
  const avgPerMin = (total / 2).toFixed(1);

  console.log("\n========================================================");
  console.log("  RPC LOAD SUMMARY");
  console.log("========================================================");
  console.log(`Minute 1 : ${requestsPerMinute[0]} req/min`);
  console.log(`Minute 2 : ${requestsPerMinute[1]} req/min`);
  console.log(`Average  : ${avgPerMin} req/min`);
  console.log(`Status   : ${Number(avgPerMin) <= 15 ? "PASS (low load confirmed)" : "FAIL (high load)"}`);
}

run().catch((err) => {
  console.error("FATAL ERROR in RPC load runner:", err);
  process.exit(1);
});
