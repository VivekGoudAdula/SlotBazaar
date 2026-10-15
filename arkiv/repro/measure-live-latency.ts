/**
 * arkiv/repro/measure-live-latency.ts
 *
 * Measures live-update latency with two Puppeteer pages / browser contexts:
 * - Watching page: fresh browser context for each sample, loads TARGET_URL and observes the DOM.
 * - Script posts slots sequentially to Arkiv Tiramisu via WalletClient.
 * - Measures exact time from transaction confirmation receipt to the new slot appearing in watcher DOM.
 * - Pre-checks that watcher DOM does not contain the slot title before transaction broadcast.
 * - Handles timeouts as TIMEOUT rows.
 * - Computes true median (average of middle two for even n), p90, and max.
 *
 * Usage: npx tsx arkiv/repro/measure-live-latency.ts
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
const TARGET_URL = process.env.TARGET_URL || "http://localhost:5173";
const TOTAL_SAMPLES = 10;

interface LatencyResult {
  sample: number;
  txHash: string;
  entityKey: string;
  confirmedAt: number;
  domAppearedAt: number;
  latencyMs: number;
  note: string;
}

function computeMedian(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 0) {
    return (arr[mid - 1] + arr[mid]) / 2;
  }
  return arr[mid];
}

function computeP90(arr: number[]): number {
  if (arr.length === 0) return 0;
  const idx = Math.ceil(0.9 * arr.length) - 1;
  return arr[Math.max(0, Math.min(idx, arr.length - 1))];
}

async function run() {
  const runDate = new Date().toISOString();
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌ PRIVATE_KEY is required in .env");
    process.exit(1);
  }
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log("========================================================");
  console.log("  PHASE 14: MEASURING LIVE-UPDATE DOM LATENCY (10 SAMPLES)");
  console.log("========================================================");
  console.log(`Run Date       : ${runDate}`);
  console.log(`SDK Version    : 0.8.1`);
  console.log(`Viem Version   : 2.57.4`);
  console.log(`Wallet         : ${walletAddr}`);
  console.log(`Target URL     : ${TARGET_URL}`);
  console.log(`Target Note    : Localhost dev server (active Phase 14 30s-fallback poll fix; deployed site not updated because git push is forbidden)`);
  console.log(`Total Samples  : ${TOTAL_SAMPLES}`);

  const publicClient = createPublicClient({
    chain: tiramisu,
    transport: http("https://rpc.tiramisu.db-chain.testnet.arkiv.network"),
  });

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http("https://rpc.tiramisu.db-chain.testnet.arkiv.network"),
    account,
  });

  console.log("\nLaunching Chrome headless browser...");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results: LatencyResult[] = [];

  for (let i = 1; i <= TOTAL_SAMPLES; i++) {
    const testId = `T${Date.now().toString().slice(-6)}_${i}`;
    const slotTitle = `[LAT-${i}] Latency Slot ${testId}`;
    console.log(`\n--- Sample ${i}/${TOTAL_SAMPLES}: Testing "${slotTitle}" ---`);

    // Fresh browser context for the watcher for each sample
    const watcherContext = await browser.createBrowserContext();
    const watchingPage = await watcherContext.newPage();
    await watchingPage.setViewport({ width: 1280, height: 800 });

    try {
      await watchingPage.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
      await watchingPage.waitForSelector("#filter-slot-count", { timeout: 15000 });

      // Open drawer so cards exist in DOM
      try {
        const listBtn = await watchingPage.$("#filter-bar-list-btn");
        if (listBtn) {
          await listBtn.click();
          await new Promise((r) => setTimeout(r, 600));
        }
      } catch (err) {
        console.warn("  Could not toggle list drawer:", err);
      }

      // Pre-check: Ensure slot is NOT already in watcher DOM
      const preExists = await watchingPage.evaluate(
        (target) => document.body.innerText.includes(target),
        slotTitle
      );
      if (preExists) {
        console.log(`  [ALERT] Slot already present in watcher DOM before broadcast!`);
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const startsAt = nowSec - 300;
      const endsAt = nowSec + 3600; // 1 hour

      // 1. Post slot via Arkiv SDK
      const createPromise = wallet.createEntity({
        payload: jsonToPayload({
          title: slotTitle,
          description: `Live latency sample ${i}`,
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
          seed_batch: str("latency-run2"),
        },
        expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
      });

      const result = await createPromise;
      console.log(`  Tx submitted: ${result.txHash} (entityKey: ${result.entityKey.slice(0, 14)}...)`);

      // 2. Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: result.txHash });
      const confirmedAt = Date.now();
      console.log(`  Confirmed in block ${receipt.blockNumber} at ${new Date(confirmedAt).toISOString()}`);

      // 3. Measure time until slot appears in watcher DOM (35s timeout)
      let domAppearedAt = 0;
      let latencyMs = -1;
      let note = "";

      try {
        await watchingPage.waitForFunction(
          (target) => document.body.innerText.includes(target),
          { timeout: 35000, polling: 50 },
          slotTitle
        );
        domAppearedAt = Date.now();
        latencyMs = domAppearedAt - confirmedAt;

        if (latencyMs < 300 && latencyMs >= 0) {
          note = "[FLAG: <0.3s concurrent with receipt]";
          console.log(`  Appeared in DOM: ${latencyMs} ms (${(latencyMs / 1000).toFixed(2)} s) ${note}`);
        } else if (latencyMs < 0) {
          note = "[FLAG: DOM rendered before receipt return]";
          console.log(`  Appeared in DOM: ${latencyMs} ms ${note}`);
        } else {
          note = "OK";
          console.log(`  Appeared in DOM: ${latencyMs} ms (${(latencyMs / 1000).toFixed(2)} s)`);
        }
      } catch (err) {
        console.log(`  TIMEOUT: Slot did not appear in watcher DOM within 35s`);
        note = "TIMEOUT";
      }

      results.push({
        sample: i,
        txHash: result.txHash,
        entityKey: result.entityKey,
        confirmedAt,
        domAppearedAt,
        latencyMs,
        note,
      });
    } finally {
      await watcherContext.close();
    }

    if (i < TOTAL_SAMPLES) {
      console.log("  Cooldown 12s before next sample...");
      await new Promise((r) => setTimeout(r, 12000));
    }
  }

  await browser.close();

  // Print results table
  console.log("\n========================================================");
  console.log("  LATENCY MEASUREMENT RESULTS (RUN 2)");
  console.log("========================================================");
  console.log("| Sample | Tx Hash | Confirmed At | DOM Appeared At | Latency (s) | Notes |");
  console.log("|:------:|:--------|:-------------|:----------------|:-----------:|:------|");

  for (const r of results) {
    const latStr = r.latencyMs >= 0 ? (r.latencyMs / 1000).toFixed(2) : "TIMEOUT";
    const confTime = new Date(r.confirmedAt).toLocaleTimeString();
    const domTime = r.domAppearedAt ? new Date(r.domAppearedAt).toLocaleTimeString() : "N/A";
    const shortTx = `\`${r.txHash.slice(0, 8)}...${r.txHash.slice(-6)}\``;
    console.log(`| ${r.sample} | ${shortTx} | ${confTime} | ${domTime} | ${latStr} | ${r.note} |`);
  }

  // Statistics
  const completed = results.filter((r) => r.latencyMs >= 0);
  const timeouts = results.filter((r) => r.latencyMs < 0);
  const n_completed = completed.length;
  const n_timeouts = timeouts.length;

  const validSec = completed.map((r) => Math.max(0, r.latencyMs) / 1000).sort((a, b) => a - b);
  const median = computeMedian(validSec);
  const p90 = computeP90(validSec);
  const max = validSec.length > 0 ? validSec[validSec.length - 1] : 0;

  console.log("\n--- Latency Summary Statistics ---");
  console.log(`n_completed: ${n_completed}`);
  console.log(`n_timeouts: ${n_timeouts}`);
  console.log(`median: ${median.toFixed(2)} s`);
  console.log(`p90: ${p90.toFixed(2)} s`);
  console.log(`max: ${max.toFixed(2)} s`);
}

run().catch((err) => {
  console.error("FATAL ERROR in latency runner:", err);
  process.exit(1);
});
