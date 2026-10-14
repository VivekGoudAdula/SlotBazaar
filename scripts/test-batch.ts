/**
 * scripts/test-batch.ts
 *
 * Tests batch ceiling: executes real batch sizes of 10, 20, and 30 on Arkiv Tiramisu.
 * All slots marked with seed_batch="dev-probe" so they are filtered out from UI.
 * Records gas, GLM cost, elapsed time, and any error message.
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

async function testBatchSize(
  size: number,
  wallet: any,
  publicClient: any,
  walletAddr: Address
): Promise<{
  size: number;
  success: boolean;
  txHash?: string;
  count?: number;
  spentGLM?: string;
  costPerEntity?: string;
  elapsedMs?: number;
  error?: string;
}> {
  console.log(`\n========================================================`);
  console.log(`  TESTING BATCH SIZE: ${size} ENTITIES`);
  console.log(`========================================================`);

  const balBefore = await publicClient.getBalance({ address: walletAddr });
  const slots = generateSeedSlots({ count: size, includeLong: true });

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
      seed_batch: str("dev-probe"), // Excluded from production UI
    },
    expires: ExpirationTime.atDate(new Date(s.endsAt * 1000)),
  }));

  const startTime = Date.now();
  try {
    const res = await wallet.executeBatch({ creates: batchCreates });
    const elapsedMs = Date.now() - startTime;
    const balAfter = await publicClient.getBalance({ address: walletAddr });
    const spent = balBefore - balAfter;

    console.log(`  ✅ Batch Size ${size} SUCCEEDED!`);
    console.log(`  Tx Hash: ${res.txHash}`);
    console.log(`  Created Entities: ${res.createdEntities.length}`);
    console.log(`  Elapsed: ${elapsedMs} ms`);
    console.log(`  GLM Spent: ${formatEther(spent)} GLM`);
    console.log(`  Cost / Entity: ${formatEther(spent / BigInt(size))} GLM`);

    return {
      size,
      success: true,
      txHash: res.txHash,
      count: res.createdEntities.length,
      spentGLM: formatEther(spent),
      costPerEntity: formatEther(spent / BigInt(size)),
      elapsedMs,
    };
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    const msg = err?.message || String(err);
    console.error(`  ❌ Batch Size ${size} FAILED after ${elapsedMs} ms:`, msg);
    return {
      size,
      success: false,
      elapsedMs,
      error: msg,
    };
  }
}

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.log("No PRIVATE_KEY configured in environment. Skipping batch ceiling test.");
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
  console.log(`Starting Balance: ${formatEther(initialBal)} GLM`);

  const results = [];
  for (const size of [10, 20, 30]) {
    const res = await testBatchSize(size, wallet, publicClient, walletAddr);
    results.push(res);
  }

  console.log(`\n========================================================`);
  console.log(`  BATCH CEILING EMPIRICAL SUMMARY TABLE`);
  console.log(`========================================================`);
  console.log(`| Size | Status | Tx Hash | Total GLM Spent | Cost/Entity (GLM) | Time (ms) | Notes / Error |`);
  console.log(`|------|--------|---------|-----------------|-------------------|-----------|---------------|`);
  for (const r of results) {
    if (r.success) {
      console.log(`| ${r.size} | PASS | ${r.txHash?.slice(0, 10)}… | ${r.spentGLM} | ${r.costPerEntity} | ${r.elapsedMs} | OK |`);
    } else {
      console.log(`| ${r.size} | FAIL | - | - | - | ${r.elapsedMs} | ${r.error?.slice(0, 40)}… |`);
    }
  }
}

main().catch((err) => {
  console.error("Batch test runner failed:", err);
  process.exit(1);
});
