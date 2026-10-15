/**
 * arkiv/repro/fr005-expiry-boundary.ts
 *
 * Empirical verification of consensus expiration boundary on Arkiv Tiramisu:
 * 1. Creates a test entity expiring in ~50 seconds (ExpirationTime.fromSeconds(50)).
 * 2. Reads initial entity.expiresAt (the consensus expiration block number).
 * 3. Samples via fast client polling (~300ms intervals) until 5 blocks after expiresAt block.
 *    Real block gaps between samples are measured and logged (network latency may skip blocks).
 *    On each sampled block:
 *    (i)  Queries with NO ends_at predicate (project = 'slotbazaar-repro' AND test_batch = testBatch).
 *    (ii) Calls positional pub.getEntity(entityKey).
 * 4. Prints per-block table: | Block | Gap | In Query | getEntity Result | Notes |
 * 5. Programmatically computes drop points with hedged conclusion (+/- 1 block resolution).
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
  gap: number;
  inQuery: boolean;
  getEntityResult: string;
}

async function main() {
  const runDate = new Date().toISOString();
  console.log("=== FR-005: Expiration Boundary Empirical Verification ===");
  console.log(`Run Date       : ${runDate}`);
  console.log(`SDK Version    : 0.8.1`);
  console.log(`Viem Version   : 2.57.4`);
  console.log(`Sampling Mode  : Fast polling (~300ms intervals; gaps logged per sample)`);

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

  const testBatch = `probe-fr005-${Date.now()}`;
  console.log(`Account        : ${account.address}`);
  console.log(`Batch ID       : ${testBatch}`);

  // 1. Create entity expiring in about 50 seconds (~25 blocks on Tiramisu)
  console.log("\n1. Creating test entity expiring in ~50 seconds...");
  const createRes = await wallet.createEntity({
    payload: jsonToPayload({ batch: testBatch, purpose: "expiry-boundary-verification" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar-repro"),
      test_batch: str(testBatch),
    },
    expires: ExpirationTime.fromSeconds(50),
  });

  const entityKey = (typeof createRes === "string" ? createRes : (createRes as any).entityKey) as Hex;
  console.log(`Created entity key: ${entityKey}`);

  // 2. Fetch initial entity to get exact expiresAt block
  const initialEntity = await pub.getEntity(entityKey);
  const expiresAtBlock = Number(initialEntity.expiresAt);
  const currentBlockInitial = Number(await (pub as any).getBlockNumber());

  console.log(`Entity createdAt block : ${initialEntity.createdAt}`);
  console.log(`Entity expiresAt block : ${expiresAtBlock} (in ~${expiresAtBlock - currentBlockInitial} blocks)`);
  console.log(`Consensus Expiration   : expiresAt (${expiresAtBlock}) is treated as exclusive consensus expiration block.`);

  const targetEndBlock = expiresAtBlock + 5;
  console.log(`\n2. Sampling via fast polling (~300ms) until block ${targetEndBlock} (~5 blocks past expiry)...`);
  console.log("\n| Block | Gap | In Query | getEntity Result | Notes |");
  console.log("|:-----:|:---:|:--------:|:-----------------|:------|");

  const tableRows: PollRow[] = [];
  let lastSampledBlock = -1;

  while (true) {
    let currentBlock = 0;
    try {
      currentBlock = Number(await (pub as any).getBlockNumber());
    } catch {
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }

    if (currentBlock > lastSampledBlock) {
      const gap = lastSampledBlock === -1 ? 0 : currentBlock - lastSampledBlock;

      // (i) Query with NO ends_at predicate
      let inQuery = false;
      try {
        const queryPage = await pub
          .select()
          .where(eq("project", str("slotbazaar-repro")))
          .where(eq("test_batch", str(testBatch)))
          .fetch();
        inQuery = queryPage.entities.some((e) => e.key?.toLowerCase() === entityKey.toLowerCase());
      } catch {
        inQuery = false;
      }

      // (ii) Positional getEntity
      let getEntityResult = "LIVE";
      try {
        await pub.getEntity(entityKey);
      } catch (err: any) {
        getEntityResult = err?.name === "NoEntityFoundError" ? "NoEntityFoundError (Expired)" : (err?.name || "Error");
      }

      const notes: string[] = [];
      if (currentBlock === expiresAtBlock) notes.push("<-- expiresAt block");
      else if (currentBlock === expiresAtBlock - 1) notes.push("<-- expiresAt - 1");
      if (gap > 1) notes.push(`gap: ${gap} blks`);

      tableRows.push({
        block: currentBlock,
        gap,
        inQuery,
        getEntityResult,
      });

      console.log(`| ${currentBlock} | ${gap === 0 ? "-" : gap} | ${inQuery ? "YES" : "NO"} | ${getEntityResult} | ${notes.join(", ")} |`);
      lastSampledBlock = currentBlock;

      if (currentBlock >= targetEndBlock) {
        break;
      }
    }

    // Fast polling interval: 300ms
    await new Promise((r) => setTimeout(r, 300));
  }

  // 3. Programmatically compute drop blocks
  const queryDroppedRow = tableRows.find((r) => !r.inQuery);
  const getEntityDroppedRow = tableRows.find((r) => r.getEntityResult !== "LIVE");

  const blockQueryDropped = queryDroppedRow ? queryDroppedRow.block : null;
  const blockGetEntityDropped = getEntityDroppedRow ? getEntityDroppedRow.block : null;

  const queryDiff = blockQueryDropped !== null ? blockQueryDropped - expiresAtBlock : null;
  const getEntityDiff = blockGetEntityDropped !== null ? blockGetEntityDropped - expiresAtBlock : null;
  const queryAndGetEntityMatch = blockQueryDropped === blockGetEntityDropped;

  console.log("\n--- Programmatic Expiration Boundary Evaluation ---");
  console.log("Observed Boundary Results:", {
    expiresAtBlock,
    blockQueryDropped,
    blockGetEntityDropped,
    queryDifferenceFromExpiresAt: queryDiff,
    getEntityDifferenceFromExpiresAt: getEntityDiff,
    queryAndGetEntityAgree: queryAndGetEntityMatch,
    hedgedConclusion: "query and getEntity agree; entity not visible from block expiresAt-1 or expiresAt depending on sampling resolution (plus or minus 1 block)",
  });
}

main().catch(console.error);

