/**
 * arkiv/repro/fr011-getentity-call-shape.ts
 *
 * Empirical verification of getEntity parameter shapes and Entity fields:
 * 1. Inspects SDK Entity field names and types.
 * 2. Creates a live entity on Arkiv Tiramisu.
 * 3. Tests canonical positional call: pub.getEntity(entityKey).
 *    Prints real fields including expiresAt block number.
 * 4. Tests object-wrapped call: pub.getEntity({ key: entityKey }).
 * 5. Programmatically computes and displays observed results without hardcoded verdict.
 *
 * Usage:
 * - npx tsx arkiv/repro/fr011-getentity-call-shape.ts
 */

import "dotenv/config";
import { privateKeyToAccount } from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
  Entity,
} from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str } from "@arkiv-network/sdk/attr";
import { http, type Hex } from "viem";

async function main() {
  const runDate = new Date().toISOString();
  console.log("=== FR-011: getEntity Parameter Shape & Entity Inspection ===");
  console.log(`Run Date       : ${runDate}`);
  console.log(`SDK Version    : 0.8.1`);
  console.log(`Viem Version   : 2.57.4`);

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

  // 1. Inspect SDK Entity fields
  console.log("\n1. Inspecting SDK Entity prototype & field definitions:");
  const dummyEntity = new Entity({
    key: "0x1234" as Hex,
    creator: account.address,
    createdAt: 100n,
    expiresAt: 200n,
  });
  console.log("SDK Entity instance keys:", Object.keys(dummyEntity));

  // 2. Create a fresh test entity
  console.log("\n2. Creating live test entity on Tiramisu...");
  const createRes = await wallet.createEntity({
    payload: jsonToPayload({ probe: "fr011-shape-test", timestamp: Date.now() }),
    contentType: "application/json",
    attributes: {
      project: str("slotbazaar-repro"),
      test_probe: str("fr011"),
    },
    expires: ExpirationTime.fromMinutes(2),
  });

  const entityKey = (typeof createRes === "string" ? createRes : (createRes as any).entityKey) as Hex;
  console.log(`Created entity key: ${entityKey}`);

  // 3. Test positional shape
  console.log("\n3. Testing positional call: pub.getEntity(entityKey)...");
  let positionalResult: any = null;
  let positionalError: any = null;
  try {
    positionalResult = await pub.getEntity(entityKey);
  } catch (err: any) {
    positionalError = err;
  }

  // 4. Test object shape
  console.log("\n4. Testing object shape: pub.getEntity({ key: entityKey })...");
  let objectResult: any = null;
  let objectError: any = null;
  try {
    objectResult = await (pub as any).getEntity({ key: entityKey });
  } catch (err: any) {
    objectError = err;
  }

  // 5. Print observed field values from live entity
  console.log("\n--- Observed Live Entity Fields ---");
  if (positionalResult) {
    console.log("key        :", positionalResult.key);
    console.log("creator    :", positionalResult.creator);
    console.log("owner      :", positionalResult.owner);
    console.log("createdAt  :", positionalResult.createdAt?.toString(), "(block number)");
    console.log("updatedAt  :", positionalResult.updatedAt?.toString(), "(block number)");
    console.log("expiresAt  :", positionalResult.expiresAt?.toString(), "(block number)");
    console.log("contentType:", positionalResult.contentType);
  } else {
    console.log("Positional fetch failed:", positionalError?.message);
  }

  if (objectError) {
    console.log("\n--- EXACT CAUGHT OBJECT SHAPE ERROR PROPERTIES ---");
    console.log("error.name:");
    console.log(objectError.name);
    console.log("\nerror.message:");
    console.log(objectError.message);
    console.log("\nerror.cause?.message:");
    console.log(objectError.cause?.message ?? "undefined");

    console.log("\nerror.stack (first 5 lines):");
    const stackLines = (objectError.stack || "").split("\n").slice(0, 5);
    console.log(stackLines.join("\n"));
  }

  // 6. Programmatic computation
  const positionalSucceeded = Boolean(positionalResult && positionalResult.key === entityKey);
  const objectFailed = Boolean(objectError);
  const expiresAtIsBlock = typeof positionalResult?.expiresAt === "bigint";

  console.log("\n--- Programmatic Evaluation ---");
  console.log("Observed Results:", {
    positionalCallSuccess: positionalSucceeded,
    objectCallFailed: objectFailed,
    objectErrorMessage: objectError?.message,
    expiresAtType: typeof positionalResult?.expiresAt,
    expiresAtBlockNumber: positionalResult?.expiresAt?.toString(),
    expiresAtIsBlockNumber: expiresAtIsBlock,
  });
}

main().catch(console.error);

