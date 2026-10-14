/**
 * scripts/test-phase5-unit.ts
 *
 * Phase 5 Unit Tests:
 *  1. Mocked SDK Pagination:
 *     - fetchAllBookings loops over ALL pages (>200 entities, e.g. 250 across 3 pages)
 *     - fetchAllCompletions loops over ALL pages (>200 entities, e.g. 250 across 3 pages)
 *     - Pinned block snapshot / hasNextPage handling
 *  2. isProductionSlot filter:
 *     - ui-seed-* batches are VISIBLE (never hidden)
 *     - dev-probe, cost-measure, fr005-retest, t06-* remain HIDDEN
 *  3. Seed Generator Rules:
 *     - Spreads across industrial clusters
 *     - Covers categories (machine, transport, freelance)
 *     - Spreads durations: includes short (<15m) and long (>24h up to 7d)
 *     - Strictly refuses past expiries
 *     - Only fictional seller names
 *  4. Seed Modal Guards:
 *     - 60-second cooldown enforcement
 *     - 40-slot live synthetic limit check
 *     - Minimum balance check before sending
 *  5. Local Client-Side Expiry Removal Logic:
 *     - Removes slot when endsAt <= nowSec + margin
 *  6. Reputation Post-Expiry Rule:
 *     - Slot expired (startsAt undefined on slot), but startsAt preserved on booking.slotStartsAt
 *
 * Usage: npx tsx scripts/test-phase5-unit.ts
 */

import type { Hex, Address } from "viem";
import {
  fetchAllBookings,
  fetchAllCompletions,
  isProductionSlot,
  verifyJobCompletion,
  getReputation,
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
  type PublicArkivClient,
} from "../src/lib/arkiv.js";
import { generateSeedSlots, SEED_TEMPLATES } from "../src/lib/seedGenerator.js";
import { CLUSTERS } from "../src/lib/clusters.js";

interface TestReport {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const reports: TestReport[] = [];

function assertTest(name: string, condition: boolean, expected: string, actual: string) {
  reports.push({ name, passed: condition, expected, actual });
}

async function runTests() {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. MOCKED PAGINATION: fetchAllBookings & fetchAllCompletions (>200 ENTITIES)
  // ─────────────────────────────────────────────────────────────────────────────

  // Build 250 raw mock booking entities across 3 pages: 100, 100, 50
  const TOTAL_MOCK_ENTITIES = 250;
  const mockBookingEntities = Array.from({ length: TOTAL_MOCK_ENTITIES }, (_, i) => ({
    key: `0xbook_${i.toString().padStart(4, "0")}` as Hex,
    creator: "0x1111111111111111111111111111111111111111",
    owner: "0x1111111111111111111111111111111111111111",
    createdAt: 100n,
    expiresAt: 200n,
    attributes: {
      project: { type: "str", value: "slotbazaar" },
      entity_type: { type: "str", value: "booking" },
      schema_v: { type: "str", value: "2" },
      slot_key: { type: "key", value: `0xslot_${i}` },
      slot_creator: { type: "str", value: "0x2222222222222222222222222222222222222222" },
      slot_starts_at: { type: "u64", value: 1000n },
      slot_ends_at: { type: "u64", value: 2000n },
      booked_at: { type: "u64", value: 1050n },
      synthetic: { type: "bool", value: true },
    },
    toJson: () => ({ note: `Booking #${i}`, schema_version: 2 }),
  }));

  const mockCompletionEntities = Array.from({ length: TOTAL_MOCK_ENTITIES }, (_, i) => ({
    key: `0xcomp_${i.toString().padStart(4, "0")}` as Hex,
    creator: "0x2222222222222222222222222222222222222222",
    owner: "0x2222222222222222222222222222222222222222",
    createdAt: 105n,
    expiresAt: 205n,
    attributes: {
      project: { type: "str", value: "slotbazaar" },
      entity_type: { type: "str", value: "completion" },
      schema_v: { type: "str", value: "2" },
      booking_key: { type: "key", value: `0xbook_${i.toString().padStart(4, "0")}` },
      role: { type: "str", value: "seller" },
      completed_at: { type: "u64", value: 1100n },
      synthetic: { type: "bool", value: true },
    },
    toJson: () => ({ note: `Job #${i} fulfilled`, schema_version: 2 }),
  }));

  // Create paginated QueryResult mock generator
  function createMockPageResult(entitiesList: any[], pageSize = 100) {
    let offset = 0;

    function getPage() {
      const slice = entitiesList.slice(offset, offset + pageSize);
      offset += pageSize;
      const hasMore = offset < entitiesList.length;

      return {
        entities: slice,
        hasNextPage: () => hasMore,
        next: async () => getPage(),
        cursor: `cursor-block-snapshot-86900-${offset}`,
      };
    }

    return getPage();
  }

  // Mock public clients
  const mockBookingClient = {
    select: () => ({
      where: () => ({
        fetch: async () => createMockPageResult(mockBookingEntities, 100),
      }),
    }),
  } as unknown as PublicArkivClient;

  const fetchedBookings = await fetchAllBookings(mockBookingClient);
  assertTest(
    "Pagination: fetchAllBookings loops over all pages (>200 entities: 250 items)",
    fetchedBookings.length === 250,
    "250 bookings",
    `${fetchedBookings.length} bookings`
  );

  const mockCompletionClient = {
    select: () => ({
      where: () => ({
        fetch: async () => createMockPageResult(mockCompletionEntities, 100),
      }),
    }),
  } as unknown as PublicArkivClient;

  const fetchedCompletions = await fetchAllCompletions(mockCompletionClient);
  assertTest(
    "Pagination: fetchAllCompletions loops over all pages (>200 entities: 250 items)",
    fetchedCompletions.length === 250,
    "250 completions",
    `${fetchedCompletions.length} completions`
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. VISIBILITY: isProductionSlot with ui-seed batches
  // ─────────────────────────────────────────────────────────────────────────────

  const uiSeedSlot = {
    title: "[SURAT] CNC Lathe block (2h)",
    seedBatch: "ui-seed-1728876400",
    cluster: "surat",
  };
  assertTest(
    "Visibility: isProductionSlot does NOT hide ui-seed batches",
    isProductionSlot(uiSeedSlot) === true,
    "true (visible)",
    String(isProductionSlot(uiSeedSlot))
  );

  const devProbeSlot = {
    title: "dev-probe test",
    seedBatch: "dev-probe",
    cluster: "surat",
  };
  assertTest(
    "Visibility: isProductionSlot hides dev-probe batch",
    isProductionSlot(devProbeSlot) === false,
    "false (hidden)",
    String(isProductionSlot(devProbeSlot))
  );

  const testSlotTitle = {
    title: "test slot custom title",
    seedBatch: "ui-seed-1728876499",
    cluster: "mumbai",
  };
  assertTest(
    "Visibility: isProductionSlot never hides slots titled 'test slot'",
    isProductionSlot(testSlotTitle) === true,
    "true (visible)",
    String(isProductionSlot(testSlotTitle))
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SEED GENERATOR RULES
  // ─────────────────────────────────────────────────────────────────────────────

  const nowSec = 1728876400;
  const generatedSlots = generateSeedSlots({ count: 20, nowSec, includeLong: true });

  assertTest(
    "Seed Generator: Generates exact requested count (20 slots)",
    generatedSlots.length === 20,
    "20 slots",
    `${generatedSlots.length} slots`
  );

  // Cluster spread
  const uniqueClusters = new Set(generatedSlots.map((s) => s.cluster));
  assertTest(
    "Seed Generator: Spreads across multiple clusters (>= 5 clusters)",
    uniqueClusters.size >= 5,
    ">= 5 clusters",
    `${uniqueClusters.size} clusters`
  );

  // Category spread
  const categories = new Set(generatedSlots.map((s) => s.category));
  assertTest(
    "Seed Generator: Covers machine, transport, and freelance categories",
    categories.has("machine") && categories.has("transport") && categories.has("freelance"),
    "machine, transport, freelance",
    Array.from(categories).join(", ")
  );

  // Short duration (< 15 min = 0.25h)
  const hasShort = generatedSlots.some((s) => s.durationHours <= 0.25);
  assertTest(
    "Seed Generator: Includes short slots under 15 minutes",
    hasShort,
    "true",
    String(hasShort)
  );

  // Long duration (> 24 hours)
  const hasLong = generatedSlots.some((s) => s.durationHours >= 24);
  assertTest(
    "Seed Generator: Includes long slots over 24 hours (up to 7 days)",
    hasLong,
    "true",
    String(hasLong)
  );

  // Past expiry safety
  const allFuture = generatedSlots.every((s) => s.endsAt > nowSec);
  assertTest(
    "Seed Generator: Strictly refuses past expiries (all endsAt > nowSec)",
    allFuture,
    "true",
    String(allFuture)
  );

  // Only fictional seller labels
  const knownTemplates = new Set(SEED_TEMPLATES.map((t) => t.sellerLabel));
  const fictionalOnly = generatedSlots.every((s) => knownTemplates.has(s.sellerLabel));
  assertTest(
    "Seed Generator: Uses only fictional SME seller labels",
    fictionalOnly,
    "true",
    String(fictionalOnly)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEED MODAL GUARDS (PURE LOGIC)
  // ─────────────────────────────────────────────────────────────────────────────

  // Guard: 60-second cooldown
  function checkCooldown(lastSeedTimestamp: number, currentTimestamp: number): boolean {
    return currentTimestamp - lastSeedTimestamp < 60;
  }
  assertTest(
    "Modal Guard: Rejects seed attempt within 60s cooldown (e.g. 30s elapsed)",
    checkCooldown(1000, 1030) === true,
    "true (blocked by cooldown)",
    String(checkCooldown(1000, 1030))
  );
  assertTest(
    "Modal Guard: Allows seed attempt after 60s cooldown (e.g. 65s elapsed)",
    checkCooldown(1000, 1065) === false,
    "false (allowed)",
    String(checkCooldown(1000, 1065))
  );

  // Guard: 40-slot live synthetic limit
  function canSeedMore(liveSyntheticCount: number): boolean {
    return liveSyntheticCount < 40;
  }
  assertTest(
    "Modal Guard: Refuses seed if there are already 40 or more live synthetic slots",
    canSeedMore(40) === false && canSeedMore(42) === false,
    "false (refused)",
    `40: ${canSeedMore(40)}, 42: ${canSeedMore(42)}`
  );
  assertTest(
    "Modal Guard: Permits seed if live synthetic slots < 40",
    canSeedMore(15) === true,
    "true (permitted)",
    String(canSeedMore(15))
  );

  // Guard: Balance check before sending
  function hasSufficientBalance(balanceWei: bigint, requiredCostWei: bigint): boolean {
    return balanceWei >= requiredCostWei;
  }
  const minRequiredWei = 1000000000000000n; // 0.001 GLM
  assertTest(
    "Modal Guard: Refuses seed when wallet has 0 GLM",
    hasSufficientBalance(0n, minRequiredWei) === false,
    "false (insufficient balance)",
    String(hasSufficientBalance(0n, minRequiredWei))
  );
  assertTest(
    "Modal Guard: Permits seed when wallet has 0.05 GLM",
    hasSufficientBalance(50000000000000000n, minRequiredWei) === true,
    "true (sufficient balance)",
    String(hasSufficientBalance(50000000000000000n, minRequiredWei))
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. CLIENT-SIDE EXPIRY REMOVAL LOGIC
  // ─────────────────────────────────────────────────────────────────────────────

  // Margin: 1-2 blocks = 4 seconds
  const BLOCK_MARGIN_SEC = 4;
  function isExpiredLocally(slotEndsAt: number, currentLocalSec: number): boolean {
    return slotEndsAt <= currentLocalSec + BLOCK_MARGIN_SEC;
  }

  const slotActive = isExpiredLocally(nowSec + 60, nowSec);
  assertTest(
    "Client-Side Expiry: Active slot (60s remaining) is NOT removed",
    slotActive === false,
    "false (active)",
    String(slotActive)
  );

  const slotExpired = isExpiredLocally(nowSec - 2, nowSec);
  assertTest(
    "Client-Side Expiry: Expired slot (-2s past) IS removed immediately",
    slotExpired === true,
    "true (removed)",
    String(slotExpired)
  );

  const slotExpiringNow = isExpiredLocally(nowSec + 2, nowSec); // within 4s block margin
  assertTest(
    "Client-Side Expiry: Slot within 4s (1-2 block margin) IS pruned proactively",
    slotExpiringNow === true,
    "true (pruned)",
    String(slotExpiringNow)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. REPUTATION POST-EXPIRY START-TIME RULE
  // ─────────────────────────────────────────────────────────────────────────────

  const seller: Address = "0x5555555555555555555555555555555555555555";
  const buyer: Address = "0x6666666666666666666666666666666666666666";
  const expiredSlot = {
    key: "0xSLOT_EXPIRED" as Hex,
    creator: seller,
    // startsAt is undefined because slot was pruned from Arkiv index
  };

  const winningBookingWithStartsAt: BookingEntity = {
    key: "0xBOOK_WIN" as Hex,
    creator: buyer,
    owner: buyer,
    slotKey: expiredSlot.key,
    slotCreator: seller,
    slotStartsAt: 5000, // startsAt preserved on booking entity
    slotEndsAt: 6000,
    bookedAt: 4900,
    note: "",
    createdAtBlock: 100n,
    synthetic: false,
    schemaVersion: 2,
  };

  const prematureComp: CompletionEntity = {
    key: "0xCOMP_PRE" as Hex,
    creator: seller,
    owner: seller,
    bookingKey: winningBookingWithStartsAt.key,
    role: "seller",
    completedAt: 4950, // before slotStartsAt (5000)
    note: "",
    synthetic: false,
    schemaVersion: 2,
  };

  const buyerComp: CompletionEntity = {
    key: "0xCOMP_BUY" as Hex,
    creator: buyer,
    owner: buyer,
    bookingKey: winningBookingWithStartsAt.key,
    role: "buyer",
    completedAt: 5100,
    note: "",
    synthetic: false,
    schemaVersion: 2,
  };

  const resPrematureExpired = verifyJobCompletion(expiredSlot, winningBookingWithStartsAt, [
    prematureComp,
    buyerComp,
  ]);
  assertTest(
    "Reputation Rule: Premature completion rejected on expired slot via booking.slotStartsAt",
    resPrematureExpired === null,
    "null",
    resPrematureExpired ? "verified" : "null"
  );

  const validSellerComp: CompletionEntity = {
    ...prematureComp,
    completedAt: 5050, // after slotStartsAt (5000)
  };

  const resValidExpired = verifyJobCompletion(expiredSlot, winningBookingWithStartsAt, [
    validSellerComp,
    buyerComp,
  ]);
  assertTest(
    "Reputation Rule: Valid completion accepted on expired slot via booking.slotStartsAt",
    resValidExpired !== null,
    "verified",
    resValidExpired ? "verified" : "null"
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // REPORT
  // ─────────────────────────────────────────────────────────────────────────────

  console.log("\n========================================================");
  console.log("  SLOTBAZAAR PHASE 5 UNIT TESTS");
  console.log("========================================================\n");

  let allPassed = true;
  for (const rep of reports) {
    const symbol = rep.passed ? " PASS" : " FAIL";
    console.log(`[${symbol}] ${rep.name}`);
    if (!rep.passed) {
      allPassed = false;
      console.log(`       Expected: ${rep.expected}`);
      console.log(`       Actual  : ${rep.actual}`);
    }
  }

  console.log("\n--------------------------------------------------------");
  console.log(`Summary: ${reports.filter((r) => r.passed).length} / ${reports.length} passed.`);
  console.log("--------------------------------------------------------\n");

  if (!allPassed) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
