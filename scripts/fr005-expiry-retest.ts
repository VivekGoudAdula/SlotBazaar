/**
 * scripts/fr005-expiry-retest.ts
 *
 * FR-005 retest: polls getEntity AND select().where() every 1 second for the
 * 20 blocks before and 5 blocks after the entity's target expiry block.
 *
 * Steps:
 *   1. Create a slot entity expiring in ~2 minutes (short enough to wait).
 *   2. Poll every 1 second; at each second record:
 *      - current block
 *      - select().where() visible? (yes/no)
 *      - getEntity result (ok/NoEntityFoundError/other-error)
 *   3. Stop after the entity disappears from both sources + 5 more blocks.
 *   4. Print a table and conclusion.
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/fr005-expiry-retest.ts
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
import { eq, gt, and } from "@arkiv-network/sdk/query";
import { http } from "viem";
import type { Hex } from "viem";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const EXPIRY_OFFSET_SEC = 120; // entity lives 2 minutes
const POLL_INTERVAL_MS  = 1000;
const PRE_EXPIRY_SEC    = 40;  // start polling 40s before expiry
const POST_EXPIRY_BLOCKS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface Row {
  wallTime: string;
  blockNumber: bigint | null;
  queryVisible: boolean | null;
  getEntityResult: "ok" | "not-found" | "error" | "skipped";
  note: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error("PRIVATE_KEY required"); process.exit(1);
  }

  const account = privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex);

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  const pub = createPublicClient({
    chain: tiramisu,
    transport: http(),
  });

  const nowSec   = Math.floor(Date.now() / 1000);
  const endsAt   = nowSec + EXPIRY_OFFSET_SEC;

  console.log(`\nFR-005 Expiry Retest`);
  console.log(`Creating entity expiring at ${new Date(endsAt * 1000).toISOString()} (${EXPIRY_OFFSET_SEC}s from now)…`);

  // Step 1: Create the test entity
  const created = await wallet.createEntity({
    payload: jsonToPayload({ note: "fr005-retest" }),
    contentType: "application/json",
    attributes: {
      project:     str("slotbazaar"),
      entity_type: str("slot"),
      schema_v:    str("1"),
      category:    str("machine"),
      cluster:     str("test"),
      starts_at:   u64(BigInt(nowSec)),
      ends_at:     u64(BigInt(endsAt)),
      price_band:  str("low"),
      lat_e4:      i32(190760),
      lon_e4:      i32(728777),
      synthetic:   bool(true),
      seed_batch:  str("fr005-retest"),
    },
    expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
  });

  const entityKey = created.entityKey as Hex;
  const expiresAt = created.expiresAt; // block number

  console.log(`Created entity key : ${entityKey}`);
  console.log(`Entity expiresAt   : block #${expiresAt}`);
  console.log(`Waiting until ~${PRE_EXPIRY_SEC}s before expiry to start polling…\n`);

  // Wait until PRE_EXPIRY_SEC before expiry
  const waitMs = Math.max(0, (endsAt - PRE_EXPIRY_SEC - Math.floor(Date.now() / 1000)) * 1000);
  await sleep(waitMs);

  // Step 2: Poll
  const rows: Row[] = [];
  let consecutiveGone = 0;

  console.log("Starting 1-second poll...\n");

  while (true) {
    const now = new Date();
    const row: Row = {
      wallTime: now.toISOString().slice(11, 19),
      blockNumber: null,
      queryVisible: null,
      getEntityResult: "skipped",
      note: "",
    };

    // Get block number
    try {
      const bn = await (pub as unknown as { getBlockNumber: () => Promise<bigint> }).getBlockNumber();
      row.blockNumber = bn;
    } catch {
      row.note = "block-rpc-err";
    }

    // Query index
    try {
      const nowQuery = BigInt(Math.floor(Date.now() / 1000));
      const page = await pub.select()
        .where(and(
          eq("project", str("slotbazaar")),
          eq("entity_type", str("slot")),
          eq("cluster", str("test")),
          gt("ends_at", u64(nowQuery - 3600n)) // wide window
        ))
        .fetch();
      const found = page.entities.some((e) => e.key === entityKey);
      row.queryVisible = found;
    } catch (err) {
      row.note += " query-err";
      row.queryVisible = null;
    }

    // getEntity
    try {
      await pub.getEntity({ key: entityKey });
      row.getEntityResult = "ok";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      row.getEntityResult = msg.toLowerCase().includes("no live entity") ? "not-found" : "error";
      if (row.getEntityResult === "error") row.note += ` getEntity:${msg.slice(0, 40)}`;
    }

    rows.push(row);

    // Print row immediately
    const blk = row.blockNumber !== null ? `#${row.blockNumber}` : "?";
    const qv  = row.queryVisible === null ? "?" : row.queryVisible ? "YES" : "NO ";
    const ge  = row.getEntityResult;
    console.log(`  ${row.wallTime}  block=${blk.padEnd(10)} query=${qv}  getEntity=${ge.padEnd(10)} ${row.note}`);

    // Stop condition: entity gone from both + POST_EXPIRY_BLOCKS more blocks
    if (row.queryVisible === false && row.getEntityResult === "not-found") {
      consecutiveGone++;
    } else {
      consecutiveGone = 0;
    }
    if (consecutiveGone >= POST_EXPIRY_BLOCKS) break;

    await sleep(POLL_INTERVAL_MS);
  }

  // Step 3: Analyse
  console.log("\n\n── Table ──────────────────────────────────────────────────────────────────");
  console.log("Time      Block         query=  getEntity=  Notes");
  console.log("─────────────────────────────────────────────────────────────────────────");
  for (const r of rows) {
    const blk = r.blockNumber !== null ? `#${r.blockNumber}` : "?       ";
    const qv  = r.queryVisible === null ? "?" : r.queryVisible ? "YES" : "NO ";
    console.log(`${r.wallTime}  ${blk.toString().padEnd(12)}  ${qv}     ${r.getEntityResult.padEnd(10)}  ${r.note}`);
  }

  // Find the first row where query goes false vs getEntity goes not-found
  const firstQueryGone   = rows.find((r) => r.queryVisible === false);
  const firstGetEntityGone = rows.find((r) => r.getEntityResult === "not-found");

  console.log("\n── Conclusions ────────────────────────────────────────────────────────────");
  if (firstQueryGone && firstGetEntityGone) {
    const qBlock = firstQueryGone.blockNumber;
    const gBlock = firstGetEntityGone.blockNumber;
    const diff   = qBlock !== null && gBlock !== null ? Number(gBlock - qBlock) : "?";

    console.log(`  Entity expiresAt block   : #${expiresAt}`);
    console.log(`  First block query=NO     : #${qBlock} (wall ${firstQueryGone.wallTime})`);
    console.log(`  First block getEntity=NF : #${gBlock} (wall ${firstGetEntityGone.wallTime})`);
    console.log(`  Block gap (query vs getEntity): ${diff} block(s)`);

    if (typeof diff === "number" && diff > 0) {
      console.log(`\n  VERDICT: Query index drops entity ${diff} block(s) BEFORE getEntity confirms it gone.`);
      console.log(`  FR-005 claim ("query drops one block early") is CONFIRMED.`);
    } else if (diff === 0) {
      console.log(`\n  VERDICT: Query and getEntity go dark at the SAME block.`);
      console.log(`  FR-005 claim of 1-block gap is NOT confirmed by this run — update the entry.`);
    } else {
      console.log(`\n  VERDICT: getEntity went dark BEFORE query — unexpected. Update FR-005.`);
    }
  } else {
    console.log("  Could not determine conclusive block — extend PRE_EXPIRY_SEC and retry.");
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
