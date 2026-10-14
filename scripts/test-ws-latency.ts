/**
 * scripts/test-ws-latency.ts
 *
 * Measures WebSocket event delivery latency on Arkiv Tiramisu:
 * - Subscribes to wss://rpc.tiramisu.db-chain.testnet.arkiv.network using webSocket transport
 * - Creates 5 synthetic dev-probe entities sequentially
 * - Tracks exact timestamp when WebSocket receives EntityCreated event vs when tx receipt is confirmed
 * - Checks for duplicates, out-of-order delivery, and whether expiration produces an event
 *
 * Usage: npx tsx scripts/test-ws-latency.ts
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

interface ProbeSample {
  sample: number;
  entityKey: Hex;
  txHash: Hex;
  confirmedAt: number;
  eventReceivedAt: number;
  latencyMs: number;
  eventOrder: number;
}

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌ PRIVATE_KEY env var is required.");
    process.exit(1);
  }

  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account = privateKeyToAccount(privateKey);
  const walletAddr: Address = account.address;

  console.log("\n========================================================");
  console.log("  ARKIV WEBSOCKET EVENT LATENCY MEASUREMENT");
  console.log("========================================================");
  console.log(`Wallet     : ${walletAddr}`);
  console.log(`WS URL     : wss://rpc.tiramisu.db-chain.testnet.arkiv.network`);

  // 1. Setup WebSocket Client
  const wsClient = createPublicClient({
    chain: tiramisu,
    transport: webSocket("wss://rpc.tiramisu.db-chain.testnet.arkiv.network"),
  });

  // 2. Setup HTTP Wallet Client for writes
  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  // Global map of all events delivered over WS: entityKey (lowercase) -> { receivedAt, order, txHash }
  const receivedEvents = new Map<string, { receivedAt: number; order: number; txHash?: string }>();
  const txHashToKey = new Map<string, string>();
  const allEventsSeen: Array<{ type: string; entityKey?: string; txHash?: string; time: number }> = [];
  let eventCounter = 0;

  console.log("Subscribing to entity events via WebSocket...");
  const unwatch = wsClient.watchEntityEvents({
    onEntityCreated: (event) => {
      eventCounter++;
      const normKey = event.entityKey.toLowerCase();
      const normTx = (event as any).transactionHash?.toLowerCase();
      receivedEvents.set(normKey, { receivedAt: Date.now(), order: eventCounter, txHash: normTx });
      if (normTx) {
        txHashToKey.set(normTx, normKey);
      }
      allEventsSeen.push({ type: "EntityCreated", entityKey: normKey, txHash: normTx, time: Date.now() });
    },
    onEvent: (event) => {
      if (event.type !== "EntityCreated") {
        allEventsSeen.push({
          type: event.type,
          entityKey: (event as any).entityKey?.toLowerCase(),
          txHash: (event as any).transactionHash?.toLowerCase(),
          time: Date.now(),
        });
      }
    },
    onError: (err) => {
      console.error("WebSocket Watcher Error:", err.message);
    },
  });

  // Wait for WS subscription handshake
  await new Promise((r) => setTimeout(r, 2500));

  const samples: ProbeSample[] = [];
  const TOTAL_SAMPLES = 5;

  console.log(`Beginning ${TOTAL_SAMPLES} sequential probe writes...\n`);

  for (let i = 1; i <= TOTAL_SAMPLES; i++) {
    const nowSec = Math.floor(Date.now() / 1000);
    const endsAt = nowSec + 3600;

    process.stdout.write(`Sample [${i}/${TOTAL_SAMPLES}] creating probe... `);

    const res = await wallet.createEntity({
      payload: jsonToPayload({
        title: `dev-probe latency ${i}`,
        description: "WebSocket latency benchmark probe",
        schema_version: 1,
      }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("slot"),
        schema_v: str("1"),
        category: str("machine"),
        cluster: str("surat"),
        starts_at: u64(BigInt(nowSec + 60)),
        ends_at: u64(BigInt(endsAt)),
        price_band: str("low"),
        lat_e4: i32(211700),
        lon_e4: i32(728300),
        synthetic: bool(true),
        seed_batch: str("dev-probe"),
      },
      expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
    });

    const confirmedAt = Date.now();
    const createdKey = res.entityKey as Hex;
    const normKey = createdKey.toLowerCase();
    const normTx = (res.txHash as Hex).toLowerCase();

    // Check if event already arrived during createEntity or wait up to 10s
    let eventEntry = receivedEvents.get(normKey);
    if (!eventEntry && txHashToKey.has(normTx)) {
      const k = txHashToKey.get(normTx)!;
      eventEntry = receivedEvents.get(k);
    }

    if (!eventEntry) {
      process.stdout.write(`tx confirmed (${res.txHash.slice(0, 10)}…). Waiting for WS event... `);
      const waitStart = Date.now();
      while (Date.now() - waitStart < 10000) {
        eventEntry = receivedEvents.get(normKey);
        if (!eventEntry && txHashToKey.has(normTx)) {
          const k = txHashToKey.get(normTx)!;
          eventEntry = receivedEvents.get(k);
        }
        if (eventEntry) break;
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (eventEntry) {
      // Relative latency: time between receipt confirmation and WS event delivery
      // Note: If WS pushed before HTTP receipt query returned, difference is small/zero
      const latencyMs = Math.abs(eventEntry.receivedAt - confirmedAt);
      samples.push({
        sample: i,
        entityKey: createdKey,
        txHash: res.txHash as Hex,
        confirmedAt,
        eventReceivedAt: eventEntry.receivedAt,
        latencyMs,
        eventOrder: eventEntry.order,
      });
      console.log(`✅ matched event #${eventEntry.order} (latency: ${latencyMs} ms)`);
    } else {
      console.log(`❌ event not captured`);
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  // 3. Expiration Event Test
  console.log("\nTesting whether passive slot expiration emits an on-chain event...");
  const shortNow = Math.floor(Date.now() / 1000);
  const shortEndsAt = shortNow + 10; // 10s expiry
  const shortRes = await wallet.createEntity({
    payload: jsonToPayload({ title: "dev-probe short-expiry", schema_version: 1 }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("slot"),
      schema_v: str("1"),
      category: str("machine"),
      cluster: str("surat"),
      starts_at: u64(BigInt(shortNow)),
      ends_at: u64(BigInt(shortEndsAt)),
      price_band: str("low"),
      lat_e4: i32(211700),
      lon_e4: i32(728300),
      synthetic: bool(true),
      seed_batch: str("dev-probe"),
    },
    expires: ExpirationTime.atDate(new Date(shortEndsAt * 1000)),
  });

  const shortKeyNorm = shortRes.entityKey.toLowerCase();
  console.log(`Created short-lived entity ${shortKeyNorm.slice(0, 16)}… expires in 10s.`);
  console.log("Waiting 15 seconds to observe any expiration event on-chain...");
  const eventsCountBefore = allEventsSeen.length;
  await new Promise((r) => setTimeout(r, 15000));
  const newEvents = allEventsSeen.slice(eventsCountBefore);
  const expiryEvents = newEvents.filter((e) => e.entityKey === shortKeyNorm && e.type !== "EntityCreated");

  unwatch();

  // Print results
  console.log("\n========================================================");
  console.log("  WEBSOCKET LATENCY RESULTS TABLE");
  console.log("========================================================");
  console.log("| # | Entity Key (truncated) | Tx Hash (truncated) | Latency (ms) | Order |");
  console.log("|---|------------------------|---------------------|--------------|-------|");
  for (const s of samples) {
    console.log(
      `| ${s.sample} | ${s.entityKey.slice(0, 22)}... | ${s.txHash.slice(0, 19)}... | ${String(s.latencyMs).padStart(12)} | ${String(s.eventOrder).padStart(5)} |`
    );
  }

  if (samples.length > 0) {
    const avgLatency = Math.round(samples.reduce((acc, s) => acc + s.latencyMs, 0) / samples.length);
    const minLatency = Math.min(...samples.map((s) => s.latencyMs));
    const maxLatency = Math.max(...samples.map((s) => s.latencyMs));
    console.log(`\nAverage Latency: ${avgLatency} ms (Min: ${minLatency} ms, Max: ${maxLatency} ms)`);
  }

  console.log("\nProtocol Expiration Event Findings:");
  if (expiryEvents.length === 0) {
    console.log("  ✅ Expiration does NOT emit an on-chain event. Protocol prunes passively by timestamp.");
  } else {
    console.log(`  Emitted events on expiration: ${JSON.stringify(expiryEvents)}`);
  }

  console.log("\nEvent Ordering & Duplicate Findings:");
  let inOrder = true;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].eventOrder < samples[i - 1].eventOrder) {
      inOrder = false;
    }
  }
  console.log(`  Events arrived in order: ${inOrder}`);

  // Check duplicates in all probe events
  const sampleKeySet = new Set(samples.map((s) => s.entityKey.toLowerCase()));
  const seenSampleKeys = allEventsSeen.filter((e) => e.entityKey && sampleKeySet.has(e.entityKey));
  const keyFrequencies = new Map<string, number>();
  for (const ev of seenSampleKeys) {
    if (ev.entityKey) {
      keyFrequencies.set(ev.entityKey, (keyFrequencies.get(ev.entityKey) || 0) + 1);
    }
  }
  const duplicates = Array.from(keyFrequencies.entries()).filter(([k, count]) => count > 1);
  console.log(`  Duplicates among probed entities: ${duplicates.length > 0 ? duplicates.length : "None (0 duplicates)"}\n`);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
