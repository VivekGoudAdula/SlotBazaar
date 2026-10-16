/**
 * arkiv/repro/slot-count-stability.ts
 *
 * Diagnoses RPC listing stability:
 * Queries live slots (project="slotbazaar", entity_type="slot", ends_at > nowSec)
 * across all pages pinned to the current block number 10 times, 3 seconds apart.
 *
 * Uses ONLY createPublicClient from @arkiv-network/sdk.
 *
 * Prints per run:
 * - Run index
 * - Block number returned
 * - Entity count
 * - Short hash of sorted keys (sha256 slice)
 *
 * Saves raw output to arkiv/repro/logs/slot-count-stability.txt.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64 } from "@arkiv-network/sdk/attr";
import { and, eq, gt } from "@arkiv-network/sdk/query";
import { http } from "viem";

const RUNS = 10;
const DELAY_MS = 3000;
const LOG_PATH = path.resolve(process.cwd(), "arkiv/repro/logs/slot-count-stability.txt");

async function main() {
  const envKey = process.env.VITE_ARKIV_API_KEY || process.env.ARKIV_API_KEY || "";
  const envRpc = process.env.VITE_RPC_URL;
  let rpcUrl = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
  if (envRpc) {
    rpcUrl = envKey && !envRpc.includes(envKey) ? `${envRpc.replace(/\/+$/, "")}/${envKey}` : envRpc;
  } else if (envKey) {
    rpcUrl = `https://rpc.tiramisu.db-chain.testnet.arkiv.network/${envKey}`;
  }

  const client = createPublicClient({
    chain: tiramisu,
    transport: http(rpcUrl, { timeout: 15_000 }),
  });

  const lines: string[] = [];
  function log(msg: string) {
    console.log(msg);
    lines.push(msg);
  }

  log("================================================================================");
  log("                    ARKIV RPC SLOT COUNT STABILITY REPRO                        ");
  log("================================================================================");
  log(`Timestamp      : ${new Date().toISOString()}`);
  log(`RPC Endpoint   : ${rpcUrl.replace(/ark_live_[A-Za-z0-9]+/g, "ark_live_***")}`);
  log(`Runs           : ${RUNS} iterations, ${DELAY_MS / 1000}s interval`);
  log(`Query Filter   : project="slotbazaar" AND entity_type="slot" AND ends_at > nowSec`);
  log(`Block Pinning  : atBlock(pinnedBlock) per run`);
  log("--------------------------------------------------------------------------------");
  log("Run | Pinned Block | Page Count | Total Slots | Sorted Keys SHA-256 (12 chars)");
  log("----+--------------+------------+-------------+-------------------------------");

  const results: { run: number; block: bigint; count: number; hash: string }[] = [];

  for (let i = 1; i <= RUNS; i++) {
    const pinnedBlock = await client.getBlockNumber();
    const nowSec = Math.floor(Date.now() / 1000);

    let queryRes = await client
      .select({ key: true })
      .where(
        and(
          eq("project", str("slotbazaar")),
          eq("entity_type", str("slot")),
          gt("ends_at", u64(nowSec))
        )
      )
      .atBlock(pinnedBlock)
      .fetch();

    let pageCount = 1;
    const allKeys: string[] = queryRes.entities.map((e) => (e as { key: string }).key.toLowerCase());

    while (queryRes.hasNextPage()) {
      queryRes = await queryRes.nextPage();
      pageCount++;
      for (const e of queryRes.entities) {
        allKeys.push((e as { key: string }).key.toLowerCase());
      }
    }

    allKeys.sort();
    const keyHash = crypto
      .createHash("sha256")
      .update(allKeys.join(","))
      .digest("hex")
      .slice(0, 12);

    results.push({ run: i, block: pinnedBlock, count: allKeys.length, hash: keyHash });

    const runStr = String(i).padStart(3, " ");
    const blockStr = String(pinnedBlock).padStart(12, " ");
    const pageStr = String(pageCount).padStart(10, " ");
    const countStr = String(allKeys.length).padStart(11, " ");
    const hashStr = keyHash.padStart(31, " ");

    log(`${runStr} | ${blockStr} | ${pageStr} | ${countStr} | ${hashStr}`);

    if (i < RUNS) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  log("--------------------------------------------------------------------------------");
  log("\nSTABILITY VERDICT ANALYSIS:");

  let blockMonotonic = true;
  let blockRegressed = false;
  let countVarying = false;
  let keysVarying = false;

  for (let i = 1; i < results.length; i++) {
    if (results[i].block < results[i - 1].block) {
      blockMonotonic = false;
      blockRegressed = true;
    }
    if (results[i].count !== results[0].count) {
      countVarying = true;
    }
    if (results[i].hash !== results[0].hash) {
      keysVarying = true;
    }
  }

  log(`Block Monotonicity : ${blockMonotonic ? "PASS (Blocks advance monotonically forward)" : "FAIL (Block regressed backwards!)"}`);
  log(`Count Stability    : ${countVarying ? "VARYING COUNTS DETECTED" : `STABLE (Identical count of ${results[0]?.count ?? 0} across all runs)`}`);
  log(`Key Hash Identity  : ${keysVarying ? "KEY SET SHIFTED" : `IDENTICAL (${results[0]?.hash ?? "N/A"})`}`);
  log("================================================================================");

  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, lines.join("\n") + "\n", "utf-8");
  console.log(`\nRaw log written to ${LOG_PATH}`);
}

main().catch((err) => {
  console.error("Diagnosis script failed:", err);
  process.exit(1);
});
