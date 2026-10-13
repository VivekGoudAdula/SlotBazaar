/**
 * scripts/test-reputation.ts
 *
 * Pure unit tests for the three-part reputation verification rule.
 * No chain calls, no gas, no MetaMask — all data is mocked inline.
 *
 * Tests:
 *  1. Valid job — all three conditions met
 *  2. Self-booking — winning booking creator = slot creator (MUST fail)
 *  3. Seller completion from wrong wallet — completion.creator ≠ slot.creator (MUST fail)
 *  4. Buyer completion from wallet that did NOT book — completion.creator ≠ winner.creator (MUST fail)
 *  5. Duplicate completions — two seller completions (first valid one wins; still passes if (c) also present)
 *  6. Missing buyer side — only seller completion present (MUST fail)
 *  7. Missing seller side — only buyer completion present (MUST fail)
 *  8. Winner booking exists but no completions at all (MUST fail)
 *
 * Usage: npx tsx scripts/test-reputation.ts
 */

import type { Address, Hex } from "viem";
import {
  verifyJobCompletion,
  type BookingEntity,
  type CompletionEntity,
} from "../src/lib/arkiv.js";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK ADDRESSES
// ─────────────────────────────────────────────────────────────────────────────

const SLOT_CREATOR = "0xSELLER000000000000000000000000000000000000" as Address;
const BUYER_A      = "0xBUYER_A0000000000000000000000000000000000000" as Address;
const BUYER_B      = "0xBUYER_B0000000000000000000000000000000000000" as Address;
const RANDO        = "0xRANDOM0000000000000000000000000000000000000" as Address;

const SLOT_KEY     = "0x000000000000000000000000000000000000000000000000000000000000AAA1" as Hex;

// ─────────────────────────────────────────────────────────────────────────────
// MOCK BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function mockSlot(
  key = SLOT_KEY,
  creator = SLOT_CREATOR
): { key: Hex; creator: Address } {
  return { key, creator };
}

function mockBooking(creator: Address, key = "0xBOOK01" as Hex): BookingEntity {
  return {
    key,
    creator,
    owner: creator,
    slotKey: SLOT_KEY,
    bookedAt: 1_000_000,
    note: "",
    synthetic: true,
  };
}

function mockCompletion(
  role: "seller" | "buyer",
  creator: Address,
  slotKey: Hex = SLOT_KEY,
  key = "0xCOMPLETION01" as Hex
): CompletionEntity {
  return {
    key,
    creator,
    owner: creator,
    slotKey,
    role,
    completedAt: 1_000_000,
    note: "",
    synthetic: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; detail: string };
const results: TestResult[] = [];

function test(
  name: string,
  slot: { key: Hex; creator: Address },
  winner: BookingEntity | null,
  completions: CompletionEntity[],
  expectPass: boolean
): void {
  const result = verifyJobCompletion(slot, winner, completions);
  const passed = expectPass ? result !== null : result === null;
  const detail = result === null
    ? "returned null (job not verified)"
    : `returned verified result (winner=${result.winner.creator.slice(0, 10)}, seller=${result.seller.creator.slice(0, 10)}, buyer=${result.buyer.creator.slice(0, 10)})`;
  results.push({ name, passed, detail });
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

// 1. Valid job — all three conditions met
test(
  "1. Valid job — all conditions satisfied",
  mockSlot(),
  mockBooking(BUYER_A),
  [
    mockCompletion("seller", SLOT_CREATOR, SLOT_KEY, "0xSELL01" as Hex),
    mockCompletion("buyer",  BUYER_A,      SLOT_KEY, "0xBUY01"  as Hex),
  ],
  true /* should pass */
);

// 2. Self-booking — winning booking creator = slot creator (condition a fails)
test(
  "2. Self-booking — winning booking creator equals slot creator",
  mockSlot(),
  mockBooking(SLOT_CREATOR), // same as slot creator!
  [
    mockCompletion("seller", SLOT_CREATOR, SLOT_KEY, "0xSELL02" as Hex),
    mockCompletion("buyer",  SLOT_CREATOR, SLOT_KEY, "0xBUY02"  as Hex),
  ],
  false /* must fail */
);

// 3. Seller completion from wrong wallet — not the slot creator (condition b fails)
test(
  "3. Seller completion from wrong wallet (not slot creator)",
  mockSlot(),
  mockBooking(BUYER_A),
  [
    mockCompletion("seller", RANDO,   SLOT_KEY, "0xSELL03" as Hex), // RANDO, not SLOT_CREATOR
    mockCompletion("buyer",  BUYER_A, SLOT_KEY, "0xBUY03"  as Hex),
  ],
  false /* must fail */
);

// 4. Buyer completion from wallet that did not win the booking (condition c fails)
test(
  "4. Buyer completion creator does not match winning booking creator",
  mockSlot(),
  mockBooking(BUYER_A),
  [
    mockCompletion("seller", SLOT_CREATOR, SLOT_KEY, "0xSELL04" as Hex),
    mockCompletion("buyer",  BUYER_B,      SLOT_KEY, "0xBUY04"  as Hex), // BUYER_B, not BUYER_A
  ],
  false /* must fail */
);

// 5. Duplicate seller completions — first one from correct wallet; buyer from winner
//    The verifyJobCompletion uses Array.find(), so first valid seller match wins.
test(
  "5. Duplicate seller completions — valid one present first",
  mockSlot(),
  mockBooking(BUYER_A),
  [
    mockCompletion("seller", SLOT_CREATOR, SLOT_KEY, "0xSELL05A" as Hex), // correct
    mockCompletion("seller", RANDO,        SLOT_KEY, "0xSELL05B" as Hex), // duplicate / wrong
    mockCompletion("buyer",  BUYER_A,      SLOT_KEY, "0xBUY05"   as Hex),
  ],
  true /* should still pass — first seller is valid */
);

// 6. Missing buyer side — only seller completion present (condition c fails)
test(
  "6. Missing buyer completion — only seller present",
  mockSlot(),
  mockBooking(BUYER_A),
  [
    mockCompletion("seller", SLOT_CREATOR, SLOT_KEY, "0xSELL06" as Hex),
    // No buyer completion
  ],
  false /* must fail */
);

// 7. Missing seller side — only buyer completion present (condition b fails)
test(
  "7. Missing seller completion — only buyer present",
  mockSlot(),
  mockBooking(BUYER_A),
  [
    // No seller completion
    mockCompletion("buyer", BUYER_A, SLOT_KEY, "0xBUY07" as Hex),
  ],
  false /* must fail */
);

// 8. Winner booking exists but no completions at all
test(
  "8. No completions at all — booking exists, nothing confirmed",
  mockSlot(),
  mockBooking(BUYER_A),
  [], // empty
  false /* must fail */
);

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

console.log("\n══════════════════════════════════════════════");
console.log("  SlotBazaar · Reputation Rule Unit Tests");
console.log("══════════════════════════════════════════════\n");

for (const r of results) {
  const icon = r.passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon}  ${r.name}`);
  if (!r.passed) {
    console.log(`        ↳ ${r.detail}\n`);
  }
  r.passed ? passed++ : failed++;
}

console.log("\n──────────────────────────────────────────────");
console.log(`  Results: ${passed} passed, ${failed} failed out of ${results.length} total`);
console.log("──────────────────────────────────────────────\n");

if (failed > 0) {
  process.exit(1);
}
