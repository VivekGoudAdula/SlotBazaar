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
  const runDate = new Date().toISOString();
  console.log("=== FR-003: Uppercase Attribute Name Validation Test ===");
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
    console.log("\n--- EXACT CAUGHT ERROR PROPERTIES ---");
    console.log("error.name:");
    console.log(caughtError.name);
    console.log("\nerror.message:");
    console.log(caughtError.message);
    console.log("\nerror.cause?.message:");
    console.log(caughtError.cause?.message ?? "undefined");

    if (caughtError.cause?.cause?.message) {
      console.log("\nerror.cause.cause?.message:");
      console.log(caughtError.cause.cause.message);
    }

    console.log("\nerror.stack (first 5 lines):");
    const stackLines = (caughtError.stack || "").split("\n").slice(0, 5);
    console.log(stackLines.join("\n"));

    // Programmatically compute evaluation
    const isGasFree = gasSpentWei === 0n;
    const isRejectedBeforeBroadcast = isGasFree && !txHash;
    const mentionsCharset = caughtError.message.includes("outside the name charset");
    const charsetMentionsAtoZ = caughtError.message.includes('"A"-"Z"');
    const rejectsP = caughtError.message.includes('"P" (0x50)');
    const containsContradiction = charsetMentionsAtoZ && rejectsP;

    console.log("\n--- Programmatic Evaluation ---");
    console.log("Observed Results:", {
      rejectedLocally: isRejectedBeforeBroadcast,
      gasSpentWei: gasSpentWei.toString(),
      errorName: caughtError.name,
      mentionsCharset,
      charsetListsAtoZ: charsetMentionsAtoZ,
      rejectedPByte: rejectsP,
      messageSelfContradiction: containsContradiction,
    });
  } else {
    console.log("\n--- Programmatic Evaluation ---");
    console.log("Tx Succeeded unexpectedly with hash:", txHash);
  }
}

main().catch(console.error);

