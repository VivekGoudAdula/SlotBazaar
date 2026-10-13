/**
 * scripts/seed.ts
 *
 * Phase 2: Seed Data Script
 * Creates 30 synthetic slots distributed across 10 Indian city clusters.
 * Each slot gets jittered lat/lon, mixed end-times (1h–24h), and a
 * `seed_batch` attribute for easy identification and cleanup.
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/seed.ts
 */

import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import {
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64, i32, bool, key as keyAttr } from "@arkiv-network/sdk/attr";
import { http } from "viem";
import type { Hex, Address } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_NAMESPACE = "slotbazaar";
const SCHEMA_VERSION    = "1";
const SEED_BATCH        = `seed-${new Date().toISOString().slice(0, 10)}`;
const SLOT_COUNT        = 30;

// ─────────────────────────────────────────────────────────────────────────────
// CLUSTER DEFINITIONS — 10 Indian city clusters with centre coordinates
// ─────────────────────────────────────────────────────────────────────────────

type Category = "machine" | "transport" | "freelance";
type PriceBand = "low" | "mid" | "high";

interface ClusterDef {
  name: string;
  lat: number;
  lon: number;
}

const CLUSTERS: ClusterDef[] = [
  { name: "mumbai",   lat: 19.0760, lon: 72.8777 },
  { name: "delhi",    lat: 28.6139, lon: 77.2090 },
  { name: "bangalore", lat: 12.9716, lon: 77.5946 },
  { name: "chennai",  lat: 13.0827, lon: 80.2707 },
  { name: "kolkata",  lat: 22.5726, lon: 88.3639 },
  { name: "hyderabad", lat: 17.3850, lon: 78.4867 },
  { name: "ahmedabad", lat: 23.0225, lon: 72.5714 },
  { name: "jaipur",   lat: 26.9124, lon: 75.7873 },
  { name: "surat",    lat: 21.1702, lon: 72.8311 },
  { name: "lucknow",  lat: 26.8467, lon: 80.9462 },
];

/** Slot data template for seeding */
interface SlotTemplate {
  category: Category;
  priceBand: PriceBand;
  title: string;
  description: string;
  sellerLabel: string;
  durationHours: number; // determines end time
}

// 3 slot templates per cluster = 30 total (3 × 10)
const TEMPLATES: SlotTemplate[] = [
  {
    category: "machine",
    priceBand: "low",
    title: "CNC Lathe — 4-hour block",
    description: "5-axis CNC lathe available for small batch runs. Min order 50 pcs. Coolant included.",
    sellerLabel: "PrecisionWorks SME",
    durationHours: 4,
  },
  {
    category: "transport",
    priceBand: "mid",
    title: "Mini-truck 2T capacity",
    description: "2-tonne pickup available for intracity delivery. Driver included. Fuel extra.",
    sellerLabel: "FastMove Logistics",
    durationHours: 8,
  },
  {
    category: "freelance",
    priceBand: "high",
    title: "Senior React engineer — sprint block",
    description: "Available for a focused 3-day sprint. Specialises in Next.js and Vite apps.",
    sellerLabel: "IndieDevIndia",
    durationHours: 24,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a small random jitter (±~2km) to coordinates so map pins don't overlap.
 */
function jitter(coord: number): number {
  // ±0.02 degrees ≈ ±2.2 km
  return coord + (Math.random() - 0.5) * 0.04;
}

/** Returns a random integer in [min, max) */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** Nicely formats seconds as h:mm */
function fmtDuration(hours: number): string {
  return `${hours}h`;
}

/** Sleeps for the given number of milliseconds */
function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌  PRIVATE_KEY env var is required. Copy .env.example → .env and fill in.");
    process.exit(1);
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account    = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log(`\n🌱  SlotBazaar Seed Script`);
  console.log(`    Wallet : ${walletAddr}`);
  console.log(`    Batch  : ${SEED_BATCH}`);
  console.log(`    Slots  : ${SLOT_COUNT} (3 per cluster × 10 clusters)`);
  console.log(`    Network: Tiramisu testnet (chain 7738577)\n`);

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const nowSec = Math.floor(Date.now() / 1000);
  let seeded = 0;
  let failed = 0;

  for (let ci = 0; ci < CLUSTERS.length; ci++) {
    const cluster = CLUSTERS[ci];
    const template = TEMPLATES[ci % TEMPLATES.length];

    // Stagger end times within each cluster: some short (1–4h), some long (8–24h)
    const durationVariants = [
      randInt(1, 4),          // short slot
      randInt(4, 12),         // medium slot
      template.durationHours, // template default
    ];

    for (let ti = 0; ti < TEMPLATES.length; ti++) {
      const tpl       = TEMPLATES[ti];
      const durHours  = durationVariants[ti];
      const startsAt  = nowSec + randInt(300, 1800);  // starts 5–30 min from now
      const endsAt    = startsAt + durHours * 3600;

      const lat = jitter(cluster.lat);
      const lon = jitter(cluster.lon);
      const latE4 = Math.round(lat * 10000);
      const lonE4 = Math.round(lon * 10000);

      const title = `[${cluster.name.toUpperCase()}] ${tpl.title} (${fmtDuration(durHours)})`;

      console.log(`  [${seeded + 1}/${SLOT_COUNT}] ${cluster.name} / ${tpl.category} / ${fmtDuration(durHours)} …`);

      try {
        const result = await wallet.createEntity({
          payload: jsonToPayload({
            title,
            description: tpl.description,
            seller_label: tpl.sellerLabel,
            schema_version: 1,
          }),
          contentType: "application/json",
          attributes: {
            project:      str(PROJECT_NAMESPACE),
            entity_type:  str("slot"),
            schema_v:     str(SCHEMA_VERSION),
            category:     str(tpl.category),
            cluster:      str(cluster.name),
            starts_at:    u64(BigInt(startsAt)),
            ends_at:      u64(BigInt(endsAt)),
            price_band:   str(tpl.priceBand),
            lat_e4:       i32(latE4),
            lon_e4:       i32(lonE4),
            synthetic:    bool(true),
            seed_batch:   str(SEED_BATCH),
          },
          expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
        });

        console.log(`    ✅  key=${result.entityKey} tx=${result.txHash}`);
        seeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`    ❌  FAILED: ${msg}`);
        failed++;
      }

      // Small delay between submissions to avoid nonce collisions
      await sleep(500);
    }

    // Pause between clusters
    await sleep(1000);
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Seed complete: ${seeded} created, ${failed} failed`);
  console.log(`  Batch tag: ${SEED_BATCH}`);
  console.log(`══════════════════════════════════════════\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
