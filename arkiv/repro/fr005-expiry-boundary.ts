/**
 * arkiv/repro/fr005-expiry-boundary.ts
 *
 * Empirical verification of consensus expiration boundary on Arkiv Tiramisu:
 * 1. Creates a test entity expiring in ~60 seconds (ExpirationTime.fromSeconds(60)).
 * 2. Reads initial entity.expiresAt (the consensus expiration block number).
 * 3. Polls every 1 to 2 seconds until 5 blocks after expiresAt block.
 *    On each block:
 *    (i)  Queries with NO ends_at predicate (project = 'slotbazaar-repro' AND test_batch = testBatch).
 *    (ii) Calls positional pub.getEntity(entityKey).
 * 4. Prints per-block table: | Block | In Query | getEntity Result |
 * 5. Programmatically computes:
 *    - Block where query dropped
 *    - Block where getEntity dropped
 *    - expiresAt block
 *    - Difference
 *
 * Usage:
 * - npx tsx arkiv/repro/fr005-expiry-boundary.ts
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
import { str } from "@arkiv-network/sdk/attr";
import { eq } from "@arkiv-network/sdk/query";
import { http, type Hex } from "viem";

interface PollRow {
  block: number;
  inQuery: boolean;
  getEntityResult: string;
}

async function main() {
  const raw = process.env.PRIVATE_KEY;
  if (!raw) throw new Error("PRIVATE_KEY required in .env");
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hex as Hex);

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const pub = createPublicClient({
    chain: tiramisu,
    transport: http(),
  });

  console.log("=== FR-005: Expiration Boundary Empirical Verification ===");
  const testBatch = `probe-fr005-${Date.now()}`;
  console.log(`Account     : ${account.address}`);
  console.log(`Batch ID    : ${testBatch}`);

  // Create entity expiring in ~60 seconds
  console.log("\n1. Creating test entity expiring in ~60 seconds...");
  const createRes = await wallet.createEntity({
    payload: jsonToPayload({ batch: testBatch, purpose: "expiry-boundary-verification" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar-repro"),
      test_batch: str(testBatch),
    },
    expires: ExpirationTime.fromSeconds(60),
  });

  const entityKey = (typeof createRes === "string" ? createRes : (createRes as any).entityKey) as Hex;
  console.log(`Created entity key: ${entityKey}`);

  // Fetch initial entity to get exact expiresAt block
  const initialEntity = await pub.getEntity(entityKey);
  const expiresAtBlock = Number(initialEntity.expiresAt);
  const currentBlockInitial = Number(await (pub as any).getBlockNumber());

  console.log(`Entity createdAt block : ${initialEntity.createdAt}`);
  console.log(`Entity expiresAt block : ${expiresAtBlock} (in ~${expiresAtBlock - currentBlockInitial} blocks)`);

  const targetEndBlock = expiresAtBlock + 5;
  console.log(`\n2. Polling every 1.5s until block ${targetEndBlock} (5 blocks after expiry)...`);
  console.log("\n| Block | In Query | getEntity Result |");
  console.log("|:-----:|:--------:|:-----------------|");

  const tableRows: PollRow[] = [];
  let lastLoggedBlock = -1;

  while (true) {
    const currentBlock = Number(await (pub as any).getBlockNumber());

    // Only record once per block
    if (currentBlock !== lastLoggedBlock) {
      // (i) Query with NO ends_at predicate
      let inQuery = false;
      try {
        const queryPage = await pub
          .select()
          .where(eq("project", str("slotbazaar-repro")))
          .where(eq("test_batch", str(testBatch)))
          .fetch();
        inQuery = queryPage.entities.some((e) => e.key?.toLowerCase() === entityKey.toLowerCase());
      } catch (err: any) {
        inQuery = false;
      }

      // (ii) Positional getEntity
      let getEntityResult = "LIVE";
      try {
        await pub.getEntity(entityKey);
      } catch (err: any) {
        getEntityResult = err?.name === "NoEntityFoundError" ? "NoEntityFoundError (Expired)" : (err?.name || "Error");
      }

      tableRows.push({
        block: currentBlock,
        inQuery,
        getEntityResult,
      });

      console.log(`| ${currentBlock} | ${inQuery ? "YES" : "NO"} | ${getEntityResult} |`);
      lastLoggedBlock = currentBlock;

      if (currentBlock >= targetEndBlock) {
        break;
      }
    }

    // Sleep 1500 ms
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 3. Programmatically compute drop blocks
  const queryDroppedRow = tableRows.find((r) => !r.inQuery);
  const getEntityDroppedRow = tableRows.find((r) => r.getEntityResult !== "LIVE");

  const blockQueryDropped = queryDroppedRow ? queryDroppedRow.block : null;
  const blockGetEntityDropped = getEntityDroppedRow ? getEntityDroppedRow.block : null;

  const queryDiff = blockQueryDropped !== null ? blockQueryDropped - expiresAtBlock : null;
  const getEntityDiff = blockGetEntityDropped !== null ? blockGetEntityDropped - expiresAtBlock : null;

  console.log("\n--- Programmatic Expiration Boundary Evaluation ---");
  console.log({
    expiresAtBlock,
    blockQueryDropped,
    blockGetEntityDropped,
    queryDifferenceFromExpiresAt: queryDiff,
    getEntityDifferenceFromExpiresAt: getEntityDiff,
  });
}

main().catch(console.error);
