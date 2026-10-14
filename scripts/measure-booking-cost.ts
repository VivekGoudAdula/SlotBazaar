/**
 * scripts/measure-booking-cost.ts
 *
 * Measures GLM cost for booking entities at 30, 90, and 365 days (2 runs each).
 * Reports:
 * - Expiry duration (days)
 * - Run # (1 and 2)
 * - Entity key & Transaction hash
 * - Balance before / after (wei & GLM)
 * - Gas used and GLM cost
 *
 * Usage: npx tsx scripts/measure-booking-cost.ts
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
import { str, u64, key as keyAttr } from "@arkiv-network/sdk/attr";
import { http, formatEther, type Hex, type Address } from "viem";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌ PRIVATE_KEY is required in .env");
    process.exit(1);
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log("========================================================");
  console.log("  MEASURING BOOKING ENTITY COST: 30d, 90d, 365d");
  console.log("========================================================");
  console.log(`Wallet: ${walletAddr}`);

  const publicClient = createPublicClient({
    chain: tiramisu,
    transport: http("https://rpc.tiramisu.db-chain.testnet.arkiv.network"),
  });

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http("https://rpc.tiramisu.db-chain.testnet.arkiv.network"),
    account,
  });

  const initialBal = await publicClient.getBalance({ address: walletAddr });
  console.log(`Initial Balance: ${formatEther(initialBal)} GLM\n`);

  const DURATION_DAYS = [30, 90, 365];
  const RUNS_PER_DURATION = 2;

  const rows: Array<{
    days: number;
    run: number;
    entityKey: string;
    txHash: string;
    spentWei: bigint;
    spentGLM: string;
  }> = [];

  for (const days of DURATION_DAYS) {
    for (let run = 1; run <= RUNS_PER_DURATION; run++) {
      console.log(`Creating booking entity (${days} days, run ${run}/${RUNS_PER_DURATION})...`);

      const nowSec = Math.floor(Date.now() / 1000);
      const expiryDate = new Date(Date.now() + days * 86400 * 1000);
      const dummySlotKey = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

      const balBefore = await publicClient.getBalance({ address: walletAddr });

      const result = await wallet.createEntity({
        payload: jsonToPayload({
          note: `cost-probe-${days}d-run${run}`,
          schema_version: 2,
        }),
        contentType: "application/json",
        attributes: {
          project: str("slotbazaar"),
          entity_type: str("booking"),
          schema_v: str("2"),
          slot_key: keyAttr(dummySlotKey),
          slot_creator: str(walletAddr.toLowerCase()),
          slot_ends_at: u64(BigInt(nowSec + 3600)),
          booked_at: u64(BigInt(nowSec)),
          seed_batch: str("reputation-cost-measure"),
        },
        expires: ExpirationTime.atDate(expiryDate),
      });

      console.log(`  Tx: ${result.txHash}`);
      await publicClient.waitForTransactionReceipt({ hash: result.txHash });
      await sleep(2500); // allow balance settlement

      const balAfter = await publicClient.getBalance({ address: walletAddr });
      const spentWei = balBefore - balAfter;
      const spentGLM = formatEther(spentWei);

      console.log(`  ✓ Cost: ${spentGLM} GLM (${spentWei.toString()} wei)\n`);

      rows.push({
        days,
        run,
        entityKey: result.entityKey,
        txHash: result.txHash,
        spentWei,
        spentGLM,
      });

      await sleep(2000);
    }
  }

  console.log("========================================================");
  console.log("  BOOKING ENTITY GLM COST RESULTS");
  console.log("========================================================");
  console.log("| Expiry (Days) | Run | Entity Key | Tx Hash | Cost (GLM) | Cost (wei) |");
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(
      `| ${r.days} | ${r.run} | \`${r.entityKey.slice(0, 10)}...${r.entityKey.slice(-6)}\` | \`${r.txHash.slice(0, 10)}...${r.txHash.slice(-6)}\` | ${r.spentGLM} GLM | ${r.spentWei.toString()} |`
    );
  }
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
