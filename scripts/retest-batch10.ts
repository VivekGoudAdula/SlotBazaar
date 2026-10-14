/**
 * scripts/retest-batch10.ts
 *
 * Runs batch of 10 (seed_batch="dev-probe") at least 3 distinct times on Arkiv Tiramisu.
 * Records exact success/failure, error text, tx hash, elapsed time, and GLM spent.
 */

import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64, i32, bool } from "@arkiv-network/sdk/attr";
import { http, formatEther, type Hex, type Address } from "viem";
import { generateSeedSlots } from "../src/lib/seedGenerator.js";

async function executeBatch10(
  runNumber: number,
  wallet: any,
  publicClient: any,
  walletAddr: Address
) {
  console.log(`\n========================================================`);
  console.log(`  BATCH 10 RETEST — RUN #${runNumber}`);
  console.log(`========================================================`);

  const balBefore = await publicClient.getBalance({ address: walletAddr });
  const slots = generateSeedSlots({ count: 10, includeLong: true });

  const batchCreates = slots.map((s) => ({
    payload: jsonToPayload({
      title: s.title,
      description: s.description,
      seller_label: s.sellerLabel,
      schema_version: 1,
    }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("slot"),
      schema_v: str("1"),
      category: str(s.category),
      cluster: str(s.cluster),
      starts_at: u64(BigInt(s.startsAt)),
      ends_at: u64(BigInt(s.endsAt)),
      price_band: str(s.priceBand),
      lat_e4: i32(Math.round(s.lat * 10000)),
      lon_e4: i32(Math.round(s.lon * 10000)),
      synthetic: bool(true),
      seed_batch: str("dev-probe"), // Filtered from UI
    },
    expires: ExpirationTime.atDate(new Date(s.endsAt * 1000)),
  }));

  const startTime = Date.now();
  try {
    const res = await wallet.executeBatch({ creates: batchCreates });
    const elapsedMs = Date.now() - startTime;
    const balAfter = await publicClient.getBalance({ address: walletAddr });
    const spent = balBefore - balAfter;

    console.log(`  ✅ Run #${runNumber} SUCCESS!`);
    console.log(`  Tx Hash: ${res.txHash}`);
    console.log(`  Created Entities: ${res.createdEntities.length}`);
    console.log(`  Elapsed: ${elapsedMs} ms`);
    console.log(`  GLM Spent: ${formatEther(spent)} GLM`);
    console.log(`  Cost / Entity: ${formatEther(spent / 10n)} GLM`);

    return {
      run: runNumber,
      success: true,
      txHash: res.txHash,
      elapsedMs,
      spentGLM: formatEther(spent),
      costPerEntity: formatEther(spent / 10n),
    };
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    const errorText = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Run #${runNumber} FAILED after ${elapsedMs} ms:`);
    console.error(`  Error: ${errorText}`);

    return {
      run: runNumber,
      success: false,
      elapsedMs,
      error: errorText,
    };
  }
}

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.log("No PRIVATE_KEY configured in environment. Skipping batch 10 retest.");
    return;
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log(`Connecting to Arkiv Tiramisu: ${walletAddr}`);

  const publicClient = createPublicClient({
    chain: tiramisu,
    transport: http(),
  });

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const initialBal = await (publicClient as any).getBalance({ address: walletAddr });
  console.log(`Initial Balance: ${formatEther(initialBal)} GLM`);

  const results = [];
  for (let i = 1; i <= 3; i++) {
    const res = await executeBatch10(i, wallet, publicClient, walletAddr);
    results.push(res);
    if (i < 3) {
      console.log(`Pausing 10 seconds before next run...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }

  console.log(`\n========================================================`);
  console.log(`  BATCH 10 RETEST SUMMARY TABLE`);
  console.log(`========================================================`);
  console.log(`| Run # | Status | Elapsed (ms) | Tx Hash | GLM Spent | Exact Error / Notes |`);
  console.log(`|-------|--------|--------------|---------|-----------|---------------------|`);
  for (const r of results) {
    if (r.success) {
      console.log(`| Run #${r.run} | PASS | ${r.elapsedMs} | ${r.txHash?.slice(0, 14)}… | ${r.spentGLM} | Confirmed 10 entities |`);
    } else {
      console.log(`| Run #${r.run} | FAIL | ${r.elapsedMs} | — | — | ${r.error} |`);
    }
  }
}

main().catch((err) => {
  console.error("Batch 10 retest runner failed:", err);
  process.exit(1);
});
