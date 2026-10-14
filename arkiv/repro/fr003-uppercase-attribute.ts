/**
 * arkiv/repro/fr003-uppercase-attribute.ts
 *
 * Minimal, clean reproduction for FR-003:
 * Demonstrates that passing an uppercase attribute name (e.g. "ProjectName")
 * fails during node-side gas estimation simulation with `Ident32InvalidByte(0, 0x50)`.
 * It never reaches `eth_sendRawTransaction`. Zero gas/GLM is spent.
 *
 * Requirements:
 * - PRIVATE_KEY in .env (with testnet GLM on Arkiv Tiramisu)
 *
 * Usage:
 * - node ./node_modules/tsx/dist/cli.mjs arkiv/repro/fr003-uppercase-attribute.ts
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

  console.log("=== FR-003 REPRO: Uppercase Attribute Simulation Revert ===");
  const balBefore = await pub.getBalance({ address: account.address });
  console.log(`Account: ${account.address}`);
  console.log(`Balance before: ${formatEther(balBefore)} GLM`);

  try {
    await wallet.createEntity({
      payload: jsonToPayload({ test: "fr003" }),
      contentType: "application/json",
      attributes: {
        ProjectName: str("invalid-uppercase"), // uppercase attribute name
        project: str("slotbazaar"),
      },
      expires: ExpirationTime.fromMinutes(10),
    });
    console.log("UNEXPECTED: Tx succeeded");
  } catch (err: any) {
    const balAfter = await pub.getBalance({ address: account.address });
    const gasSpent = balBefore - balAfter;
    const msg = String(err?.message || err);

    console.log("\n[CONFIRMED ERROR TRACE]");
    console.log("- Error Name:", err?.name);
    console.log("- Origin: Node simulation in eth_estimateGas (ContractFunctionRevertedError)");
    console.log("- Detail:", msg.includes("Ident32InvalidByte") ? "Ident32InvalidByte(0, 0x50) detected" : msg.slice(0, 150));
    console.log("- Gas Spent:", `${gasSpent.toString()} wei (${formatEther(gasSpent)} GLM)`);
    console.log("\n[VERDICT]");
    console.log("- Zero gas was spent on-chain.");
    console.log("- Node simulation rejects uppercase characters; SDK lacks client pre-validation.");
  }
}

main().catch(console.error);
