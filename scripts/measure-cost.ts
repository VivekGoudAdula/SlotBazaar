/**
 * scripts/measure-cost.ts
 *
 * Measures GLM spent per slot entity creation for 3h and 24h expiry.
 * Reads wallet balance before and after each createEntity call and
 * reports the exact difference in wei and GLM.
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/measure-cost.ts
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
import { http, formatEther } from "viem";
import type { Hex } from "viem";

const PROJECT_NAMESPACE = "slotbazaar";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function measureCreate(
  wallet: ReturnType<typeof createWalletClient>,
  pub: ReturnType<typeof createPublicClient>,
  address: Hex,
  label: string,
  endsAtOffsetSec: number,
) {
  const nowSec = Math.floor(Date.now() / 1000);
  const endsAt = nowSec + endsAtOffsetSec;

  const balBefore = await (pub as unknown as { getBalance: (args: { address: Hex }) => Promise<bigint> })
    .getBalance({ address });

  const result = await wallet.createEntity({
    payload: jsonToPayload({ title: `cost-test ${label}`, description: "cost measurement", seller_label: "test", schema_version: 1 }),
    contentType: "application/json",
    attributes: {
      project:     str(PROJECT_NAMESPACE),
      entity_type: str("slot"),
      schema_v:    str("1"),
      category:    str("machine"),
      cluster:     str("test"),
      starts_at:   u64(BigInt(nowSec)),
      ends_at:     u64(BigInt(endsAt)),
      price_band:  str("low"),
      lat_e4:      i32(190760),
      lon_e4:      i32(728777),
      synthetic:   bool(true),
      seed_batch:  str("cost-measure"),
    },
    expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
  });

  // Wait 2 blocks for balance to settle
  await sleep(4000);

  const balAfter = await (pub as unknown as { getBalance: (args: { address: Hex }) => Promise<bigint> })
    .getBalance({ address });

  const spent = balBefore - balAfter;

  return {
    label,
    endsAtOffsetSec,
    entityKey: result.entityKey,
    txHash: result.txHash,
    spentWei: spent,
    spentGLM: formatEther(spent),
  };
}

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) { console.error("PRIVATE_KEY required"); process.exit(1); }

  const account = privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex);
  const address = account.address as Hex;

  const wallet = createWalletClient({ chain: tiramisu, transport: http(), account });
  const pub    = createPublicClient({ chain: tiramisu, transport: http() });

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  SlotBazaar — GLM Cost Measurement          ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
  console.log(`  Wallet: ${address}\n`);

  const results = [];

  for (const [label, offsetSec] of [["3h", 3 * 3600], ["24h", 24 * 3600]] as [string, number][]) {
    console.log(`  Creating ${label} entity…`);
    try {
      const r = await measureCreate(wallet, pub, address, label, offsetSec);
      results.push(r);
      console.log(`    tx    : ${r.txHash}`);
      console.log(`    key   : ${r.entityKey}`);
      console.log(`    spent : ${r.spentWei} wei = ${r.spentGLM} GLM\n`);
    } catch (err) {
      console.error(`    FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
      results.push({ label, endsAtOffsetSec: offsetSec, spentWei: 0n, spentGLM: "N/A", entityKey: "FAILED", txHash: "FAILED" });
    }
    await sleep(2000);
  }

  console.log("── Results Table ────────────────────────────────────────");
  console.log("  Expiry  | Spent (GLM)          | Spent (wei)");
  console.log("  ────────|──────────────────────|──────────────────────");
  for (const r of results) {
    console.log(`  ${r.label.padEnd(8)}| ${r.spentGLM.padEnd(21)}| ${r.spentWei.toString().padEnd(21)}`);
  }

  // Estimate 40-slot seed cost (use 3h figure as baseline)
  const base = results.find((r) => r.label === "3h");
  if (base && base.spentWei && base.spentWei > 0n) {
    const est40 = base.spentWei * 40n;
    console.log(`\n  Estimated 40-slot seed cost (based on 3h): ${formatEther(est40)} GLM\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
