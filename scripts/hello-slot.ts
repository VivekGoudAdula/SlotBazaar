/**
 * scripts/hello-slot.ts
 *
 * Phase 0: Create one synthetic "slot" entity on Arkiv Tiramisu testnet.
 *
 * Usage: npx tsx scripts/hello-slot.ts
 * Requires: PRIVATE_KEY in .env (hex, no 0x prefix)
 */

import "dotenv/config";
import { createWalletClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { str, u64, i32, bool } from "@arkiv-network/sdk/attr";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/** Load and validate the private key from .env */
function getAccount() {
  const raw = process.env.PRIVATE_KEY;
  if (!raw || raw.trim() === "") {
    throw new Error("PRIVATE_KEY is not set in .env — copy .env.example to .env and fill it in.");
  }
  // viem privateKeyToAccount requires 0x prefix
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  return privateKeyToAccount(hex as `0x${string}`);
}

async function main() {
  const account = getAccount();
  console.log("=== SlotBazaar Phase 0 — hello-slot ===");
  console.log(`Wallet address : ${account.address}`);

  // ── Wallet client (signs + sends) ──────────────────────────────────────────
  const wallet = createWalletClient({
    chain: tiramisu,
    transport: http(),
    account,
  });

  // ── Slot timing ────────────────────────────────────────────────────────────
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const threeHoursSec = BigInt(3 * 60 * 60);
  const endsAtSec = nowSec + threeHoursSec;
  const endsAtDate = new Date(Number(endsAtSec) * 1000);

  console.log(`starts_at (u64 unix sec) : ${nowSec}`);
  console.log(`ends_at   (u64 unix sec) : ${endsAtSec} → ${endsAtDate.toISOString()}`);

  // ── Payload (non-filterable data, stored in entity payload) ────────────────
  const payload = jsonToPayload({
    // SYNTHETIC DATA — no real names, phone numbers, or GSTIN
    title: "CNC Milling Machine Block — 3hr",
    description: "SYNTHETIC synthetic: 3-hour block on a 4-axis CNC mill. Suitable for aluminium parts.",
    seller_label: "Surat Metal Works (SYNTHETIC)",
    schema_version: 1,
    note: "synthetic",
  });

  // ── Attributes (filterable by the query engine) ────────────────────────────
  const attributes = {
    // Namespace / scope
    project: str("slotbazaar"),
    entity_type: str("slot"),
    schema_v: str("1"),

    // Category and geography
    category: str("machine"),
    cluster: str("surat"),

    // Timing — u64 unix seconds
    starts_at: u64(nowSec),
    ends_at: u64(endsAtSec),

    // Pricing tier
    price_band: str("mid"),

    // Location — degrees × 10 000, stored as i32 (supports negatives)
    // Surat, India: approx 21.1702° N, 72.8311° E
    lat_e4: i32(211702),
    lon_e4: i32(728311),

    // Synthetic flag — required by brief, useful for test cleanup
    synthetic: bool(true),
  };

  console.log("\nCreating entity on Tiramisu testnet...");
  // BigInt values (u64) cannot be serialised by JSON.stringify without a replacer
  console.log("Attributes:", JSON.stringify(
    Object.fromEntries(
      Object.entries(attributes).map(([k, v]) => [k, v])
    ),
    (_key, val) => (typeof val === "bigint" ? val.toString() : val),
    2
  ));

  // ── Create entity — Entity Expiration = slot end time ─────────────────────
  const { entityKey, txHash, expiresAt } = await wallet.createEntity({
    payload,
    contentType: "application/json",
    attributes,
    // Entity Expiration is set to match ends_at (the slot end wall-clock time).
    // atDate rounds UP to the nearest block — documented behaviour.
    expires: ExpirationTime.atDate(endsAtDate),
  });

  // ── Print results ──────────────────────────────────────────────────────────
  const explorerBase = "https://tiramisu.explorer.arkiv.network";
  console.log("\n✅ Entity created!");
  console.log(`Entity key : ${entityKey}`);
  console.log(`Tx hash    : ${txHash}`);
  console.log(`Expires at : block ${expiresAt}`);
  console.log(`Tx link    : ${explorerBase}/tx/${txHash}`);
  console.log(`\nWallet address for WALLETS.md: ${account.address}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
