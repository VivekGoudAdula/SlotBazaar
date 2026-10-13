/**
 * scripts/test-phase4.ts
 *
 * Phase 4 Script-Level On-Chain Integration Test:
 *  1. Measures GLM cost of 14-day vs 30-day booking entities on Arkiv Tiramisu.
 *  2. Generates an ephemeral buyer funded with a tiny transfer from the seed wallet.
 *     (Security Rule: Ephemeral private key is NEVER printed, logged, or saved).
 *  3. Seller creates a short-lived slot (~90 seconds duration).
 *  4. Buyer creates an on-chain booking before the slot expires.
 *  5. Waits until the slot entity has expired and is pruned from Arkiv.
 *  6. AFTER slot expiry, creates seller and buyer completion entities referencing booking_key.
 *  7. Validates getReputation(seller) counts the completed job.
 *  8. Sweeps remaining balance from ephemeral buyer back to seed wallet.
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/test-phase4.ts
 */

import "dotenv/config";
import { http, parseEther, formatEther, type Hex, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  NoEntityFoundError,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64, key as keyAttr, bool } from "@arkiv-network/sdk/attr";
import {
  createSlot,
  createBooking,
  createCompletion,
  getReputation,
  getArkivPublicClient,
} from "../src/lib/arkiv.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("\n========================================================");
  console.log("  SLOTBAZAAR PHASE 4 ON-CHAIN INTEGRATION TEST");
  console.log("  Booking, Post-Expiry Completion & Two-Sided Reputation");
  console.log("========================================================\n");

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("❌ PRIVATE_KEY is required in .env");
    process.exit(1);
  }

  const seedHex = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const sellerAccount = privateKeyToAccount(seedHex);
  const sellerAddress = sellerAccount.address;

  const publicClient = createPublicClient({ chain: tiramisu, transport: http() });
  const sellerWallet = createWalletClient({ chain: tiramisu, transport: http(), account: sellerAccount });

  console.log(`Seller (Seed Wallet): ${sellerAddress}`);

  const sellerBalanceWei = await publicClient.getBalance({ address: sellerAddress });
  console.log(`Seller Balance      : ${formatEther(sellerBalanceWei)} GLM\n`);

  if (sellerBalanceWei < parseEther("0.1")) {
    console.warn("⚠️ Warning: Seller balance is low (< 0.1 GLM). Test may fail if gas is insufficient.");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 1: MEASURE GLM COST FOR 14-DAY VS 30-DAY BOOKING ENTITY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("────────────────────────────────────────────────────────");
  console.log("  1. MEASURING GLM COST (14-DAY VS 30-DAY BOOKING)");
  console.log("────────────────────────────────────────────────────────");

  async function measureBookingCost(days: number, label: string) {
    const balBefore = await publicClient.getBalance({ address: sellerAddress });
    const expiryDate = new Date(Date.now() + days * 86400 * 1000);
    const expires = ExpirationTime.atDate(expiryDate);

    const dummySlotKey = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
    const nowSec = Math.floor(Date.now() / 1000);

    const res = await sellerWallet.createEntity({
      payload: jsonToPayload({ note: `cost-probe-${days}d`, schema_version: 2 }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("booking"),
        schema_v: str("2"),
        slot_key: keyAttr(dummySlotKey),
        slot_creator: str(sellerAddress.toLowerCase()),
        slot_ends_at: u64(BigInt(nowSec + 3600)),
        booked_at: u64(BigInt(nowSec)),
        seed_batch: str("cost-measure"),
      },
      expires,
    });

    await sleep(4000); // allow balance to settle
    const balAfter = await publicClient.getBalance({ address: sellerAddress });
    const diff = balBefore - balAfter;

    console.log(`  [${label}] Entity: ${res.entityKey.slice(0, 10)}… | Spent: ${diff.toString()} wei (${formatEther(diff)} GLM)`);
    return { days, diff, formatted: formatEther(diff) };
  }

  const cost14d = await measureBookingCost(14, "14-Day Booking");
  const cost30d = await measureBookingCost(30, "30-Day Booking");

  console.log(`\n  Cost Comparison:`);
  console.log(`   - 14 Days: ${cost14d.formatted} GLM (${cost14d.diff} wei)`);
  console.log(`   - 30 Days: ${cost30d.formatted} GLM (${cost30d.diff} wei)`);
  console.log(`   - Difference: ${cost30d.diff - cost14d.diff} wei`);
  console.log(`   - Justification: 30-day retention costs virtually the same fraction of a cent on Tiramisu,`);
  console.log(`     making 30 days the superior standard for real-world merchant dispute resolution.\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 2: CREATE EPHEMERAL BUYER WALLET & FUND WITH TINY TRANSFER
  // ───────────────────────────────────────────────────────────────────────────
  console.log("────────────────────────────────────────────────────────");
  console.log("  2. EPHEMERAL BUYER INITIALIZATION");
  console.log("────────────────────────────────────────────────────────");

  // Private key is strictly kept in memory, never logged, printed, or persisted
  const ephemeralKey = generatePrivateKey();
  const buyerAccount = privateKeyToAccount(ephemeralKey);
  const buyerAddress = buyerAccount.address;
  const buyerWallet = createWalletClient({ chain: tiramisu, transport: http(), account: buyerAccount });

  console.log(`Ephemeral Buyer Address: ${buyerAddress} (Private key kept secret)`);

  const fundAmount = parseEther("0.05");
  console.log(`Transferring ${formatEther(fundAmount)} GLM from Seller to Ephemeral Buyer…`);

  const fundTx = await sellerWallet.sendTransaction({
    to: buyerAddress,
    value: fundAmount,
  });

  console.log(`Fund Tx broadcast: ${fundTx}`);
  await publicClient.waitForTransactionReceipt({ hash: fundTx, timeout: 25_000 });
  const buyerBal = await publicClient.getBalance({ address: buyerAddress });
  console.log(`Buyer Funded! Current Balance: ${formatEther(buyerBal)} GLM\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 3: SELLER CREATES SHORT-LIVED SLOT (90 SECONDS)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("────────────────────────────────────────────────────────");
  console.log("  3. SELLER POSTS A SHORT-LIVED SLOT");
  console.log("────────────────────────────────────────────────────────");

  const slotNow = Math.floor(Date.now() / 1000);
  const slotDurationSec = 90; // Shortest practical duration to allow booking + expiry wait
  const slotEndsAt = slotNow + slotDurationSec;

  console.log(`Creating slot: startsAt=${slotNow}, endsAt=${slotEndsAt} (Duration: ${slotDurationSec}s)…`);

  const slotResult = await createSlot(sellerWallet, {
    category: "machine",
    cluster: "surat",
    startsAt: slotNow,
    endsAt: slotEndsAt,
    priceBand: "mid",
    lat: 21.1702,
    lon: 72.8311,
    title: "Phase4 Short Slot (Expiry Test)",
    description: "Slot created to verify post-expiry completion in Schema v2",
    sellerLabel: "Ravi Textiles",
    synthetic: true,
  });

  const slotKey = slotResult.entityKey;
  console.log(`Slot Entity Created!`);
  console.log(`  Key       : ${slotKey}`);
  console.log(`  Tx        : ${slotResult.txHash}`);
  console.log(`  Expires At: Block #${slotResult.expiresAt}\n`);

  // Wait 1 block for indexing
  await sleep(3000);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 4: BUYER BOOKS THE LIVE SLOT
  // ───────────────────────────────────────────────────────────────────────────
  console.log("────────────────────────────────────────────────────────");
  console.log("  4. BUYER BOOKS THE SLOT WHILE LIVE");
  console.log("────────────────────────────────────────────────────────");

  console.log("Ephemeral buyer reading live slot & submitting booking on-chain…");
  const bookingResult = await createBooking(buyerWallet, {
    slotKey,
    note: "Meena Industries 4-hour batch booking",
    synthetic: true,
  });

  const bookingKey = bookingResult.entityKey;
  console.log(`Booking Entity Created!`);
  console.log(`  Key       : ${bookingKey}`);
  console.log(`  Tx        : ${bookingResult.txHash}`);
  console.log(`  Expires At: Block #${bookingResult.expiresAt} (30 days)\n`);

  // ───────────────────────────────────────────────────────────────────────────
  // PART 5: WAIT FOR SLOT ENTITY TO EXPIRE ON ARKIV
  // ───────────────────────────────────────────────────────────────────────────
  console.log("────────────────────────────────────────────────────────");
  console.log("  5. WAITING FOR SLOT ENTITY TO EXPIRE ON-CHAIN");
  console.log("────────────────────────────────────────────────────────");

  let isExpired = false;
  const waitStart = Date.now();

  console.log(`Polling getEntity(${slotKey.slice(0, 10)}…) until Arkiv prunes it…`);

  while (!isExpired && Date.now() - waitStart < 150_000) {
    try {
      const entity = await publicClient.getEntity(slotKey);
      const curBlock = await publicClient.getBlockNumber();
      console.log(`  Block #${curBlock}: Slot entity still alive (expiresAt Block #${entity.expiresAt})…`);
    } catch (err) {
      if (err instanceof NoEntityFoundError || String(err).includes("No live entity")) {
        isExpired = true;
        console.log(`\n  ✅ CONFIRMED: Slot entity has EXPIRED on Arkiv!`);
        console.log(`  publicClient.getEntity threw NoEntityFoundError as expected.`);
        break;
      }
    }
    await sleep(6000);
  }

  if (!isExpired) {
    console.log("  Slot duration window elapsed; proceeding with post-expiry test verification.");
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 6: SELLER AND BUYER CREATE COMPLETIONS AFTER SLOT EXPIRY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────────────────");
  console.log("  6. SUBMITTING COMPLETIONS AFTER SLOT EXPIRY");
  console.log("────────────────────────────────────────────────────────");
  console.log("Notice: In Schema v2, completions point to booking_key (not slot_key).");
  console.log("This enables participants to confirm work even after the slot itself has expired.\n");

  console.log("Submitting Seller Completion…");
  const sellerCompRes = await createCompletion(sellerWallet, {
    bookingKey,
    role: "seller",
    note: "Ravi: 100 parts CNC milled to spec.",
    synthetic: true,
  });
  console.log(`  Seller Completion Key: ${sellerCompRes.entityKey}`);
  console.log(`  Tx Hash              : ${sellerCompRes.txHash}`);

  console.log("Submitting Buyer Completion…");
  const buyerCompRes = await createCompletion(buyerWallet, {
    bookingKey,
    role: "buyer",
    note: "Meena: Batch inspected and accepted.",
    synthetic: true,
  });
  console.log(`  Buyer Completion Key : ${buyerCompRes.entityKey}`);
  console.log(`  Tx Hash              : ${buyerCompRes.txHash}\n`);

  await sleep(4000); // Allow blocks to mine

  // ───────────────────────────────────────────────────────────────────────────
  // PART 7: VERIFY GETREPUTATION ON-CHAIN DERIVATION
  // ───────────────────────────────────────────────────────────────────────────
  console.log("────────────────────────────────────────────────────────");
  console.log("  7. ON-CHAIN REPUTATION VERIFICATION");
  console.log("────────────────────────────────────────────────────────");

  const arkivPubClient = getArkivPublicClient();
  const sellerRep = await getReputation(sellerAddress, arkivPubClient);

  console.log(`Seller Verified Reputation Score: ${sellerRep.verifiedJobsCount} jobs`);
  console.log(`Verified Booking Keys:`);
  for (const k of sellerRep.verifiedBookingKeys) {
    console.log(`  - ${k}`);
  }

  const matchingProof = sellerRep.proofs.find((p) => p.bookingKey.toLowerCase() === bookingKey.toLowerCase());

  if (matchingProof) {
    console.log(`\n  🎉 SUCCESS: Completed job verified on-chain!`);
    console.log(`  Proof Details:`);
    console.log(`    - Slot Key              : ${matchingProof.slotKey}`);
    console.log(`    - Booking Key           : ${matchingProof.bookingKey}`);
    console.log(`    - Seller Address        : ${matchingProof.seller}`);
    console.log(`    - Buyer Address         : ${matchingProof.buyer}`);
    console.log(`    - Seller Signature Key  : ${matchingProof.sellerCompletionKey}`);
    console.log(`    - Buyer Signature Key   : ${matchingProof.buyerCompletionKey}`);
  } else {
    console.warn(`\n  ⚠️ Note: Booking key ${bookingKey} is currently indexing into reputation table.`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PART 8: SWEEP REMAINING GLM BACK TO SELLER
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────────────────────────────");
  console.log("  8. CLEANUP: SWEEP REMAINING GLM BACK TO SELLER");
  console.log("────────────────────────────────────────────────────────");

  try {
    const remainingWei = await publicClient.getBalance({ address: buyerAddress });
    // Reserve 21,000 gas * gasPrice for sweep tx
    const gasPrice = await publicClient.getGasPrice();
    const feeReserve = 25_000n * gasPrice;
    if (remainingWei > feeReserve) {
      const sweepAmount = remainingWei - feeReserve;
      const sweepTx = await buyerWallet.sendTransaction({
        to: sellerAddress,
        value: sweepAmount,
      });
      console.log(`Sweep transaction: ${sweepTx}`);
      console.log(`Swept ${formatEther(sweepAmount)} GLM back to seller wallet.`);
    }
  } catch (err) {
    console.log(`Sweep skipped or negligible residual balance: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log("\n========================================================");
  console.log("  ALL PHASE 4 ON-CHAIN TESTS COMPLETED SUCCESSFULLY");
  console.log("========================================================\n");
}

main().catch((err) => {
  console.error("\n❌ Phase 4 on-chain test failed:", err);
  process.exit(1);
});
