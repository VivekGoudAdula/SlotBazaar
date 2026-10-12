/**
 * scripts/edge-probes.ts
 *
 * Phase 0: Edge-case probes on Arkiv entity attributes.
 * Probes: uppercase name, string > 128 bytes, negative number, batch create.
 *
 * Usage: npx tsx scripts/edge-probes.ts
 */

import "dotenv/config";
import {
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  InvalidAttributeNameError,
  InvalidValueError,
} from "@arkiv-network/sdk";
import { str, i32, bool } from "@arkiv-network/sdk/attr";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function section(label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`▶ ${label}`);
  console.log("─".repeat(60));
}

async function main() {
  console.log("=== SlotBazaar Phase 0 — edge-probes ===");

  const raw = process.env.PRIVATE_KEY;
  if (!raw?.trim()) throw new Error("PRIVATE_KEY not set in .env");
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  const account = privateKeyToAccount(hex as `0x${string}`);

  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  // Minimal reusable entity params
  const basePayload = jsonToPayload({ note: "SYNTHETIC edge probe", synthetic: true });
  const shortExpiry = ExpirationTime.fromMinutes(10);

  // ── Probe 1: Uppercase attribute name ────────────────────────────────────────
  section("Probe 1: Uppercase attribute name (should reject client-side)");
  console.log('  Attempting: attributes: { ProjectName: str("test") }');
  try {
    await wallet.createEntity({
      payload: basePayload,
      contentType: "application/json",
      attributes: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ProjectName: str("test"),   // uppercase — invalid name
        project: str("slotbazaar"),
        entity_type: str("edge_probe"),
      },
      expires: shortExpiry,
    });
    console.log("  ⚠️ No error thrown (unexpected)");
  } catch (err: unknown) {
    const e = err as Error;
    const isExpected = e instanceof InvalidAttributeNameError;
    console.log(`  ${isExpected ? "✅" : "⚠️"} Error: ${e.constructor.name}: ${e.message}`);
  }

  // ── Probe 2: String over 128 bytes ───────────────────────────────────────────
  section("Probe 2: String attribute > 128 bytes (should reject)");
  const longStr = "a".repeat(150); // 150 bytes > 128 limit
  console.log(`  String length: ${longStr.length} bytes`);
  try {
    await wallet.createEntity({
      payload: basePayload,
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("edge_probe"),
        long_val: str(longStr),
      },
      expires: shortExpiry,
    });
    console.log("  ⚠️ No error thrown (unexpected — entity created!)");
  } catch (err: unknown) {
    const e = err as Error;
    const isExpected = e instanceof InvalidValueError;
    console.log(`  ${isExpected ? "✅" : "⚠️"} Error: ${e.constructor.name}: ${e.message}`);
  }

  // ── Probe 3: Negative number as i32 ─────────────────────────────────────────
  section("Probe 3: Negative i32 attribute (should work — i32 supports negatives)");
  console.log("  Attempting: lat_e4 = i32(-211702) [south of equator coords]");
  try {
    const { entityKey, txHash } = await wallet.createEntity({
      payload: jsonToPayload({ note: "SYNTHETIC negative i32 probe" }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("edge_probe"),
        synthetic: bool(true),
        lat_e4: i32(-211702),   // negative — southern hemisphere
        lon_e4: i32(-728311),  // negative — western hemisphere
      },
      expires: shortExpiry,
    });
    console.log(`  ✅ Negative i32 accepted! Entity key: ${entityKey}`);
    console.log(`  Tx hash: ${txHash}`);
  } catch (err: unknown) {
    const e = err as Error;
    console.log(`  ❌ Unexpected error: ${e.constructor.name}: ${e.message}`);
  }

  // ── Probe 4: Batch create (executeBatch) ────────────────────────────────────
  section("Probe 4: Create TWO entities in one batch call (executeBatch)");
  console.log("  Attempting executeBatch with 2 creates...");
  try {
    const { txHash, createdEntities } = await wallet.executeBatch({
      creates: [
        {
          payload: jsonToPayload({ note: "SYNTHETIC batch entity 1" }),
          contentType: "application/json",
          attributes: {
            project: str("slotbazaar"),
            entity_type: str("edge_probe"),
            synthetic: bool(true),
            batch_seq: i32(1),
          },
          expires: shortExpiry,
        },
        {
          payload: jsonToPayload({ note: "SYNTHETIC batch entity 2" }),
          contentType: "application/json",
          attributes: {
            project: str("slotbazaar"),
            entity_type: str("edge_probe"),
            synthetic: bool(true),
            batch_seq: i32(2),
          },
          expires: shortExpiry,
        },
      ],
    });
    console.log(`  ✅ executeBatch succeeded! Tx hash: ${txHash}`);
    console.log(`  Created entities: ${createdEntities?.length ?? "unknown"}`);
    createdEntities?.forEach((key, i) => console.log(`    [${i}] ${key}`));
  } catch (err: unknown) {
    const e = err as Error;
    console.log(`  ⚠️ Error: ${e.constructor.name}: ${e.message}`);
  }

  console.log("\n=== Edge probes done ===");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
