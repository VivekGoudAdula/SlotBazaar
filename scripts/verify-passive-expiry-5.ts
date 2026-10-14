/**
 * scripts/verify-passive-expiry-5.ts
 *
 * Precisely tests passive entity expiration on Arkiv Tiramisu:
 * 1. Connects to WebSocket: wss://rpc.tiramisu.db-chain.testnet.arkiv.network
 * 2. Creates 5 entities with 20-second lifespans (safely future blocks: current block + ~7-10 blocks)
 * 3. Captures all WebSocket events for 60 seconds
 * 4. Checks whether ANY event (EntityDeleted, EntityExpired, etc.) is emitted when the 5 entities reach expiration
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
import { http, webSocket, type Hex, type Address } from "viem";

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("PRIVATE_KEY required");
    process.exit(1);
  }

  const account = privateKeyToAccount(rawKey as Hex);
  console.log("========================================================");
  console.log("  PASSIVE EXPIRATION AUDIT (5 ENTITIES, 60s OBSERVATION)");
  console.log("========================================================");

  const wsClient = createPublicClient({
    chain: tiramisu,
    transport: webSocket("wss://rpc.tiramisu.db-chain.testnet.arkiv.network"),
  });

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const allEvents: Array<{ type: string; entityKey?: string; time: number }> = [];

  const unwatch = wsClient.watchEntityEvents({
    onEntityCreated: (event) => {
      allEvents.push({ type: "EntityCreated", entityKey: event.entityKey.toLowerCase(), time: Date.now() });
    },
    onEntityDeleted: (event) => {
      allEvents.push({ type: "EntityDeleted", entityKey: (event as any).entityKey?.toLowerCase(), time: Date.now() });
    },
    onEvent: (event) => {
      allEvents.push({ type: event.type, entityKey: (event as any).entityKey?.toLowerCase(), time: Date.now() });
    },
  });

  // Wait for WS connection
  await new Promise((r) => setTimeout(r, 2000));

  const tracked: Array<{ id: number; key: string; txHash: string; expiresAtSec: number; createdAtMs: number }> = [];

  console.log("Creating 5 entities with 20-second expiration windows...");
  for (let i = 1; i <= 5; i++) {
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAtSec = nowSec + 20;

    const res = await wallet.createEntity({
      payload: jsonToPayload({ title: `expiry-probe-${i}`, schema_version: 1 }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("slot"),
        schema_v: str("1"),
        category: str("machine"),
        cluster: str("surat"),
        starts_at: u64(BigInt(nowSec)),
        ends_at: u64(BigInt(expiresAtSec)),
        price_band: str("low"),
        lat_e4: i32(211700),
        lon_e4: i32(728300),
        synthetic: bool(true),
        seed_batch: str("dev-probe"),
      },
      expires: ExpirationTime.atDate(new Date(expiresAtSec * 1000)),
    });

    const normKey = res.entityKey.toLowerCase();
    tracked.push({ id: i, key: normKey, txHash: res.txHash, expiresAtSec, createdAtMs: Date.now() });
    console.log(`  [Entity #${i}] Key: ${normKey.slice(0, 16)}… Tx: ${res.txHash.slice(0, 14)}… Expires in 20s (at ${new Date(expiresAtSec * 1000).toLocaleTimeString()})`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\nWaiting 50 seconds to cover complete expiration of all 5 entities...");
  const tStart = Date.now();
  while (Date.now() - tStart < 50000) {
    const elapsed = Math.round((Date.now() - tStart) / 1000);
    process.stdout.write(`\r  Elapsed: ${elapsed}s / 50s`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\nObservation complete.");

  unwatch();

  console.log("\n========================================================");
  console.log("  PASSIVE EXPIRATION OBSERVATION AUDIT");
  console.log("========================================================");
  for (const item of tracked) {
    const matchingCreations = allEvents.filter((e) => e.entityKey === item.key && e.type === "EntityCreated");
    const matchingExpiries = allEvents.filter((e) => e.entityKey === item.key && e.type !== "EntityCreated");
    console.log(`Entity #${item.id} (${item.key.slice(0, 16)}…):`);
    console.log(`  Creation events received: ${matchingCreations.length}`);
    console.log(`  Expiry/Deletion events received: ${matchingExpiries.length}`);
  }

  const allExpiryMatches = allEvents.filter(
    (e) => tracked.some((t) => t.key === e.entityKey) && e.type !== "EntityCreated"
  );
  console.log(`\nTotal Expiry Events across tracked entities: ${allExpiryMatches.length}`);
  if (allExpiryMatches.length === 0) {
    console.log("✅ CONFIRMED: Passive entity expiration emits ZERO on-chain event logs over WebSocket.");
  } else {
    console.log(`Observed ${allExpiryMatches.length} expiry events:`, allExpiryMatches);
  }
}

main().catch(console.error);
