/**
 * scripts/test-batch.ts
 *
 * Tests executeBatch capability of @arkiv-network/sdk on Arkiv Tiramisu.
 * Measures single-tx batch creation of 6 slots and records exact GLM cost.
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

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.log("No PRIVATE_KEY configured in environment. Skipping live batch test.");
    return;
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log(`Connecting to Arkiv Tiramisu with wallet: ${walletAddr}`);

  const publicClient = createPublicClient({
    chain: tiramisu,
    transport: http(),
  });

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const balBefore = await (publicClient as any).getBalance({ address: walletAddr });
  console.log(`Initial Balance: ${formatEther(balBefore)} GLM`);

  // Generate 6 synthetic slots
  const slots = generateSeedSlots({ count: 6, includeLong: true });
  console.log(`Generated ${slots.length} synthetic slots for executeBatch test.`);

  const batchCreates = slots.map((s, idx) => ({
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
      seed_batch: str("dev-probe"), // excluded from production view
    },
    expires: ExpirationTime.atDate(new Date(s.endsAt * 1000)),
  }));

  console.log("Sending wallet.executeBatch({ creates: 6 entities }) in 1 transaction...");
  const startTime = Date.now();
  const res = await wallet.executeBatch({ creates: batchCreates });
  const elapsed = Date.now() - startTime;

  console.log(`\nBatch Transaction Confirmed!`);
  console.log(`  Tx Hash: ${res.txHash}`);
  console.log(`  Created Entities Count: ${res.createdEntities.length}`);
  console.log(`  Elapsed Time: ${elapsed} ms`);

  const balAfter = await (publicClient as any).getBalance({ address: walletAddr });
  const spent = balBefore - balAfter;
  console.log(`  GLM Spent: ${formatEther(spent)} GLM (for 6 entities)`);
  console.log(`  Cost Per Entity: ${formatEther(spent / 6n)} GLM\n`);

  for (let i = 0; i < res.createdEntities.length; i++) {
    console.log(`  Entity #${i + 1}: ${res.createdEntities[i]}`);
  }
}

main().catch((err) => {
  console.error("Batch test failed:", err);
  process.exit(1);
});
