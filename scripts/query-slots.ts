/**
 * scripts/query-slots.ts
 *
 * Phase 0: Run a battery of queries against Arkiv to characterise query behaviour.
 * Probes: (a) project+entity_type filter, (b) createdBy, (c) range filter on ends_at,
 * (d) wrong number type, (e) no filter (expected error).
 *
 * Usage: npx tsx scripts/query-slots.ts
 */

import "dotenv/config";
import {
  createPublicClient,
  type QueryResult,
  type FullEntity,
} from "@arkiv-network/sdk";
// InvalidPredicateError is only exported from the /query subpath
import { str, u64, i32 } from "@arkiv-network/sdk/attr";
import { eq, gt, and, InvalidPredicateError } from "@arkiv-network/sdk/query";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** Print a divider with a label */
function section(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log("─".repeat(60));
}

/** Print compact entity summary */
function summariseEntity(e: FullEntity, i: number) {
  const attrs = e.attributes ?? {};
  const attrKeys = Object.keys(attrs).join(", ");
  console.log(
    `  [${i}] key=${e.key?.slice(0, 16)}… owner=${e.owner?.slice(0, 10)}… attrs=[${attrKeys}]`
  );
}

/** Print pagination info from a QueryResult */
function printPageInfo(result: QueryResult<FullEntity>) {
  console.log(`  → ${result.entities.length} entities on this page`);
  console.log(`  → hasNextPage: ${result.hasNextPage()}`);
  console.log(`  → cursor: ${result.cursor ?? "(none)"}`);
  console.log(`  → blockNumber: ${result.blockNumber}`);
}

async function main() {
  console.log("=== SlotBazaar Phase 0 — query-slots ===");

  // ── Get wallet address for createdBy filter ────────────────────────────────
  const raw = process.env.PRIVATE_KEY;
  if (!raw?.trim()) throw new Error("PRIVATE_KEY not set in .env");
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hex as `0x${string}`);
  console.log(`Querying as creator: ${account.address}`);

  // ── Public client (read-only) ──────────────────────────────────────────────
  const client = createPublicClient({
    chain: tiramisu,
    transport: http(),
  });

  // ── (a) project + entity_type filter ──────────────────────────────────────
  section("(a) project=slotbazaar AND entity_type=slot");
  try {
    const result = await client
      .select()
      .where(
        and(
          eq("project", str("slotbazaar")),
          eq("entity_type", str("slot"))
        )
      )
      .fetch();

    printPageInfo(result);
    result.entities.forEach(summariseEntity);
    // Report ordering — is it by creation time, key, or undefined?
    if (result.entities.length > 1) {
      const keys = result.entities.map((e) => e.key);
      console.log("  → First key:", keys[0]);
      console.log("  → Last  key:", keys[keys.length - 1]);
      console.log("  → Ordering: OBSERVE manually (no server-side sort guaranteed)");
    }
  } catch (err) {
    console.error("  ❌ Error:", err);
  }

  // ── (b) createdBy(wallet address) ─────────────────────────────────────────
  section("(b) createdBy — filter to my wallet");
  try {
    const result = await client
      .select()
      .createdBy(account.address)
      .fetch();

    printPageInfo(result);
    result.entities.forEach(summariseEntity);
  } catch (err) {
    console.error("  ❌ Error:", err);
  }

  // ── (c) Range filter on ends_at > now (CORRECT type: u64) ─────────────────
  section("(c) ends_at > now — CORRECT type (u64 bigint)");
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  console.log(`  Using nowSec=${nowSec} (u64 bigint)`);
  try {
    const result = await client
      .select()
      .where(
        and(
          eq("project", str("slotbazaar")),
          gt("ends_at", u64(nowSec))
        )
      )
      .fetch();

    printPageInfo(result);
    result.entities.forEach(summariseEntity);
  } catch (err) {
    console.error("  ❌ Error:", err);
  }

  // ── (d) Range filter on ends_at with WRONG type (i32 instead of u64) ──────
  section("(d) ends_at > now — WRONG type (i32 instead of u64) — expect error");
  console.log("  Intentionally using i32 for a u64 attribute...");
  try {
    // ends_at was written as u64; querying with i32 should fail
    const result = await client
      .select()
      .where(
        and(
          eq("project", str("slotbazaar")),
          // Deliberately wrong: i32 applied to a field stored as u64
          gt("ends_at", i32(Number(nowSec % BigInt(2 ** 31 - 1))))
        )
      )
      .fetch();

    // If it succeeds (no error), report what we got
    console.log("  ⚠️ No error thrown — succeeds with potentially wrong results");
    printPageInfo(result);
    result.entities.forEach(summariseEntity);
  } catch (err: unknown) {
    const e = err as Error;
    console.log(`  ✅ Error thrown (expected): ${e.constructor.name}: ${e.message}`);
  }

  // ── (e) No filter — expect InvalidPredicateError ───────────────────────────
  section("(e) No filter — expect error (InvalidPredicateError)");
  try {
    // toString() throws synchronously; fetch() may also throw
    const builder = client.select();
    console.log("  Calling toString() with no filter...");
    try {
      const qs = builder.toString();
      console.log("  ⚠️ toString() succeeded (unexpected):", qs);
    } catch (toStringErr: unknown) {
      const e = toStringErr as Error;
      console.log(`  ✅ toString() threw: ${e.constructor.name}: ${e.message}`);
    }

    console.log("  Calling fetch() with no filter...");
    const result = await builder.fetch();
    console.log("  ⚠️ fetch() succeeded (unexpected):", result.entities.length, "entities");
  } catch (err: unknown) {
    const e = err as Error;
    const isExpected = e instanceof InvalidPredicateError;
    console.log(
      `  ${isExpected ? "✅" : "⚠️"} fetch() threw: ${e.constructor.name}: ${e.message}`
    );
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
