/**
 * scripts/seed.ts
 *
 * Phase 2 & Judging: Seed Data Script
 *
 * Creates synthetic slots distributed across Indian city clusters.
 * All entities are tagged synthetic=true and seed_batch=<batch-name>.
 *
 * CLI flags:
 *   --judging             Special judging seed mode: 72 slots expiring hourly for 36h
 *                         (2 per hour, mixed clusters/categories) plus 30 slots lasting
 *                         2 to 7 days (102 total slots, batching 20/tx with readonly flags).
 *   --count <n>           Total slots to create in standard mode (default: 40)
 *   --max-hours <n>       Maximum slot duration hours (default: 8)
 *   --long                Include some very long slots (up to 168h / 7 days)
 *   --dry-run             Print plan without sending transactions
 *   --yes                 Required to actually send (safety gate)
 *   --batch-name <name>   Override the seed_batch attribute (default: seed-YYYY-MM-DD or judging-YYYY-MM-DD)
 *
 * Usage:
 *   npx tsx scripts/seed.ts --dry-run
 *   npx tsx scripts/seed.ts --judging --dry-run
 *   npx tsx scripts/seed.ts --judging --yes
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
import {
  generateSeedSlots,
  type GeneratedSlot,
  type SeedCategory,
  type SeedTemplate,
  SEED_TEMPLATES,
  formatDurationLabel,
} from "../src/lib/seedGenerator.js";
import { CLUSTERS } from "../src/lib/clusters.js";

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
  judging: boolean;
} {
  const argv = process.argv.slice(2);
  let count     = 40;
  let maxHours  = 8;
  let long      = false;
  let dryRun    = false;
  let yes       = false;
  let judging   = false;
  let customBatchName: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--count":       count     = parseInt(argv[++i] ?? "40", 10);    break;
      case "--max-hours":   maxHours  = parseInt(argv[++i] ?? "8", 10);     break;
      case "--long":        long      = true;                                break;
      case "--dry-run":     dryRun    = true;                                break;
      case "--yes":         yes       = true;                                break;
      case "--judging":     judging   = true;                                break;
      case "--batch-name":  customBatchName = argv[++i] ?? null;            break;
      case "--":            break;
      default:
        console.error(`Unknown flag: ${argv[i]}`);
        process.exit(1);
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultBatchName = judging ? `judging-${todayStr}` : `seed-${todayStr}`;
  const batchName = customBatchName ?? defaultBatchName;

  return { count, maxHours, long, dryRun, yes, batchName, judging };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface SlotPlan extends GeneratedSlot {
  index: number;
}

function disperseClusterCoords(centerLat: number, centerLon: number, angleDeg: number): { lat: number; lon: number } {
  const angle = (angleDeg * Math.PI) / 180;
  const radiusDeg = 0.04 + (Math.abs(Math.sin(angleDeg)) * 0.1);
  const dLat = radiusDeg * Math.cos(angle);
  const dLon = (radiusDeg * Math.sin(angle)) / Math.cos((centerLat * Math.PI) / 180);
  return {
    lat: Number((centerLat + dLat).toFixed(4)),
    lon: Number((centerLon + dLon).toFixed(4)),
  };
}

/**
 * Builds judging plan:
 * 1. 72 slots expiring every hour for the next 36 hours (2 per hour, mixed clusters/categories)
 * 2. 30 slots lasting 2 to 7 days (48h to 168h)
 * Total: 102 slots with readonly flags and synthetic=true.
 */
function buildJudgingPlan(nowSec: number): SlotPlan[] {
  const plans: SlotPlan[] = [];
  const categories: SeedCategory[] = ["machine", "transport", "freelance"];

  const templatesByCategory: Record<SeedCategory, SeedTemplate[]> = {
    machine: SEED_TEMPLATES.filter((t) => t.category === "machine"),
    transport: SEED_TEMPLATES.filter((t) => t.category === "transport"),
    freelance: SEED_TEMPLATES.filter((t) => t.category === "freelance"),
  };

  let globalIndex = 1;

  // 1. Next 36 hours: 2 slots expiring every hour (72 slots)
  for (let h = 1; h <= 36; h++) {
    // Slot A
    const clusterA = CLUSTERS[((h - 1) * 2) % CLUSTERS.length];
    const catA = categories[(h - 1) % categories.length];
    const tListA = templatesByCategory[catA];
    const tplA = tListA[(h - 1) % tListA.length];
    const endsAtA = nowSec + h * 3600;
    const durHoursA = Math.min(h, 4);
    const startsAtA = endsAtA - Math.round(durHoursA * 3600);
    const coordsA = disperseClusterCoords(clusterA.lat, clusterA.lon, (h * 11) % 360);

    plans.push({
      index: globalIndex++,
      cluster: clusterA.id,
      clusterLabel: clusterA.label,
      lat: coordsA.lat,
      lon: coordsA.lon,
      category: catA,
      priceBand: tplA.priceBand,
      title: `[${clusterA.label.toUpperCase()}] ${tplA.titleBase} (${formatDurationLabel(durHoursA)})`,
      description: tplA.description,
      sellerLabel: tplA.sellerLabel,
      startsAt: startsAtA,
      endsAt: endsAtA,
      durationHours: durHoursA,
      durationLabel: formatDurationLabel(durHoursA),
      tier: durHoursA <= 0.25 ? "short" : "normal",
    });

    // Slot B (distinct cluster & category)
    const clusterB = CLUSTERS[((h - 1) * 2 + 1) % CLUSTERS.length];
    const catB = categories[h % categories.length];
    const tListB = templatesByCategory[catB];
    const tplB = tListB[h % tListB.length];
    const endsAtB = nowSec + h * 3600;
    const durHoursB = Math.min(Math.max(1, (h % 3) + 1), h);
    const startsAtB = endsAtB - Math.round(durHoursB * 3600);
    const coordsB = disperseClusterCoords(clusterB.lat, clusterB.lon, ((h * 17) + 180) % 360);

    plans.push({
      index: globalIndex++,
      cluster: clusterB.id,
      clusterLabel: clusterB.label,
      lat: coordsB.lat,
      lon: coordsB.lon,
      category: catB,
      priceBand: tplB.priceBand,
      title: `[${clusterB.label.toUpperCase()}] ${tplB.titleBase} (${formatDurationLabel(durHoursB)})`,
      description: tplB.description,
      sellerLabel: tplB.sellerLabel,
      startsAt: startsAtB,
      endsAt: endsAtB,
      durationHours: durHoursB,
      durationLabel: formatDurationLabel(durHoursB),
      tier: "normal",
    });
  }

  // 2. 30 slots lasting 2 to 7 days (48h to 168h)
  for (let j = 0; j < 30; j++) {
    const cluster = CLUSTERS[(j + 2) % CLUSTERS.length];
    const cat = categories[j % categories.length];
    const tList = templatesByCategory[cat];
    const tpl = tList[j % tList.length];

    const durHours = Math.round(48 + (j / 29) * (168 - 48));
    const startsAt = nowSec + (j % 6) * 1800;
    const endsAt = startsAt + durHours * 3600;
    const coords = disperseClusterCoords(cluster.lat, cluster.lon, (j * 37) % 360);

    plans.push({
      index: globalIndex++,
      cluster: cluster.id,
      clusterLabel: cluster.label,
      lat: coords.lat,
      lon: coords.lon,
      category: cat,
      priceBand: tpl.priceBand,
      title: `[${cluster.label.toUpperCase()}] ${tpl.titleBase} (${formatDurationLabel(durHours)})`,
      description: tpl.description,
      sellerLabel: tpl.sellerLabel,
      startsAt,
      endsAt,
      durationHours: durHours,
      durationLabel: formatDurationLabel(durHours),
      tier: "long",
    });
  }

  return plans;
}

function buildPlan(args: ReturnType<typeof parseArgs>, nowSec: number): SlotPlan[] {
  if (args.judging) {
    return buildJudgingPlan(nowSec);
  }

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

  const estimatedCostPerEntity = 0.000143; // Arkiv protocol cost ~0.000143 GLM per slot
  const estimatedTotalCostGLM = (plans.length * estimatedCostPerEntity).toFixed(4);
  const batchSize = 20;
  const totalBatches = Math.ceil(plans.length / batchSize);

  console.log(`\n🌱  SlotBazaar Seed Script`);
  console.log(`    Mode          : ${args.dryRun ? "DRY RUN (no txns)" : "LIVE"}`);
  console.log(`    Judging Mode  : ${args.judging ? "ENABLED (72 hourly for 36h + 30 long slots 2-7d = 102 total)" : "DISABLED"}`);
  console.log(`    Creation Flags: readonly: true`);
  console.log(`    Wallet        : ${walletAddr}`);
  console.log(`    Batch         : ${args.batchName}`);
  console.log(`    Planned       : ${plans.length} slots`);
  console.log(`    Batch Txns    : ${args.judging ? `${totalBatches} batch transactions (${batchSize} per tx via executeBatch)` : "1 tx per slot"}`);
  console.log(`    Estimated Cost: ~${estimatedTotalCostGLM} GLM (~${estimatedCostPerEntity} GLM per entity)`);
  console.log(`    Network       : Tiramisu testnet (chain 7738577)\n`);

  console.log("── Plan ─────────────────────────────────────────────────────────────────────");
  console.log("#    Cluster     Category    Tier    Duration  EndsAt (IST)       Title");
  console.log("────────────────────────────────────────────────────────────────────────────");
  for (const p of plans) {
    const endsIST = new Date(p.endsAt * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }).slice(0, 17);
    console.log(
      `${String(p.index).padStart(3)}  ${p.cluster.padEnd(10)}  ${p.category.padEnd(10)}  ${p.tier.padEnd(6)}  ${p.durationLabel.padEnd(8)}  ${endsIST}  ${p.title.slice(0, 35)}`
    );
  }
  console.log();

  if (args.dryRun) {
    console.log("DRY RUN complete — no transactions sent.");
    if (args.judging) {
      console.log(`Re-run with --yes to execute ${totalBatches} batch transactions (up to ${batchSize} entities per transaction) on-chain.\n`);
    } else {
      console.log(`Re-run with --yes to create ${plans.length} entities on-chain.\n`);
    }
    return;
  }

  // ── LIVE SEND ──
  const envKey = process.env.VITE_ARKIV_API_KEY || process.env.ARKIV_API_KEY || "";
  const baseRpc = process.env.VITE_RPC_URL || "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
  const rpcUrl = envKey && !baseRpc.includes(envKey) ? `${baseRpc.replace(/\/+$/, "")}/${envKey}` : baseRpc;

  const wallet = createWalletClient({ chain: tiramisu, transport: http(rpcUrl), account });
  const pub    = createPublicClient({ chain: tiramisu, transport: http(rpcUrl) });

  let seeded = 0;
  let failed = 0;

  if (args.judging) {
    console.log(`\n📦  Executing ${totalBatches} batch transactions (${batchSize} slots per tx via executeBatch)...`);

    for (let b = 0; b < totalBatches; b++) {
      const chunk = plans.slice(b * batchSize, (b + 1) * batchSize);
      process.stdout.write(`  [Batch ${b + 1}/${totalBatches}] Creating slots #${chunk[0].index}..#${chunk[chunk.length - 1].index} (${chunk.length} items) … `);

      try {
        const batchCreates = chunk.map((p) => ({
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
          flags: { readonly: true },
        }));

        const res = await wallet.executeBatch({ creates: batchCreates });
        seeded += chunk.length;
        console.log(`✅  tx=${res.txHash} (${res.createdEntities.length} entities created)`);
      } catch (err) {
        failed += chunk.length;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`❌  FAILED: ${msg.slice(0, 100)}`);
      }
      await sleep(1000);
    }
  } else {
    for (const p of plans) {
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
          flags: { readonly: true },
        });

        await sleep(1500);
        const balAfter = await (pub as unknown as { getBalance: (a: { address: Hex }) => Promise<bigint> })
          .getBalance({ address: walletAddr as Hex });
        const spent = balBefore - balAfter;

        console.log(`✅  key=${result.entityKey.slice(0, 14)}… tx=${result.txHash.slice(0, 14)}… cost=${formatEther(spent)} GLM`);
        seeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 60) : String(err).slice(0, 60);
        console.log(`❌  FAILED: ${msg}`);
        failed++;
      }

      await sleep(600);
    }
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Seed complete: ${seeded} created, ${failed} failed`);
  console.log(`  Batch: ${args.batchName}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
