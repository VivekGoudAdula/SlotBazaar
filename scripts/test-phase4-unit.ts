/**
 * scripts/test-phase4-unit.ts
 *
 * Phase 4 Pure Unit Tests:
 *  1. isProductionSlot filter:
 *     - "test slot" title is VISIBLE (never filtered by title or cluster).
 *     - seed_batch="dev-probe" is HIDDEN.
 *     - other probe batches ("cost-measure", "fr005-retest", "t06-*") are HIDDEN.
 *  2. Winner Selection:
 *     - Earliest created block wins.
 *     - Same block tie-breaker: lexicographically smaller entity key wins.
 *  3. Reputation Rule (pure function):
 *     - (a) Valid two-sided job verified.
 *     - (b) Self-booking rejected.
 *     - (c) Wrong-wallet seller rejected.
 *     - (d) Wrong-wallet buyer rejected.
 *     - (e) Duplicate completions do not double count.
 *     - (f) Missing seller side rejected.
 *     - (g) Missing buyer side rejected.
 *     - (h) Losing booking completion rejected.
 *     - (i) Completion before slot start rejected.
 *  4. Overall getReputation aggregator:
 *     - Computes correct scores and proof objects.
 *
 * Usage: npx tsx scripts/test-phase4-unit.ts
 */

import type { Address, Hex } from "viem";
import {
  isProductionSlot,
  getWinningBooking,
  verifyJobCompletion,
  getReputation,
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
} from "../src/lib/arkiv.js";

// ─────────────────────────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────

interface TestReport {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const reports: TestReport[] = [];

function assertTest(
  name: string,
  condition: boolean,
  expected: string,
  actual: string
) {
  reports.push({
    name,
    passed: condition,
    expected,
    actual,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRE-CHECK UNIT TESTS: isProductionSlot
// ─────────────────────────────────────────────────────────────────────────────

const mockBaseEntity = {
  key: "0x01" as Hex,
  creator: "0x1111111111111111111111111111111111111111" as Address,
  owner: "0x1111111111111111111111111111111111111111" as Address,
  startsAt: 1000,
  endsAt: 2000,
  category: "machine" as const,
  cluster: "surat",
  priceBand: "mid" as const,
  sellerLabel: "Test Seller",
  description: "Test description",
  lat: 21.17,
  lon: 72.83,
  synthetic: true,
};

// 1a. "test slot" title is VISIBLE
const uiTestSlot: SlotEntity = {
  ...mockBaseEntity,
  title: "test slot",
  seedBatch: "seed-v1",
};
assertTest(
  "Pre-check 0a: UI-style slot titled 'test slot' is visible",
  isProductionSlot(uiTestSlot) === true,
  "true (visible)",
  String(isProductionSlot(uiTestSlot))
);

// 1b. seed_batch="dev-probe" is HIDDEN
const devProbeSlot: SlotEntity = {
  ...mockBaseEntity,
  title: "Valid Title",
  seedBatch: "dev-probe",
};
assertTest(
  "Pre-check 0a: slot with seed_batch='dev-probe' is hidden",
  isProductionSlot(devProbeSlot) === false,
  "false (hidden)",
  String(isProductionSlot(devProbeSlot))
);

// 1c. other probe batches hidden
const costMeasureSlot: SlotEntity = {
  ...mockBaseEntity,
  title: "Machine",
  seedBatch: "cost-measure",
};
assertTest(
  "Pre-check 0a: slot with seed_batch='cost-measure' is hidden",
  isProductionSlot(costMeasureSlot) === false,
  "false (hidden)",
  String(isProductionSlot(costMeasureSlot))
);

const t06ProbeSlot: SlotEntity = {
  ...mockBaseEntity,
  title: "Transport",
  seedBatch: "t06-retest-batch",
};
assertTest(
  "Pre-check 0a: slot with seed_batch starting with 't06-' is hidden",
  isProductionSlot(t06ProbeSlot) === false,
  "false (hidden)",
  String(isProductionSlot(t06ProbeSlot))
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. WINNER SELECTION UNIT TESTS
// ─────────────────────────────────────────────────────────────────────────────

const bookingA: BookingEntity = {
  key: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex,
  creator: "0x2222222222222222222222222222222222222222" as Address,
  owner: "0x2222222222222222222222222222222222222222" as Address,
  slotKey: mockBaseEntity.key,
  bookedAt: 1050,
  createdAtBlock: 100n,
  synthetic: false,
};

const bookingB: BookingEntity = {
  key: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex,
  creator: "0x3333333333333333333333333333333333333333" as Address,
  owner: "0x3333333333333333333333333333333333333333" as Address,
  slotKey: mockBaseEntity.key,
  bookedAt: 1060,
  createdAtBlock: 105n, // later block
  synthetic: false,
};

// 2a. Earliest block wins
const winnerEarliestBlock = getWinningBooking([bookingB, bookingA]);
assertTest(
  "Winner Rule: Earliest confirmed block wins (block 100 < block 105)",
  winnerEarliestBlock?.key === bookingA.key,
  bookingA.key,
  winnerEarliestBlock?.key ?? "none"
);

// 2b. Same block: lexicographically smaller entity key wins
const bookingC: BookingEntity = {
  key: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as Hex,
  creator: "0x4444444444444444444444444444444444444444" as Address,
  owner: "0x4444444444444444444444444444444444444444" as Address,
  slotKey: mockBaseEntity.key,
  bookedAt: 1050,
  createdAtBlock: 100n, // same block as bookingA!
  synthetic: false,
};

// bookingA key starts with 0xbb..., bookingC starts with 0xcc...
// bookingA < bookingC lexicographically
const winnerSameBlock = getWinningBooking([bookingC, bookingA]);
assertTest(
  "Winner Rule: Same block tie-breaker (lexicographically smaller key '0xbb...' < '0xcc...')",
  winnerSameBlock?.key === bookingA.key,
  bookingA.key,
  winnerSameBlock?.key ?? "none"
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. REPUTATION RULE UNIT TESTS (pure verifyJobCompletion)
// ─────────────────────────────────────────────────────────────────────────────

const sellerAddr = "0x1111111111111111111111111111111111111111" as Address;
const buyerAddr = "0x2222222222222222222222222222222222222222" as Address;
const randoAddr = "0x9999999999999999999999999999999999999999" as Address;

const testSlot = {
  key: "0xSLOT01" as Hex,
  creator: sellerAddr,
  startsAt: 1000,
};

const validWinner: BookingEntity = {
  key: "0xBOOK_WIN" as Hex,
  creator: buyerAddr,
  owner: buyerAddr,
  slotKey: testSlot.key,
  slotCreator: sellerAddr,
  bookedAt: 1010,
  createdAtBlock: 50n,
};

const validSellerComp: CompletionEntity = {
  key: "0xCOMP_SELL" as Hex,
  creator: sellerAddr,
  owner: sellerAddr,
  bookingKey: validWinner.key,
  role: "seller",
  completedAt: 1100, // after slot startsAt (1000)
};

const validBuyerComp: CompletionEntity = {
  key: "0xCOMP_BUY" as Hex,
  creator: buyerAddr,
  owner: buyerAddr,
  bookingKey: validWinner.key,
  role: "buyer",
  completedAt: 1120, // after slot startsAt (1000)
};

// 3a. Valid job
const resValid = verifyJobCompletion(testSlot, validWinner, [validSellerComp, validBuyerComp]);
assertTest(
  "Reputation Rule: Valid job satisfied (distinct buyer/seller + post-start signatures)",
  resValid !== null,
  "verified",
  resValid ? "verified" : "null"
);

// 3b. Self-booking rejected
const selfBookingWinner: BookingEntity = {
  ...validWinner,
  creator: sellerAddr, // buyer is same as seller!
};
const resSelf = verifyJobCompletion(testSlot, selfBookingWinner, [
  validSellerComp,
  { ...validBuyerComp, creator: sellerAddr },
]);
assertTest(
  "Reputation Rule: Self-booking rejected (buyer creator == slot creator)",
  resSelf === null,
  "null",
  resSelf ? "verified" : "null"
);

// 3c. Wrong-wallet seller rejected
const wrongSellerComp: CompletionEntity = {
  ...validSellerComp,
  creator: randoAddr, // not sellerAddr!
};
const resWrongSeller = verifyJobCompletion(testSlot, validWinner, [wrongSellerComp, validBuyerComp]);
assertTest(
  "Reputation Rule: Wrong-wallet seller rejected (signature not from slot creator)",
  resWrongSeller === null,
  "null",
  resWrongSeller ? "verified" : "null"
);

// 3d. Wrong-wallet buyer rejected
const wrongBuyerComp: CompletionEntity = {
  ...validBuyerComp,
  creator: randoAddr, // not buyerAddr!
};
const resWrongBuyer = verifyJobCompletion(testSlot, validWinner, [validSellerComp, wrongBuyerComp]);
assertTest(
  "Reputation Rule: Wrong-wallet buyer rejected (signature not from winning buyer)",
  resWrongBuyer === null,
  "null",
  resWrongBuyer ? "verified" : "null"
);

// 3e. Duplicate completions do not double count
const duplicateSellerComp: CompletionEntity = {
  ...validSellerComp,
  key: "0xCOMP_SELL_DUP" as Hex,
};
const resDuplicate = verifyJobCompletion(testSlot, validWinner, [
  validSellerComp,
  duplicateSellerComp,
  validBuyerComp,
]);
assertTest(
  "Reputation Rule: Duplicate seller completions handled idempotently",
  resDuplicate !== null,
  "verified",
  resDuplicate ? "verified" : "null"
);

// 3f. Missing seller side rejected
const resMissingSeller = verifyJobCompletion(testSlot, validWinner, [validBuyerComp]);
assertTest(
  "Reputation Rule: Missing seller side rejected",
  resMissingSeller === null,
  "null",
  resMissingSeller ? "verified" : "null"
);

// 3g. Missing buyer side rejected
const resMissingBuyer = verifyJobCompletion(testSlot, validWinner, [validSellerComp]);
assertTest(
  "Reputation Rule: Missing buyer side rejected",
  resMissingBuyer === null,
  "null",
  resMissingBuyer ? "verified" : "null"
);

// 3h. Losing booking completion rejected
const losingBooking: BookingEntity = {
  key: "0xBOOK_LOSE" as Hex,
  creator: randoAddr,
  owner: randoAddr,
  slotKey: testSlot.key,
  bookedAt: 1020,
  createdAtBlock: 60n, // later block than validWinner
};
const losingBuyerComp: CompletionEntity = {
  key: "0xCOMP_LOSE" as Hex,
  creator: randoAddr,
  owner: randoAddr,
  bookingKey: losingBooking.key,
  role: "buyer",
  completedAt: 1150,
};
const resLosing = verifyJobCompletion(testSlot, validWinner, [validSellerComp, losingBuyerComp]);
assertTest(
  "Reputation Rule: Losing booking completions rejected (only winning booking counts)",
  resLosing === null,
  "null",
  resLosing ? "verified" : "null"
);

// 3i. Completion before slot start rejected
const prematureSellerComp: CompletionEntity = {
  ...validSellerComp,
  completedAt: 990, // BEFORE slot.startsAt (1000)
};
const resPremature = verifyJobCompletion(testSlot, validWinner, [prematureSellerComp, validBuyerComp]);
assertTest(
  "Reputation Rule: Completion before slot start rejected (completedAt < startsAt)",
  resPremature === null,
  "null",
  resPremature ? "verified" : "null"
);

// 3j. Expired slot: slot entity pruned, startsAt absent on slot, but preserved on booking
const expiredSlotStub = {
  key: testSlot.key,
  creator: sellerAddr,
  // startsAt is undefined because slot expired and was pruned
};
const winnerWithStartsAt: BookingEntity = {
  ...validWinner,
  slotStartsAt: 1000,
};
const resExpiredPremature = verifyJobCompletion(expiredSlotStub, winnerWithStartsAt, [prematureSellerComp, validBuyerComp]);
assertTest(
  "Reputation Rule: Expired slot completion before slot start rejected via booking.slotStartsAt",
  resExpiredPremature === null,
  "null",
  resExpiredPremature ? "verified" : "null"
);

const resExpiredValid = verifyJobCompletion(expiredSlotStub, winnerWithStartsAt, [validSellerComp, validBuyerComp]);
assertTest(
  "Reputation Rule: Expired slot valid completion accepted via booking.slotStartsAt",
  resExpiredValid !== null,
  "verified",
  resExpiredValid ? "verified" : "null"
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET REPUTATION AGGREGATOR TEST
// ─────────────────────────────────────────────────────────────────────────────

const repSeller = getReputation(sellerAddr, [testSlot as any], [validWinner], [validSellerComp, validBuyerComp]);
assertTest(
  "getReputation: Seller verifiedJobsCount equals 1 with on-chain proof keys",
  repSeller.verifiedJobsCount === 1 && repSeller.proofs.length === 1 && repSeller.proofs[0].bookingKey === validWinner.key,
  "1 verified job with proof",
  `${repSeller.verifiedJobsCount} verified jobs`
);

const repBuyer = getReputation(buyerAddr, [testSlot as any], [validWinner], [validSellerComp, validBuyerComp]);
assertTest(
  "getReputation: Buyer verifiedJobsCount equals 1 with symmetric proof keys",
  repBuyer.verifiedJobsCount === 1 && repBuyer.proofs.length === 1 && repBuyer.proofs[0].bookingKey === validWinner.key,
  "1 verified job with proof",
  `${repBuyer.verifiedJobsCount} verified jobs`
);

// ─────────────────────────────────────────────────────────────────────────────
// OUTPUT REPORT
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n========================================================");
console.log("  SLOTBAZAAR PHASE 4 UNIT TESTS (PURE / NO CHAIN)");
console.log("========================================================\n");

let allPassed = true;
for (const rep of reports) {
  const symbol = rep.passed ? " PASS" : " FAIL";
  console.log(`[${symbol}] ${rep.name}`);
  if (!rep.passed) {
    allPassed = false;
    console.log(`       Expected: ${rep.expected}`);
    console.log(`       Actual:   ${rep.actual}`);
  }
}

console.log("\n--------------------------------------------------------");
console.log(`Summary: ${reports.filter((r) => r.passed).length} / ${reports.length} passed.`);
console.log("--------------------------------------------------------\n");

if (!allPassed) {
  process.exit(1);
}
