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

type Category = "machine" | "transport" | "freelance";
type PriceBand = "low" | "mid" | "high";

import { CLUSTERS } from "../src/lib/clusters.js";

interface SlotTemplate {
  category: Category;
  priceBand: PriceBand;
  titleBase: string;
  description: string;
  sellerLabel: string;
}

const TEMPLATES: SlotTemplate[] = [
  { category: "machine",   priceBand: "low",  titleBase: "CNC Lathe block",          description: "5-axis CNC lathe for small batch runs. Min order 50 pcs. Coolant included.", sellerLabel: "PrecisionWorks SME" },
  { category: "transport", priceBand: "mid",  titleBase: "Mini-truck 2T",            description: "2-tonne pickup for intracity delivery. Driver included. Fuel extra.", sellerLabel: "FastMove Logistics" },
  { category: "freelance", priceBand: "high", titleBase: "React engineer sprint",    description: "Senior React/TypeScript engineer. Vite, Next.js. Available for focused sprint.", sellerLabel: "IndieDevIndia" },
  { category: "machine",   priceBand: "mid",  titleBase: "3D Printer — PLA/ABS",    description: "FDM printer, 300×300×400mm build volume. First-come first-served.", sellerLabel: "MakerSpace Pune" },
  { category: "transport", priceBand: "low",  titleBase: "E-rickshaw city run",      description: "Electric rickshaw for last-mile intracity goods delivery. Up to 300kg.", sellerLabel: "GreenHaul" },
  { category: "freelance", priceBand: "mid",  titleBase: "UX Designer — 1 day",     description: "Figma, Framer. Portfolio: dribbble.com/…. One full working day.", sellerLabel: "PixelCraft Studio" },
  { category: "machine",   priceBand: "high", titleBase: "Laser cutter 100W",       description: "100W CO₂ laser. Max 900×600mm sheet. Includes operator.", sellerLabel: "FabricationHub BLR" },
  { category: "transport", priceBand: "high", titleBase: "10T truck interstate",     description: "10-tonne truck available for interstate cargo. Driver + helper.", sellerLabel: "Shiva Transport Co." },
  { category: "freelance", priceBand: "low",  titleBase: "Data entry — bulk batch",  description: "Fast data entry. Rate: 5000 rows/hour. NDA available.", sellerLabel: "QuickData Works" },
  { category: "machine",   priceBand: "low",  titleBase: "Welding station",          description: "MIG/TIG welding. Hourly slot. Must supply own materials.", sellerLabel: "WeldMaster SME" },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Random jitter ±0.02 degrees (~2 km) */
function jitter(c: number): number { return c + (Math.random() - 0.5) * 0.04; }

/** Random int [min, max) */
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min)) + min; }

/** Format hours nicely */
function fmtH(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────────────────────
// 4. PLAN GENERATION
// ─────────────────────────────────────────────────────────────────────────────

interface SlotPlan {
  index: number;
  cluster: string;
  lat: number;
  lon: number;
  category: Category;
  priceBand: PriceBand;
  titleBase: string;
  description: string;
  sellerLabel: string;
  startsAt: number;
  endsAt: number;
  durationHours: number;
  title: string;
  /** "short" | "normal" | "long" */
  tier: string;
}

function buildPlan(args: ReturnType<typeof parseArgs>, nowSec: number): SlotPlan[] {
  const { count, maxHours, long: includeLong } = args;

  const plans: SlotPlan[] = [];

  // Special slots: 2 ending within 15 min, 3 within 1 hour (always injected when count ≥ 10)
  const specials: { durationHours: number; tier: string }[] = [];
  if (count >= 10) {
    specials.push({ durationHours: 0.1,   tier: "short" });  // ~6 min
    specials.push({ durationHours: 0.2,   tier: "short" });  // ~12 min
    specials.push({ durationHours: 0.5,   tier: "short" });  // 30 min
    specials.push({ durationHours: 0.75,  tier: "short" });  // 45 min
    specials.push({ durationHours: 1.0,   tier: "short" });  // 1 h
  }

  // Optional: long slots (up to 168h)
  const longSlots: { durationHours: number; tier: string }[] = [];
  if (includeLong) {
    longSlots.push({ durationHours: 48,  tier: "long" });
    longSlots.push({ durationHours: 72,  tier: "long" });
    longSlots.push({ durationHours: 168, tier: "long" });
  }

  const allSpecials = [...specials, ...longSlots];
  const normalCount = count - allSpecials.length;

  // Build normal slots
  for (let i = 0; i < normalCount; i++) {
    const tpl     = TEMPLATES[i % TEMPLATES.length];
    const cluster = CLUSTERS[i % CLUSTERS.length];
    const dur     = randInt(1, maxHours + 1);
    allSpecials.push({ durationHours: dur, tier: "normal" });
  }

  // Combine and stamp cluster + coordinates
  allSpecials.slice(0, count).forEach((spec, idx) => {
    const tpl     = TEMPLATES[idx % TEMPLATES.length];
    const cluster = CLUSTERS[idx % CLUSTERS.length];
    const lat     = jitter(cluster.lat);
    const lon     = jitter(cluster.lon);
    const startsAt = nowSec + randInt(60, 600); // starts 1–10 min from now
    const endsAt   = startsAt + Math.round(spec.durationHours * 3600);

    if (endsAt <= nowSec) return; // refuse past expiry

    const title = `[${cluster.name.toUpperCase()}] ${tpl.titleBase} (${fmtH(spec.durationHours)})`;

    plans.push({
      index: plans.length + 1,
      cluster: cluster.name,
      lat, lon,
      category:    tpl.category,
      priceBand:   tpl.priceBand,
      titleBase:   tpl.titleBase,
      description: tpl.description,
      sellerLabel: tpl.sellerLabel,
      startsAt, endsAt,
      durationHours: spec.durationHours,
      title,
      tier: spec.tier,
    });
  });

  return plans;
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
      `${String(p.index).padStart(2)}  ${p.cluster.padEnd(10)}  ${p.category.padEnd(10)}  ${p.tier.padEnd(6)}  ${fmtH(p.durationHours).padEnd(8)}  ${endsIST}`
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

    process.stdout.write(`  [${p.index}/${plans.length}] ${p.cluster} / ${p.category} / ${fmtH(p.durationHours)} … `);

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
      resultRows.push(`| ${p.index} | ${p.cluster.padEnd(10)} | ${p.category.padEnd(10)} | ${fmtH(p.durationHours).padEnd(7)} | ${result.entityKey} | ${result.txHash} |`);
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
