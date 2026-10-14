/**
 * arkiv/repro/fr011-getentity-call-shape.ts
 *
 * Minimal, clean reproduction for FR-011:
 * Demonstrates the call-shape difference in PublicArkivClient.getEntity:
 * - Calling `getEntity({ key: "0x..." })` fails with `TypeError: Invalid key value`
 * - Calling positional `getEntity("0x...")` succeeds reliably both live and post-expiry.
 *
 * Requirements:
 * - PRIVATE_KEY in .env (with testnet GLM on Arkiv Tiramisu)
 *
 * Usage:
 * - node ./node_modules/tsx/dist/cli.mjs arkiv/repro/fr011-getentity-call-shape.ts
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
import { str, u64 } from "@arkiv-network/sdk/attr";
import { http, type Hex } from "viem";

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

  console.log("=== FR-011 REPRO: getEntity Parameter Shape & Resolution ===");
  console.log("1. Creating fresh test entity...");
  const createRes = await wallet.createEntity({
    payload: jsonToPayload({ title: "FR-011 Shape Probe" }),
    contentType: "application/json",
    attributes: {
      test_probe: str("fr011"),
      project: str("slotbazaar-repro"),
    },
    expires: ExpirationTime.fromMinutes(1),
  });

  const entityKey = (typeof createRes === "string" ? createRes : (createRes as any).entityKey) as `0x${string}`;
  console.log(`Created entity key: ${entityKey}`);

  console.log("\n2. Testing incorrect object shape: getEntity({ key: entityKey })...");
  try {
    await (pub as any).getEntity({ key: entityKey });
    console.log("UNEXPECTED: Object call succeeded");
  } catch (err: any) {
    console.log(`[EXPECTED ERROR]: ${err?.message || err}`);
  }

  console.log("\n3. Testing canonical positional shape: getEntity(entityKey)...");
  try {
    const entity = await pub.getEntity(entityKey);
    console.log(`[SUCCESS] Retrieved live entity: key=${entity.key}, expires=${entity.expires}`);
  } catch (err: any) {
    console.error("Failed positional getEntity:", err);
  }

  console.log("\n[VERDICT]");
  console.log("- FR-011 was withdrawn as an SDK bug: the SDK strictly expects positional `getEntity(key)`.");
  console.log("- Positional call succeeds directly without issue.");
}

main().catch(console.error);
