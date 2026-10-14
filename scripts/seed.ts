/**
 * scripts/seed.ts
 *
 * Phase 2: Seed Data Script
 *
 * Creates synthetic slots distributed across 10 Indian city clusters.
 * All entities are tagged synthetic=true and seed_batch=<batch-name>.
 *
 * CLI flags:
 *   --count <n>           Total slots to create (default: 40)
 *   --max-hours <n>       Maximum slot duration hours (default: 8)
 *   --long                Include some very long slots (up to 168h / 7 days)
 *   --dry-run             Print plan without sending transactions
 *   --yes                 Required to actually send (safety gate)
 *   --batch-name <name>   Override the seed_batch attribute (default: seed-YYYY-MM-DD)
 *
 * At least one slot ending within 15 minutes and at least three ending within
 * 1 hour are always injected when count >= 10.
 *
 * Refuses any slot whose computed ends_at is already in the past.
 *
 * Usage:
 *   npx tsx scripts/seed.ts --dry-run
 *   npx tsx scripts/seed.ts --count 30 --yes
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
import type { Hex, Address } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CLI ARGUMENT PARSING
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(): {
  count: number;
  maxHours: number;
  long: boolean;
  dryRun: boolean;
  yes: boolean;
  batchName: string;
} {
  const argv = process.argv.slice(2);
  let count     = 40;
  let maxHours  = 8;
  let long      = false;
  let dryRun    = false;
  let yes       = false;
  let batchName = `seed-${new Date().toISOString().slice(0, 10)}`;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--count":       count     = parseInt(argv[++i] ?? "40", 10);    break;
      case "--max-hours":   maxHours  = parseInt(argv[++i] ?? "8", 10);     break;
      case "--long":        long      = true;                                break;
      case "--dry-run":     dryRun    = true;                                break;
      case "--yes":         yes       = true;                                break;
      case "--batch-name":  batchName = argv[++i] ?? batchName;             break;
      case "--":            break;
      default:
        console.error(`Unknown flag: ${argv[i]}`);
        process.exit(1);
    }
  }
  return { count, maxHours, long, dryRun, yes, batchName };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CLUSTER & TEMPLATE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

import { generateSeedSlots, type GeneratedSlot, formatDurationLabel } from "../src/lib/seedGenerator.js";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface SlotPlan extends GeneratedSlot {
  index: number;
}

function buildPlan(args: ReturnType<typeof parseArgs>, nowSec: number): SlotPlan[] {
  const generated = generateSeedSlots({
    count: args.count,
    nowSec,
    includeLong: args.long,
    maxHours: args.maxHours,
  });

  return generated.map((s, idx) => ({
    ...s,
    index: idx + 1,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  if (!args.dryRun && !args.yes) {
    console.error("\n❌  Safety gate: pass --yes to actually send transactions, or --dry-run to preview.\n");
    process.exit(1);
  }

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌  PRIVATE_KEY env var is required."); process.exit(1);
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account    = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  const PROJECT_NAMESPACE = "slotbazaar";
  const SCHEMA_VERSION    = "1";

  const nowSec = Math.floor(Date.now() / 1000);
  const plans  = buildPlan(args, nowSec);

  console.log(`\n🌱  SlotBazaar Seed Script`);
  console.log(`    Mode    : ${args.dryRun ? "DRY RUN (no txns)" : "LIVE"}`);
  console.log(`    Wallet  : ${walletAddr}`);
  console.log(`    Batch   : ${args.batchName}`);
  console.log(`    Planned : ${plans.length} slots`);
  console.log(`    Network : Tiramisu testnet (chain 7738577)\n`);

  // Cost estimate (rough: use 0.001 GLM per slot as placeholder pre-measurement)
  // If measure-cost.ts has been run, you'd read from its output. Here we show plan only.
  console.log("── Plan ─────────────────────────────────────────────────────────────────────");
  console.log("#   Cluster     Category    Tier    Duration  EndsAt (IST)");
  console.log("────────────────────────────────────────────────────────────────────────────");
  for (const p of plans) {
    const endsIST = new Date(p.endsAt * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }).slice(0, 17);
    console.log(
      `${String(p.index).padStart(2)}  ${p.cluster.padEnd(10)}  ${p.category.padEnd(10)}  ${p.tier.padEnd(6)}  ${p.durationLabel.padEnd(8)}  ${endsIST}`
    );
  }
  console.log();

  if (args.dryRun) {
    console.log("DRY RUN complete — no transactions sent.");
    console.log(`Re-run with --yes to create ${plans.length} entities on-chain.\n`);
    return;
  }

  // ── LIVE SEND ──
  const wallet = createWalletClient({ chain: tiramisu, transport: http(), account });
  const pub    = createPublicClient({ chain: tiramisu, transport: http() });

  let seeded = 0;
  let failed = 0;

  const resultRows: string[] = [];

  for (const p of plans) {
    // Safety: refuse already-expired slots
    if (p.endsAt <= Math.floor(Date.now() / 1000)) {
      console.log(`  [${p.index}] SKIP — expiry already past (${p.title})`);
      failed++;
      continue;
    }

    process.stdout.write(`  [${p.index}/${plans.length}] ${p.cluster} / ${p.category} / ${p.durationLabel} … `);

    try {
      const balBefore = await (pub as unknown as { getBalance: (a: { address: Hex }) => Promise<bigint> })
        .getBalance({ address: walletAddr as Hex });

      const result = await wallet.createEntity({
        payload: jsonToPayload({
          title: p.title,
          description: p.description,
          seller_label: p.sellerLabel,
          schema_version: 1,
        }),
        contentType: "application/json",
        attributes: {
          project:      str(PROJECT_NAMESPACE),
          entity_type:  str("slot"),
          schema_v:     str(SCHEMA_VERSION),
          category:     str(p.category),
          cluster:      str(p.cluster),
          starts_at:    u64(BigInt(p.startsAt)),
          ends_at:      u64(BigInt(p.endsAt)),
          price_band:   str(p.priceBand),
          lat_e4:       i32(Math.round(p.lat * 10000)),
          lon_e4:       i32(Math.round(p.lon * 10000)),
          synthetic:    bool(true),
          seed_batch:   str(args.batchName),
        },
        expires: ExpirationTime.atDate(new Date(p.endsAt * 1000)),
      });

      await sleep(1500);
      const balAfter = await (pub as unknown as { getBalance: (a: { address: Hex }) => Promise<bigint> })
        .getBalance({ address: walletAddr as Hex });
      const spent = balBefore - balAfter;

      console.log(`✅  key=${result.entityKey.slice(0, 14)}… tx=${result.txHash.slice(0, 14)}… cost=${formatEther(spent)} GLM`);
      resultRows.push(`| ${p.index} | ${p.cluster.padEnd(10)} | ${p.category.padEnd(10)} | ${p.durationLabel.padEnd(7)} | ${result.entityKey} | ${result.txHash} |`);
      seeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 60) : String(err).slice(0, 60);
      console.log(`❌  FAILED: ${msg}`);
      failed++;
    }

    await sleep(600); // avoid nonce collisions
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Seed complete: ${seeded} created, ${failed} failed`);
  console.log(`  Batch: ${args.batchName}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (resultRows.length > 0) {
    console.log("── Result Table ─────────────────────────────────────────────────────────────");
    console.log("| #  | Cluster    | Category   | Dur     | Entity Key                                                         | Tx Hash                                                            |");
    console.log("|----|-----------:|:-----------|:--------|:-------------------------------------------------------------------|:-------------------------------------------------------------------|");
    for (const r of resultRows) console.log(r);
    console.log();
  }

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
