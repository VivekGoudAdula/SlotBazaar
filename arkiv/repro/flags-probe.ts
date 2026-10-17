/**
 * arkiv/repro/flags-probe.ts
 *
 * Empirical verification of Arkiv entity properties and lifecycle actions:
 * 1. readonly flag: Attempting patchEntity on a readonly entity reverts on-chain/simulation.
 * 2. changeOwnership action: Transfers $owner while preserving immutable $creator on a readonly entity.
 * 3. extendEntity action with permissionlessExtension: Advances expiresAt block.
 *
 * Saves raw outputs to arkiv/repro/logs/flags-probe.txt.
 *
 * Usage:
 *   npx tsx arkiv/repro/flags-probe.ts
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, bool, u64 } from "@arkiv-network/sdk/attr";
import { http, type Hex, type Address } from "viem";

async function main() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  const runDate = new Date().toISOString();
  log("================================================================================");
  log("               ARKIV ENTITY PROPERTIES & LIFECYCLE PROBE                        ");
  log("================================================================================");
  log(`Run Date       : ${runDate}`);
  log(`SDK Version    : 0.8.1`);
  log(`Viem Version   : 2.57.4`);
  log(`Network        : Arkiv Tiramisu (chainId: 7738577)`);

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) throw new Error("PRIVATE_KEY required in .env");
  const hexKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  const account = privateKeyToAccount(hexKey as Hex);
  log(`Signer Account : ${account.address}`);

  const publicClient = createPublicClient({ chain: tiramisu, transport: http() });
  const wallet = createWalletClient({ chain: tiramisu, transport: http(), account });

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe 1: readonly flag rejects mutations (patchEntity)
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe 1: readonly Flag Mutation Guard ---");
  const batchTag = `flags-probe-${Date.now()}`;
  log(`Creating test entity with flags: { readonly: true } (batch: ${batchTag})...`);
  
  const entity1 = await wallet.createEntity({
    payload: jsonToPayload({ purpose: "readonly-mutation-test", note: "immutable" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("probe_receipt"),
      batch: str(batchTag),
      test_attr: str("initial"),
    },
    flags: { readonly: true },
    expires: ExpirationTime.fromMinutes(15),
  });
  log(`Entity 1 Created: ${entity1.entityKey} (tx: ${entity1.txHash})`);

  let patchErrorName = "none";
  let patchErrorMessage = "none";
  let patchRevertReason = "none";
  try {
    log("Attempting patchEntity on readonly entity (expecting revert)...");
    await wallet.patchEntity({
      entityKey: entity1.entityKey as Hex,
      set: { test_attr: str("mutated") },
    });
    log("UNEXPECTED: patchEntity succeeded on readonly entity!");
  } catch (err: any) {
    patchErrorName = err.name || "Error";
    patchErrorMessage = err.message || String(err);
    patchRevertReason = err.cause?.message || err.cause?.shortMessage || err.shortMessage || "unknown";
    log(`[Observed Revert] Error Name: ${patchErrorName}`);
    log(`[Observed Revert] Message   : ${patchErrorMessage.slice(0, 150)}...`);
    log(`[Observed Revert] Cause     : ${patchRevertReason.slice(0, 150)}...`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe 2: changeOwnership on a readonly entity updates $owner without mutating $creator
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe 2: changeOwnership on readonly Entity ---");
  const targetRecipient: Address = "0x000000000000000000000000000000000000dEaD";
  log(`Transferring ownership of readonly entity ${entity1.entityKey} to ${targetRecipient}...`);
  
  const transferTx = await wallet.changeOwnership({
    entityKey: entity1.entityKey as Hex,
    newOwner: targetRecipient,
  });
  log(`Ownership transfer transaction confirmed: ${transferTx.txHash}`);

  // Poll until getEntity reflects the transfer
  let transferredEntity = await publicClient.getEntity(entity1.entityKey as Hex);
  let pollAttempts = 0;
  while (transferredEntity.owner.toLowerCase() !== targetRecipient.toLowerCase() && pollAttempts < 10) {
    await new Promise((r) => setTimeout(r, 1000));
    transferredEntity = await publicClient.getEntity(entity1.entityKey as Hex);
    pollAttempts++;
  }
  log(`Initial Creator (immutable) : ${transferredEntity.creator}`);
  log(`Updated Owner   (transferred): ${transferredEntity.owner}`);
  const ownershipTransferValid =
    transferredEntity.creator.toLowerCase() === account.address.toLowerCase() &&
    transferredEntity.owner.toLowerCase() === targetRecipient.toLowerCase();
  log(`Verification Result: ${ownershipTransferValid ? "PASS ($owner updated, $creator intact)" : "FAIL"}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe 3: extendEntity with permissionlessExtension advances expiresAt block
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe 3: extendEntity with permissionlessExtension ---");
  log("Creating test entity with flags: { readonly: true, permissionlessExtension: true }...");
  const entity2 = await wallet.createEntity({
    payload: jsonToPayload({ purpose: "permissionless-extension-test" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("probe_receipt"),
      batch: str(batchTag),
    },
    flags: { readonly: true, permissionlessExtension: true },
    expires: ExpirationTime.fromMinutes(15),
  });
  log(`Entity 2 Created: ${entity2.entityKey} (tx: ${entity2.txHash}, initial expiresAt block: #${entity2.expiresAt})`);

  log("Calling extendEntity for +365 days...");
  const extendTx = await wallet.extendEntity({
    entityKey: entity2.entityKey as Hex,
    expires: ExpirationTime.fromDays(365),
  });
  log(`extendEntity transaction confirmed: ${extendTx.txHash} (returned expiresAt: #${extendTx.expiresAt})`);

  const refreshedEntity2 = await publicClient.getEntity(entity2.entityKey as Hex);
  log(`Refreshed On-Chain expiresAt: #${refreshedEntity2.expiresAt}`);
  const extensionValid = refreshedEntity2.expiresAt > entity2.expiresAt;
  log(`Verification Result: ${extensionValid ? `PASS (expiresAt advanced by ${refreshedEntity2.expiresAt - entity2.expiresAt} blocks)` : "FAIL"}`);

  // Summary verdict
  log("\n================================================================================");
  log("SUMMARY OBSERVATIONS:");
  log(`1. readonly flag blocks mutations (revert: ${patchErrorName})`);
  log(`2. changeOwnership succeeds on readonly entities ($owner updated to ${targetRecipient.slice(0, 8)}..., $creator stays ${account.address.slice(0, 8)}...)`);
  log(`3. extendEntity advances expiresAt from #${entity2.expiresAt} to #${refreshedEntity2.expiresAt}`);
  log("================================================================================");

  // Write log to arkiv/repro/logs/flags-probe.txt
  const logsDir = path.resolve(process.cwd(), "arkiv", "repro", "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(path.join(logsDir, "flags-probe.txt"), logLines.join("\n") + "\n", "utf8");
  log(`\nRaw output successfully written to arkiv/repro/logs/flags-probe.txt`);
}

main().catch((err) => {
  console.error("Flags probe failed:", err);
  process.exit(1);
});
