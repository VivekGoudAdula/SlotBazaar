/**
 * arkiv/repro/fr003-uppercase-attribute.ts
 *
 * Controlled empirical test for FR-003:
 * Passes an uppercase attribute name ("ProjectName") to createEntity and
 * programmatically measures on-chain gas expenditure, caught error type,
 * and whether the transaction reached the chain.
 *
 * Requirements:
 * - PRIVATE_KEY in .env (with testnet GLM on Arkiv Tiramisu)
 *
 * Usage:
 * - npx tsx arkiv/repro/fr003-uppercase-attribute.ts
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
import { http, formatEther, type Hex } from "viem";

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

  console.log("=== FR-003: Uppercase Attribute Name Validation Test ===");
  const balBefore = await pub.getBalance({ address: account.address });
  console.log(`Account        : ${account.address}`);
  console.log(`Balance before : ${formatEther(balBefore)} GLM (${balBefore.toString()} wei)`);

  let caughtError: any = null;
  let txHash: string | null = null;

  try {
    const res = await wallet.createEntity({
      payload: jsonToPayload({ test: "fr003" }),
      contentType: "application/json",
      attributes: {
        ProjectName: str("invalid-uppercase"), // Uppercase attribute name
        project: str("slotbazaar-repro"),
      },
      expires: ExpirationTime.fromMinutes(10),
    });
    txHash = typeof res === "string" ? res : (res as any)?.txHash ?? "success";
  } catch (err: any) {
    caughtError = err;
  }

  const balAfter = await pub.getBalance({ address: account.address });
  const gasSpentWei = balBefore - balAfter;

  console.log(`Balance after  : ${formatEther(balAfter)} GLM (${balAfter.toString()} wei)`);
  console.log(`Gas spent      : ${gasSpentWei.toString()} wei (${formatEther(gasSpentWei)} GLM)`);

  if (caughtError) {
    const errorName = caughtError?.name ?? "UnknownError";
    const errorMessage = String(caughtError?.message ?? caughtError);
    const hasIdent32Revert = errorMessage.includes("Ident32InvalidByte");

    console.log("\n--- Observed Error Trace ---");
    console.log(`Error Name     : ${errorName}`);
    console.log(`Error Snippet  : ${errorMessage.slice(0, 200)}...`);
    console.log(`Ident32 Revert : ${hasIdent32Revert}`);

    // Programmatically compute evaluation
    const isGasFree = gasSpentWei === 0n;
    const isRejectedBeforeBroadcast = isGasFree && !txHash;

    console.log("\n--- Programmatic Evaluation ---");
    console.log("Observed Results:", {
      rejectedLocally: isRejectedBeforeBroadcast,
      gasSpentWei: gasSpentWei.toString(),
      errorName,
      ident32InvalidByteDetected: hasIdent32Revert,
    });
  } else {
    console.log("\n--- Programmatic Evaluation ---");
    console.log("Tx Succeeded unexpectedly with hash:", txHash);
  }
}

main().catch(console.error);
