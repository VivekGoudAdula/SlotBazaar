/**
 * scripts/test-queries.ts
 *
 * Phase 1: End-to-end verification of typed read/write layer (src/lib/arkiv.ts)
 * Creates 3 synthetic slots, 1 booking, 2 completions, evaluates multi-creator reputation,
 * and runs performance/rate-limit/indexing probes.
 *
 * Usage: npx tsx scripts/test-queries.ts
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, key } from "@arkiv-network/sdk/attr";
import { eq, and } from "@arkiv-network/sdk/query";
import { http, parseEther, createWalletClient as viemCreateWalletClient, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  getArkivPublicClient,
  fetchLiveSlots,
  fetchSlotsByCluster,
  fetchSlotsByCategory,
  fetchSlotsByCreator,
  fetchBookingsForSlot,
  fetchCompletionsForSlot,
  getReputation,
  createSlot,
  createBooking,
  createCompletion,
  PROJECT_NAMESPACE,
  type SlotEntity,
} from "../src/lib/arkiv.js";

async function main() {
  console.log("============================================================");
  console.log("       SlotBazaar Phase 1: Test Read & Write Layer           ");
  console.log("============================================================\n");

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey?.trim()) throw new Error("PRIVATE_KEY not set in .env");
  const hexKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const sellerAccount = privateKeyToAccount(hexKey);
  const sellerAddress = sellerAccount.address;

  const publicClient = getArkivPublicClient();
  const sellerWallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account: sellerAccount,
  });

  console.log(`Primary Seller Wallet : ${sellerAddress}`);

  // ── Step 0: Setup Ephemeral Buyer Wallet ──────────────────────────────────
  console.log("\n--- Setting up Ephemeral Buyer Wallet ---");
  const buyerPrivateKey = generatePrivateKey();
  const buyerAccount = privateKeyToAccount(buyerPrivateKey);
  const buyerAddress = buyerAccount.address;
  console.log(`Generated Ephemeral Buyer: ${buyerAddress}`);

  let buyerWallet = sellerWallet; // default fallback if funding fails
  let buyerFunded = false;

  try {
    console.log("Funding ephemeral buyer with 0.002 test GLM from seller...");
    const rawViemWallet = viemCreateWalletClient({
      account: sellerAccount,
      chain: tiramisu,
      transport: http(),
    });
    const tx = await rawViemWallet.sendTransaction({
      to: buyerAddress,
      value: parseEther("0.002"),
    });
    console.log(`✅ Funding tx sent: ${tx}`);
    // Wait briefly for inclusion
    await new Promise((r) => setTimeout(r, 4000));
    buyerWallet = createWalletClient({
      chain: tiramisu,
      transport: http(),
      account: buyerAccount,
    });
    buyerFunded = true;
    console.log("✅ Ephemeral buyer wallet successfully funded and initialized.");
  } catch (fundErr) {
    console.warn("⚠️ Native funding transfer failed:", (fundErr as Error).message);
    console.warn("Falling back to seller wallet for all actions; multi-creator check will note this.");
  }

  // ── Step 1: Create 3 Synthetic Slots ───────────────────────────────────────
  console.log("\n--- Creating 3 Synthetic Slots ---");
  const now = Math.floor(Date.now() / 1000);

  console.log("1. Creating Slot A (CNC Machine - Surat)...");
  const slotA = await createSlot(sellerWallet, {
    category: "machine",
    cluster: "surat",
    startsAt: now + 3600,
    endsAt: now + 14400, // +4h
    priceBand: "mid",
    lat: 21.1702,
    lon: 72.8311,
    title: "CNC 5-Axis Milling Slot (4h Window)",
    description: "Available Haas 5-Axis milling time in Surat GIDC industrial cluster.",
    sellerLabel: "Surat Precision Works",
    synthetic: true,
  });
  console.log(`   Slot A Key: ${slotA.entityKey} (Tx: ${slotA.txHash})`);

  console.log("2. Creating Slot B (Express Freight - Mumbai)...");
  const slotB = await createSlot(sellerWallet, {
    category: "transport",
    cluster: "mumbai",
    startsAt: now + 7200,
    endsAt: now + 21600, // +6h
    priceBand: "high",
    lat: 19.0760,
    lon: 72.8777,
    title: "14ft Container Truck Mumbai -> Pune",
    description: "Empty return leg container transport slot from Navi Mumbai.",
    sellerLabel: "Sahyadri Logistics",
    synthetic: true,
  });
  console.log(`   Slot B Key: ${slotB.entityKey} (Tx: ${slotB.txHash})`);

  console.log("3. Creating Slot C (CAD Designer - Bengaluru)...");
  const slotC = await createSlot(sellerWallet, {
    category: "freelance",
    cluster: "bengaluru",
    startsAt: now + 10800,
    endsAt: now + 28800, // +8h
    priceBand: "low",
    lat: 12.9716,
    lon: 77.5946,
    title: "SolidWorks Mechanical Modeling (4h Sprint)",
    description: "Freelance CAD modeling and DFM revision session.",
    sellerLabel: "Kavita Engineering",
    synthetic: true,
  });
  console.log(`   Slot C Key: ${slotC.entityKey} (Tx: ${slotC.txHash})`);

  // Wait a short moment for index inclusion
  await new Promise((r) => setTimeout(r, 4000));

  // ── Step 2: Create 1 Booking on Slot A ─────────────────────────────────────
  console.log("\n--- Creating 1 Booking on Slot A ---");
  const bookingA = await createBooking(buyerWallet, {
    slotKey: slotA.entityKey,
    slotEndsAt: now + 14400,
    note: "Booking for aluminum fixture fabrication test.",
    synthetic: true,
  });
  console.log(`   Booking Key: ${bookingA.entityKey} (Tx: ${bookingA.txHash})`);
  console.log(`   Booked by   : ${buyerFunded ? buyerAddress : sellerAddress}`);

  await new Promise((r) => setTimeout(r, 4000));

  // ── Step 3: Create 2 Completions for Slot A ────────────────────────────────
  console.log("\n--- Creating 2 Completions for Slot A ---");
  console.log("1. Submitting Seller Completion...");
  const compSeller = await createCompletion(sellerWallet, {
    slotKey: slotA.entityKey,
    role: "seller",
    note: "Job fulfilled on schedule, client specs met.",
    synthetic: true,
  });
  console.log(`   Seller Completion Key: ${compSeller.entityKey} (Tx: ${compSeller.txHash})`);

  console.log("2. Submitting Buyer Completion...");
  const compBuyer = await createCompletion(buyerWallet, {
    slotKey: slotA.entityKey,
    role: "buyer",
    note: "Parts received within tolerances, excellent work.",
    synthetic: true,
  });
  console.log(`   Buyer Completion Key : ${compBuyer.entityKey} (Tx: ${compBuyer.txHash})`);

  await new Promise((r) => setTimeout(r, 4000));

  // ── Step 4: Run Read Queries ──────────────────────────────────────────────
  console.log("\n============================================================");
  console.log("             Executing Read Layer Query Suite               ");
  console.log("============================================================\n");

  console.log("▶ 1. fetchLiveSlots()");
  const liveSlots = await fetchLiveSlots(publicClient);
  console.log(`   Total Live Slots Retrieved: ${liveSlots.length}`);
  for (const [i, s] of liveSlots.slice(0, 5).entries()) {
    console.log(`   [${i}] ${s.title} | ${s.category} | ${s.cluster} | ends in ${(s.endsAt - now)}s | key=${s.key.slice(0, 14)}...`);
  }
  // Check client sort order
  let isSorted = true;
  for (let i = 1; i < liveSlots.length; i++) {
    if (liveSlots[i].endsAt < liveSlots[i - 1].endsAt) isSorted = false;
  }
  console.log(`   Client sort (ends_at ascending): ${isSorted ? "✅ VERIFIED" : "❌ FAILED"}`);

  console.log("\n▶ 2. fetchSlotsByCluster('surat')");
  const suratSlots = await fetchSlotsByCluster("surat", publicClient);
  console.log(`   Surat Slots Count: ${suratSlots.length}`);
  suratSlots.forEach((s) => console.log(`   - ${s.title} (${s.cluster})`));

  console.log("\n▶ 3. fetchSlotsByCategory('transport')");
  const transportSlots = await fetchSlotsByCategory("transport", publicClient);
  console.log(`   Transport Slots Count: ${transportSlots.length}`);
  transportSlots.forEach((s) => console.log(`   - ${s.title} (${s.category})`));

  console.log("\n▶ 4. fetchSlotsByCreator(sellerAddress)");
  const sellerSlots = await fetchSlotsByCreator(sellerAddress, publicClient);
  console.log(`   Seller Slots Count: ${sellerSlots.length}`);

  console.log("\n▶ 5. fetchBookingsForSlot(slotA.entityKey)");
  const bookingsRes = await fetchBookingsForSlot(slotA.entityKey, publicClient);
  console.log(`   Total Bookings for Slot A: ${bookingsRes.all.length}`);
  if (bookingsRes.winner) {
    console.log(`   Winning Booking Key : ${bookingsRes.winner.key}`);
    console.log(`   Created at Block    : ${bookingsRes.winner.createdAtBlock}`);
    console.log(`   Booked by           : ${bookingsRes.winner.creator}`);
  }

  console.log("\n▶ 6. fetchCompletionsForSlot(slotA.entityKey)");
  const completions = await fetchCompletionsForSlot(slotA.entityKey, publicClient);
  console.log(`   Total Completions for Slot A: ${completions.length}`);
  completions.forEach((c) => {
    console.log(`   - Role: ${c.role} | Creator: ${c.creator} | Key: ${c.key.slice(0, 14)}...`);
  });

  console.log("\n▶ 7. getReputation(sellerAddress)");
  const sellerRep = await getReputation(sellerAddress, publicClient);
  console.log(`   Seller Verified Jobs Count: ${sellerRep.verifiedJobsCount}`);
  console.log(`   Verified Slot Keys        : ${sellerRep.verifiedSlotKeys.join(", ") || "(none)"}`);

  if (buyerFunded) {
    console.log("\n▶ 8. getReputation(buyerAddress)");
    const buyerRep = await getReputation(buyerAddress, publicClient);
    console.log(`   Buyer Verified Jobs Count : ${buyerRep.verifiedJobsCount}`);
    console.log(`   Verified Slot Keys        : ${buyerRep.verifiedSlotKeys.join(", ") || "(none)"}`);
  }

  // ── Step 5: Probes ────────────────────────────────────────────────────────
  console.log("\n============================================================");
  console.log("            Executing Network & Performance Probes           ");
  console.log("============================================================\n");

  // Probe A: 50 Rapid Reads (Rate Limit Stress Test)
  console.log("--- Probe A: 50 Rapid Reads on Public RPC ---");
  const rapidStart = Date.now();
  const promises = Array.from({ length: 50 }, (_, i) =>
    publicClient.getBlockTiming().then(() => ({ index: i, ok: true })).catch((e: Error) => ({ index: i, ok: false, error: e.message }))
  );
  const results = await Promise.all(promises);
  const rapidElapsed = Date.now() - rapidStart;
  const successCount = results.filter((r) => r.ok).length;
  const errorCount = results.filter((r) => !r.ok).length;
  console.log(`   50 Parallel Requests dispatched in ${rapidElapsed}ms`);
  console.log(`   Successes : ${successCount}/50`);
  console.log(`   Errors    : ${errorCount}/50`);
  if (errorCount > 0) {
    console.log(`   Sample Error: ${results.find((r) => !r.ok)?.error}`);
  }

  // Probe B: Propagation Time (Creation to Query Visibility)
  console.log("\n--- Probe B: Index Propagation Delay ---");
  const propStart = Date.now();
  const probeEntity = await sellerWallet.createEntity({
    payload: jsonToPayload({ note: "propagation probe" }),
    contentType: "application/json",
    attributes: {
      project: str(PROJECT_NAMESPACE),
      entity_type: str("probe"),
    },
    expires: ExpirationTime.fromMinutes(10),
  });
  const txConfirmedTime = Date.now();
  console.log(`   Created probe entity: ${probeEntity.entityKey} in ${txConfirmedTime - propStart}ms`);

  let visible = false;
  let attempts = 0;
  const pollStart = Date.now();
  while (!visible && attempts < 20) {
    attempts++;
    const res = await publicClient
      .select({ key: true })
      .where(and(
        eq("project", str(PROJECT_NAMESPACE)),
        eq("entity_type", str("probe"))
      ))
      .fetch();
    if (res.entities.some((e) => e.key === probeEntity.entityKey)) {
      visible = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const propTotal = Date.now() - pollStart;
  console.log(`   Appeared in query after : ${propTotal}ms (${attempts} poll attempts)`);

  // Probe C: Query against Expired Slot
  console.log("\n--- Probe C: Query Behavior for Expired Slot ---");
  const expiredKey: Hex = "0x40c9380d0ec3a4f3273544209436833fc1005bd7e61f5a37d755cabb8a0d3780";
  console.log(`   Querying for known expired entity key: ${expiredKey}...`);
  const expiredQueryResult = await publicClient
    .select({ key: true })
    .where(and(
      eq("project", str(PROJECT_NAMESPACE)),
      eq("entity_type", str("expiry_test"))
    ))
    .fetch();
  const inQuery = expiredQueryResult.entities.some((e) => e.key === expiredKey);
  console.log(`   Is expired entity present in select() query? ${inQuery ? "YES (Unexpected)" : "NO (Correctly pruned)"}`);
  console.log(`   Total query results count: ${expiredQueryResult.entities.length}`);

  let getEntityResult = "none";
  try {
    await publicClient.getEntity(expiredKey);
    getEntityResult = "Entity returned (Unexpected)";
  } catch (err) {
    getEntityResult = `Threw ${(err as Error).name}: "${(err as Error).message}"`;
  }
  console.log(`   getEntity(${expiredKey.slice(0, 14)}...) result: ${getEntityResult}`);

  console.log("\n============================================================");
  console.log("                 Phase 1 Verification Complete               ");
  console.log("============================================================\n");
}

main().catch((err) => {
  console.error("❌ Fatal error in test-queries.ts:", err);
  process.exit(1);
});
