/**
 * scripts/retest-fr003.ts
 *
 * FR-003 investigation:
 * Probe uppercase attribute name, logging:
 * - Error class name and message
 * - Error cause and full stack trace
 * - Whether eth_estimateGas or eth_sendRawTransaction was the origin
 * - Gas spent (if any)
 *
 * Usage: npx tsx scripts/retest-fr003.ts
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
  if (!raw) throw new Error("PRIVATE_KEY required");
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

  console.log("=== FR-003 RETEST: Uppercase Attribute Name Error Origin ===");
  const balBefore = await pub.getBalance({ address: account.address });
  console.log(`Balance before: ${formatEther(balBefore)} GLM`);

  try {
    await wallet.createEntity({
      payload: jsonToPayload({ test: "fr003" }),
      contentType: "application/json",
      attributes: {
        ProjectName: str("invalid-uppercase"), // uppercase
        project: str("slotbazaar"),
      },
      expires: ExpirationTime.fromMinutes(10),
    });
    console.log("❌ Unexpected success (no error thrown)");
  } catch (err: any) {
    const balAfter = await pub.getBalance({ address: account.address });
    const gasSpent = balBefore - balAfter;

    console.log("\n--- ERROR INSPECTION ---");
    console.log(`Error Name       : ${err.constructor.name}`);
    console.log(`Error Message    : ${err.message}`);
    console.log(`Gas Spent        : ${gasSpent.toString()} wei (${formatEther(gasSpent)} GLM)`);
    console.log(`Error Cause      : ${err.cause ? JSON.stringify(err.cause, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 500) : "none"}...`);

    const fullErrStr = String(err.stack || "") + " " + JSON.stringify(err.cause || {}, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    const isEstimateGas = /eth_estimateGas|estimateGas/i.test(fullErrStr);
    const isSendRawTx = /eth_sendRawTransaction|sendRawTransaction/i.test(fullErrStr);

    console.log(`Origin eth_estimateGas       : ${isEstimateGas}`);
    console.log(`Origin eth_sendRawTransaction: ${isSendRawTx}`);
    console.log("\nFull Stack Trace:\n" + stackStr);
  }
}

main().catch(console.error);
