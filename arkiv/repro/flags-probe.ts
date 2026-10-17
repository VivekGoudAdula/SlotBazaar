/**
 * arkiv/repro/flags-probe.ts
 *
 * Empirical verification of Arkiv entity properties and lifecycle actions:
 * (a) readonly create
 * (b) owner edit of readonly reverts
 * (c) owner deletes readonly
 * (d) ownership transfer of readonly
 * (e) extend readonly as owner
 * (f) non-owner extend WITHOUT permissionlessExtension (exact error)
 * (g) non-owner extend WITH permissionlessExtension from a different wallet (ephemeral wallet, keys never printed)
 * (h) batch create with per-entity flags
 * (i) extending to an earlier deadline (exact error)
 *
 * Appends raw outputs to arkiv/repro/logs/flags-probe.txt.
 *
 * Usage:
 *   npx tsx arkiv/repro/flags-probe.ts
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str } from "@arkiv-network/sdk/attr";
import { http, parseEther, type Hex, type Address } from "viem";

async function main() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  const runDate = new Date().toISOString();
  log("\n================================================================================");
  log("          ARKIV ENTITY PROPERTIES & LIFECYCLE PROBE — COMPLETE SUITE            ");
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
  const batchTag = `flags-probe-${Date.now()}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (a) & (b): readonly create & owner edit reverts
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (a) & (b): readonly create and owner edit of readonly reverts ---");
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
  log(`(a) Entity Created with readonly: ${entity1.entityKey} (tx: ${entity1.txHash})`);

  log("Attempting patchEntity on readonly entity as owner (expecting revert)...");
  try {
    await wallet.patchEntity({
      entityKey: entity1.entityKey as Hex,
      set: { test_attr: str("mutated") },
    });
    log("UNEXPECTED: patchEntity succeeded on readonly entity!");
  } catch (err: any) {
    log(`(b) [Observed Revert] Error Name: ${err.name || "Error"}`);
    log(`(b) [Observed Revert] Message   : ${err.message || String(err)}`);
    log(`(b) [Observed Revert] Cause     : ${err.cause?.message || err.cause?.shortMessage || err.shortMessage || "unknown"}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (c): owner deletes readonly entity
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (c): owner deletes readonly entity ---");
  const entityToDel = await wallet.createEntity({
    payload: jsonToPayload({ purpose: "readonly-delete-test" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("probe_receipt"),
      batch: str(batchTag),
    },
    flags: { readonly: true },
    expires: ExpirationTime.fromMinutes(15),
  });
  log(`Created readonly entity for deletion: ${entityToDel.entityKey} (tx: ${entityToDel.txHash})`);

  log("Owner calling deleteEntity on readonly entity...");
  const delTx = await wallet.deleteEntity({ entityKey: entityToDel.entityKey as Hex });
  log(`(c) deleteEntity transaction confirmed: ${delTx.txHash}`);
  try {
    const fetched = await publicClient.getEntity(entityToDel.entityKey as Hex);
    log(`(c) Entity state after delete: owner=${fetched.owner}`);
  } catch (err: any) {
    log(`(c) Verified deleted on-chain: ${err.name || "Error"} - ${err.message?.slice(0, 80) || "not found"}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (d): ownership transfer of readonly entity
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (d): ownership transfer of readonly entity ---");
  const targetRecipient: Address = "0x000000000000000000000000000000000000dEaD";
  log(`Transferring ownership of readonly entity ${entity1.entityKey} to ${targetRecipient}...`);
  const transferTx = await wallet.changeOwnership({
    entityKey: entity1.entityKey as Hex,
    newOwner: targetRecipient,
  });
  log(`(d) Ownership transfer transaction confirmed: ${transferTx.txHash}`);
  let transferredEntity = await publicClient.getEntity(entity1.entityKey as Hex);
  let pollAttempts = 0;
  while (transferredEntity.owner.toLowerCase() !== targetRecipient.toLowerCase() && pollAttempts < 10) {
    await new Promise((r) => setTimeout(r, 1000));
    transferredEntity = await publicClient.getEntity(entity1.entityKey as Hex);
    pollAttempts++;
  }
  log(`(d) Initial Creator (immutable) : ${transferredEntity.creator}`);
  log(`(d) Updated Owner   (transferred): ${transferredEntity.owner}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (e): extend readonly as owner
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (e): extend readonly as owner ---");
  const entityExtendOwner = await wallet.createEntity({
    payload: jsonToPayload({ purpose: "readonly-extend-owner-test" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("probe_receipt"),
      batch: str(batchTag),
    },
    flags: { readonly: true }, // no permissionlessExtension
    expires: ExpirationTime.fromMinutes(15),
  });
  log(`Entity created with readonly flag: ${entityExtendOwner.entityKey} (initial expiresAt: #${entityExtendOwner.expiresAt})`);
  log("Owner calling extendEntity for +30 days...");
  const extOwnerTx = await wallet.extendEntity({
    entityKey: entityExtendOwner.entityKey as Hex,
    expires: ExpirationTime.fromDays(30),
  });
  log(`(e) extendEntity by owner confirmed: ${extOwnerTx.txHash} (new expiresAt: #${extOwnerTx.expiresAt})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (f) & (g): non-owner extend (without & with permissionlessExtension)
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (f) & (g): non-owner extend via ephemeral wallet ---");
  const ephemeralKey = generatePrivateKey();
  const ephemeralAccount = privateKeyToAccount(ephemeralKey);
  log(`Created ephemeral non-owner wallet: ${ephemeralAccount.address} (private key redacted)`);

  log("Funding ephemeral wallet with 0.002 GLM for gas...");
  const fundTx = await wallet.sendTransaction({
    to: ephemeralAccount.address,
    value: parseEther("0.002"),
  });
  await publicClient.waitForTransactionReceipt({ hash: fundTx });
  log(`Funding transaction confirmed: ${fundTx}`);

  const ephemeralWallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account: ephemeralAccount,
  });

  // Probe (f): Non-owner extend WITHOUT permissionlessExtension
  log("\nProbe (f): Ephemeral non-owner attempts extendEntity WITHOUT permissionlessExtension (expecting revert)...");
  try {
    await ephemeralWallet.extendEntity({
      entityKey: entityExtendOwner.entityKey as Hex,
      expires: ExpirationTime.fromDays(60),
    });
    log("UNEXPECTED: Non-owner extendEntity succeeded without permissionlessExtension!");
  } catch (err: any) {
    log(`(f) [Observed Revert] Error Name: ${err.name || "Error"}`);
    log(`(f) [Observed Revert] Message   : ${err.message || String(err)}`);
    log(`(f) [Observed Revert] Cause     : ${err.cause?.message || err.cause?.shortMessage || err.shortMessage || "unknown"}`);
  }

  // Probe (g): Non-owner extend WITH permissionlessExtension
  log("\nProbe (g): Creating entity WITH permissionlessExtension from main wallet...");
  const entityWithPerm = await wallet.createEntity({
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
  log(`Entity created with permissionlessExtension: ${entityWithPerm.entityKey} (initial expiresAt: #${entityWithPerm.expiresAt})`);

  log("Ephemeral non-owner wallet calling extendEntity for +30 days...");
  const extNonOwnerTx = await ephemeralWallet.extendEntity({
    entityKey: entityWithPerm.entityKey as Hex,
    expires: ExpirationTime.fromDays(30),
  });
  log(`(g) extendEntity by non-owner confirmed: ${extNonOwnerTx.txHash} (new expiresAt: #${extNonOwnerTx.expiresAt})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (h): batch create with per-entity flags
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (h): batch create with per-entity flags ---");
  const batchCreates = [
    {
      payload: jsonToPayload({ purpose: "batch-entity-readonly-only" }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("probe_receipt"),
        batch: str(batchTag),
        label: str("item-readonly"),
      },
      flags: { readonly: true },
      expires: ExpirationTime.fromMinutes(20),
    },
    {
      payload: jsonToPayload({ purpose: "batch-entity-perm-ext" }),
      contentType: "application/json",
      attributes: {
        project: str("slotbazaar"),
        entity_type: str("probe_receipt"),
        batch: str(batchTag),
        label: str("item-perm-ext"),
      },
      flags: { readonly: true, permissionlessExtension: true },
      expires: ExpirationTime.fromMinutes(20),
    },
  ];

  const batchRes = await wallet.executeBatch({ creates: batchCreates });
  log(`(h) Batch create transaction confirmed: ${batchRes.txHash} (${batchRes.createdEntities.length} entities created)`);

  const be1 = await publicClient.getEntity(batchRes.createdEntities[0] as Hex);
  const be2 = await publicClient.getEntity(batchRes.createdEntities[1] as Hex);
  log(`(h) Batch Entity 1 (${be1.key}): readonly=${be1.creationFlags?.readonly}, permissionlessExtension=${be1.creationFlags?.permissionlessExtension}`);
  log(`(h) Batch Entity 2 (${be2.key}): readonly=${be2.creationFlags?.readonly}, permissionlessExtension=${be2.creationFlags?.permissionlessExtension}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // Probe (i): extending to an earlier deadline
  // ─────────────────────────────────────────────────────────────────────────────
  log("\n--- Probe (i): extending to an earlier deadline (expecting revert) ---");
  const entityForShorten = await wallet.createEntity({
    payload: jsonToPayload({ purpose: "earlier-deadline-test" }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar"),
      entity_type: str("probe_receipt"),
      batch: str(batchTag),
    },
    expires: ExpirationTime.fromDays(7),
  });
  log(`Entity created with 7-day expiry: ${entityForShorten.entityKey} (expiresAt block #${entityForShorten.expiresAt})`);

  log("Attempting to extend to an earlier deadline (1 minute into future)...");
  try {
    await wallet.extendEntity({
      entityKey: entityForShorten.entityKey as Hex,
      expires: ExpirationTime.fromMinutes(1),
    });
    log("UNEXPECTED: extendEntity to earlier deadline succeeded!");
  } catch (err: any) {
    log(`(i) [Observed Revert] Error Name: ${err.name || "Error"}`);
    log(`(i) [Observed Revert] Message   : ${err.message || String(err)}`);
    log(`(i) [Observed Revert] Cause     : ${err.cause?.message || err.cause?.shortMessage || err.shortMessage || "unknown"}`);
  }

  log("\n================================================================================");
  log("COMPLETE PROBE SUITE COMPLETED SUCCESSFULLY");
  log("================================================================================");

  // Append raw output to arkiv/repro/logs/flags-probe.txt
  const logPath = path.resolve(process.cwd(), "arkiv/repro/logs/flags-probe.txt");
  fs.appendFileSync(logPath, "\n" + logLines.join("\n") + "\n");
  console.log(`\nAppended raw output to ${logPath}`);
}

main().catch((e) => {
  console.error("Probe script error:", e);
  process.exit(1);
});
