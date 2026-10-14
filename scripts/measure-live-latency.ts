/**
 * scripts/measure-live-latency.ts
 *
 * Measures live-update latency with two Puppeteer pages:
 * - Page 1 (watching page): loads http://localhost:5173 and observes the DOM.
 * - Page 2 (context 2): second browser context.
 * - Script posts 5 slots sequentially to Arkiv Tiramisu.
 * - Measures exact time from transaction confirmation receipt to the new slot appearing in Page 1's DOM.
 *
 * Usage: npx tsx scripts/measure-live-latency.ts
 */

import "dotenv/config";
import puppeteer from "puppeteer-core";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64, i32, bool } from "@arkiv-network/sdk/attr";
import { http, type Hex, type Address } from "viem";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const TARGET_URL = "http://localhost:5173";

interface LatencyResult {
  sample: number;
  txHash: string;
  entityKey: string;
  confirmedAt: number;
  domAppearedAt: number;
  latencyMs: number;
}

async function run() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌ PRIVATE_KEY is required in .env");
    process.exit(1);
  }
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log("========================================================");
  console.log("  PHASE 10: MEASURING LIVE-UPDATE DOM LATENCY");
  console.log("========================================================");
  console.log(`Wallet     : ${walletAddr}`);
  console.log(`Target URL : ${TARGET_URL}`);

  const publicClient = createPublicClient({
    chain: tiramisu,
    transport: http("https://rpc.tiramisu.db-chain.testnet.arkiv.network"),
  });

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http("https://rpc.tiramisu.db-chain.testnet.arkiv.network"),
    account,
  });

  console.log("\nLaunching Chrome with two browser contexts...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  // Context 1: Watching page
  const context1 = await browser.createBrowserContext();
  const watchingPage = await context1.newPage();
  await watchingPage.setViewport({ width: 1280, height: 800 });

  // Context 2: Second page
  const context2 = await browser.createBrowserContext();
  const postingPage = await context2.newPage();
  await postingPage.setViewport({ width: 1280, height: 800 });

  console.log("Loading watching page at http://localhost:5173...");
  await watchingPage.goto(TARGET_URL, { waitUntil: "networkidle2" });
  await postingPage.goto(TARGET_URL, { waitUntil: "networkidle2" });

  // Wait for initial slots to load
  await watchingPage.waitForSelector("#filter-slot-count", { timeout: 15000 });
  console.log("Watching page ready. Initial slot count element rendered.");

  // Open slide-over list so cards are present in DOM
  try {
    const listBtn = await watchingPage.$("#filter-bar-list-btn");
    if (listBtn) {
      await listBtn.click();
      await new Promise((r) => setTimeout(r, 600));
    }
  } catch (err) {
    console.warn("Could not toggle list drawer:", err);
  }

  const results: LatencyResult[] = [];
  const TOTAL_SAMPLES = 5;

  for (let i = 1; i <= TOTAL_SAMPLES; i++) {
    const testId = `T${Date.now().toString().slice(-6)}_${i}`;
    const slotTitle = `[LAT-${i}] Latency Slot ${testId}`;
    console.log(`\n--- Sample ${i}/${TOTAL_SAMPLES}: Creating on-chain slot "${slotTitle}" ---`);

    const nowSec = Math.floor(Date.now() / 1000);
    const startsAt = nowSec - 300;
    const endsAt = nowSec + 3600; // 1 hour

    // 1. Post slot via Arkiv SDK
    const result = await wallet.createEntity({
      payload: jsonToPayload({
        title: slotTitle,
        description: `Automated live latency measurement sample ${i}`,
        seller_label: "Surat CNC Probe",
        schema_version: 1,
      }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("slot"),
        schema_v: str("1"),
        category: str("machine"),
        cluster: str("surat"),
        starts_at: u64(BigInt(startsAt)),
        ends_at: u64(BigInt(endsAt)),
        price_band: str("mid"),
        lat_e4: i32(Math.round(21.1702 * 10000)),
        lon_e4: i32(Math.round(72.8311 * 10000)),
        synthetic: bool(true),
        seed_batch: str("latency-probe"),
      },
      expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
    });

    console.log(`  Tx submitted: ${result.txHash} (key: ${result.entityKey.slice(0, 14)}...)`);
    console.log(`  Waiting for transaction confirmation...`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: result.txHash });
    const confirmedAt = Date.now();
    console.log(`  ✓ Confirmed in block ${receipt.blockNumber} at ${new Date(confirmedAt).toISOString()}`);

    // 2. Measure time until slot appears in watching page DOM
    console.log(`  Waiting for slot to appear in watching page DOM...`);
    try {
      await watchingPage.waitForFunction(
        (target) => document.body.innerText.includes(target),
        { timeout: 35000, polling: 50 },
        slotTitle
      );
      const domAppearedAt = Date.now();
      const latencyMs = domAppearedAt - confirmedAt;
      console.log(`  ✓ Appeared in DOM at ${new Date(domAppearedAt).toISOString()} (Latency: ${latencyMs} ms / ${(latencyMs / 1000).toFixed(2)} s)`);

      results.push({
        sample: i,
        txHash: result.txHash,
        entityKey: result.entityKey,
        confirmedAt,
        domAppearedAt,
        latencyMs,
      });
    } catch (err) {
      console.error(`  ❌ Timeout waiting for slot in DOM:`, err);
      results.push({
        sample: i,
        txHash: result.txHash,
        entityKey: result.entityKey,
        confirmedAt,
        domAppearedAt: 0,
        latencyMs: -1,
      });
    }

    if (i < TOTAL_SAMPLES) {
      console.log("  Waiting 15 seconds cooldown before next sample...");
      await new Promise((r) => setTimeout(r, 15000));
    }
  }

  await browser.close();

  console.log("\n========================================================");
  console.log("  LATENCY MEASUREMENT RESULTS (AFTER LEADING-EDGE FIX)");
  console.log("========================================================");
  console.log("| Sample | Tx Hash | Confirmed At | DOM Appeared At | Latency (s) |");
  console.log("|---|---|---|---|---|");
  for (const r of results) {
    const latStr = r.latencyMs >= 0 ? (r.latencyMs / 1000).toFixed(2) : "TIMED OUT";
    console.log(`| ${r.sample} | \`${r.txHash.slice(0, 10)}...${r.txHash.slice(-6)}\` | ${new Date(r.confirmedAt).toLocaleTimeString()} | ${r.domAppearedAt ? new Date(r.domAppearedAt).toLocaleTimeString() : "N/A"} | ${latStr} s |`);
  }

  const validLatencies = results.filter((r) => r.latencyMs >= 0).map((r) => r.latencyMs);
  if (validLatencies.length > 0) {
    validLatencies.sort((a, b) => a - b);
    const median = validLatencies[Math.floor(validLatencies.length / 2)];
    const avg = validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length;
    console.log(`\nMin: ${(validLatencies[0] / 1000).toFixed(2)}s | Max: ${(validLatencies[validLatencies.length - 1] / 1000).toFixed(2)}s | Median: ${(median / 1000).toFixed(2)}s | Mean: ${(avg / 1000).toFixed(2)}s`);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR in latency runner:", err);
  process.exit(1);
});
