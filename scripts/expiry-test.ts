/**
 * scripts/expiry-test.ts
 *
 * Phase 0: Create a short-lived entity, then poll until it disappears.
 * Records exact timing of expiry from both getEntity and a select query.
 *
 * Usage: npx tsx scripts/expiry-test.ts
 */

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  NoEntityFoundError,
} from "@arkiv-network/sdk";
import { str, bool } from "@arkiv-network/sdk/attr";
import { eq, and } from "@arkiv-network/sdk/query";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** Sleep for ms milliseconds */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Print timestamp as IST string */
function nowIST() {
  return new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

async function main() {
  console.log("=== SlotBazaar Phase 0 — expiry-test ===");

  // ── Setup clients ──────────────────────────────────────────────────────────
  const raw = process.env.PRIVATE_KEY;
  if (!raw?.trim()) throw new Error("PRIVATE_KEY not set in .env");
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hex as `0x${string}`);

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const publicClient = createPublicClient({
    chain: tiramisu,
    transport: http(),
  });

  // ── Create a short-lived entity (10 minutes) ───────────────────────────────
  console.log("Creating short-lived entity (10 minutes)...");
  const createStart = Date.now();

  const { entityKey, txHash, expiresAt } = await wallet.createEntity({
    payload: jsonToPayload({
      note: "SYNTHETIC expiry-test entity — will disappear in ~10 minutes",
      schema_version: 1,
    }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("expiry_test"),
      synthetic: bool(true),
    },
    expires: ExpirationTime.fromMinutes(10),
  });

  const createEnd = Date.now();
  console.log(`✅ Entity created!`);
  console.log(`  Entity key : ${entityKey}`);
  console.log(`  Tx hash    : ${txHash}`);
  console.log(`  Expires at : block ${expiresAt}`);
  console.log(`  Created at : ${nowIST()} (${createEnd - createStart}ms)`);

  // ── Immediately verify it exists ───────────────────────────────────────────
  console.log("\n--- Verifying entity exists immediately after creation ---");
  try {
    const entity = await publicClient.getEntity(entityKey);
    console.log(`✅ getEntity succeeded: expiresAt=${entity.expiresAt}`);
  } catch (err) {
    console.error("❌ getEntity failed immediately after creation:", err);
  }

  // ── Poll until expiry ──────────────────────────────────────────────────────
  // We poll every 30 seconds; note current block to track time
  const { currentBlock: startBlock, blockDuration } = await publicClient.getBlockTiming();
  console.log(`\nCurrent block: ${startBlock}, blockDuration: ${blockDuration}s`);
  console.log(`Estimated expiry block: ${expiresAt}`);
  console.log(`Estimated blocks to wait: ${expiresAt - startBlock}`);
  console.log(`Estimated time to wait: ~${Number(expiresAt - startBlock) * blockDuration}s`);
  console.log("\nPolling every 30s until entity disappears...\n");

  let pollCount = 0;
  let getEntityExpiredAt: string | null = null;
  let queryExpiredAt: string | null = null;

  // Poll for up to 15 minutes (safety limit)
  const maxPolls = 30;

  while (pollCount < maxPolls) {
    await sleep(30_000);
    pollCount++;

    const pollTime = nowIST();
    const { currentBlock } = await publicClient.getBlockTiming();
    console.log(`[poll ${pollCount}] ${pollTime} — block ${currentBlock}`);

    // ── Check getEntity ──────────────────────────────────────────────────────
    if (!getEntityExpiredAt) {
      try {
        const entity = await publicClient.getEntity(entityKey);
        console.log(`  getEntity: still alive (expiresAt=${entity.expiresAt})`);
      } catch (err: unknown) {
        if (err instanceof NoEntityFoundError) {
          getEntityExpiredAt = pollTime;
          console.log(`  ✅ getEntity threw NoEntityFoundError at: ${pollTime}`);
          console.log(`     Error message: "${err.message}"`);
          console.log(`     entityKey in error: ${err.entityKey}`);
        } else {
          console.log(`  ❌ getEntity threw unexpected error:`, err);
        }
      }
    }

    // ── Check select query ───────────────────────────────────────────────────
    if (!queryExpiredAt) {
      try {
        const result = await publicClient
          .select({ key: true })
          .where(and(
            eq("project", str("slotbazaar")),
            eq("entity_type", str("expiry_test"))
          ))
          .fetch();

        const found = result.entities.some((e) => e.key === entityKey);
        if (found) {
          console.log(`  query: entity still in results (${result.entities.length} total)`);
        } else {
          queryExpiredAt = pollTime;
          console.log(`  ✅ query: entity no longer in results at: ${pollTime}`);
          console.log(`     Total results returned: ${result.entities.length}`);
        }
      } catch (err) {
        console.log(`  ❌ query threw error:`, err);
      }
    }

    // ── If both checks agree entity is gone, stop ────────────────────────────
    if (getEntityExpiredAt && queryExpiredAt) {
      console.log("\n=== EXPIRY CONFIRMED ===");
      console.log(`  getEntity expired at : ${getEntityExpiredAt}`);
      console.log(`  query expired at     : ${queryExpiredAt}`);
      console.log(`  Tx hash              : ${txHash}`);
      console.log(`  Target block         : ${expiresAt}`);
      console.log(`  Final block          : ${currentBlock}`);
      break;
    }
  }

  if (!getEntityExpiredAt || !queryExpiredAt) {
    console.log(`\n⚠️ Poll limit (${maxPolls}) reached — entity may not have expired yet.`);
    console.log(`  getEntity expired: ${getEntityExpiredAt ?? "NOT YET"}`);
    console.log(`  query expired:     ${queryExpiredAt ?? "NOT YET"}`);
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
