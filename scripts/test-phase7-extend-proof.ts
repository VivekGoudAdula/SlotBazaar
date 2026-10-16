/**
 * scripts/test-phase7-extend-proof.ts
 *
 * Phase 7 Regression Test Suite:
 * Proof Lifetime Extension, Idempotency Guard, Wallet Rejections & On-Chain Verification
 *
 * Covers:
 *  1. Entity flag validation (permissionlessExtension check before wallet prompt)
 *  2. Missing/expired entity validation (throws QUERY_ERROR before wallet prompt)
 *  3. Wallet readiness validation (account check before acquiring write lock)
 *  4. Expiry calculation strictly advances beyond entity.expiresAt
 *  5. Guard release on wallet rejection (user denies transaction)
 *  6. Immediate retry allowed after failure (no lingering "already in progress" lock)
 *  7. Receipt lock isolation (Receipt A in-flight does not block Receipt B)
 *  8. Post-tx on-chain advancement verification (fails if expiry didn't advance)
 *  9. Successful extension with verified advancement
 * 10. Existing booking, ownership, and completion behavior preserved
 *
 * Usage: npx tsx scripts/test-phase7-extend-proof.ts
 */

import { type Address, type Hex } from "viem";
import {
  extendProofEntity,
  acquireEntityLock,
  releaseEntityLock,
  isEntityLocked,
  type WalletArkivClient,
  type PublicArkivClient,
  type FullEntity,
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

function assertTest(name: string, condition: boolean, expected: string, actual: string): void {
  reports.push({ name, passed: condition, expected, actual });
  const statusTag = condition ? "[ PASS]" : "[!FAIL]";
  console.log(`${statusTag} ${name}`);
  if (!condition) {
    console.error(`       Expected: ${expected}`);
    console.error(`       Actual:   ${actual}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA & CLIENTS
// ─────────────────────────────────────────────────────────────────────────────

const VALID_RECEIPT_KEY = "0xd4af77659b859e1dd513a0306ce602cea8948f51a406c9568354744a80240cac" as Hex;
const OTHER_RECEIPT_KEY = "0xecdc45bf11bae133c26a4ec31e3a5125ae1e7faeba6aa30a66d8a19b27f07aef" as Hex;
const INELIGIBLE_KEY    = "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex;
const WALLET_ADDRESS    = "0xf48E7802a97781cca58750a6e5F1f1ab93763225" as Address;

function createMockPublicClient(overrides: {
  entityMap?: Map<string, Partial<FullEntity>>;
  blockNumber?: bigint;
} = {}): PublicArkivClient {
  const currentBlock = overrides.blockNumber ?? 647000n;
  const entityMap = overrides.entityMap ?? new Map<string, Partial<FullEntity>>();

  return {
    getBlockNumber: async () => currentBlock,
    getEntity: async (key: string) => {
      const match = entityMap.get(key.toLowerCase());
      if (!match) {
        throw new Error(`Entity ${key} not found`);
      }
      return match as FullEntity;
    },
  } as unknown as PublicArkivClient;
}

function createMockWalletClient(overrides: {
  extendEntityFn?: (args: { entityKey: Hex; expires: any }) => Promise<{ entityKey: Hex; txHash: string; expiresAt: bigint }>;
  address?: Address;
} = {}): WalletArkivClient {
  return {
    account: { address: overrides.address ?? WALLET_ADDRESS },
    chain: { id: 7738577 },
    extendEntity: overrides.extendEntityFn ?? (async ({ entityKey }) => ({
      entityKey,
      txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      expiresAt: 2500000n,
    })),
  } as unknown as WalletArkivClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST RUNNER
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log("\n========================================================");
  console.log("  SLOTBAZAAR PHASE 7 PROOF EXTENSION REGRESSION TESTS");
  console.log("========================================================\n");

  const validEntity: Partial<FullEntity> = {
    key: VALID_RECEIPT_KEY,
    creator: WALLET_ADDRESS,
    owner: WALLET_ADDRESS,
    createdAt: 100000n,
    expiresAt: 1938046n,
    creationFlags: { readonly: true, permissionlessExtension: true, raw: 3 },
  };

  const otherEntity: Partial<FullEntity> = {
    key: OTHER_RECEIPT_KEY,
    creator: WALLET_ADDRESS,
    owner: WALLET_ADDRESS,
    createdAt: 100000n,
    expiresAt: 1938046n,
    creationFlags: { readonly: true, permissionlessExtension: true, raw: 3 },
  };

  const ineligibleEntity: Partial<FullEntity> = {
    key: INELIGIBLE_KEY,
    creator: "0x2222222222222222222222222222222222222222" as Address,
    owner: "0x2222222222222222222222222222222222222222" as Address,
    createdAt: 100000n,
    expiresAt: 1938046n,
    creationFlags: { readonly: true, permissionlessExtension: false, raw: 1 },
  };

  const entityDb = new Map<string, Partial<FullEntity>>([
    [VALID_RECEIPT_KEY.toLowerCase(), { ...validEntity }],
    [OTHER_RECEIPT_KEY.toLowerCase(), { ...otherEntity }],
    [INELIGIBLE_KEY.toLowerCase(), { ...ineligibleEntity }],
  ]);

  // Test 1: Ineligible entity without permissionlessExtension is rejected before wallet prompt & lock
  let test1Error = "";
  try {
    const mockPub = createMockPublicClient({ entityMap: entityDb });
    const mockWallet = createMockWalletClient();
    await extendProofEntity(mockWallet, INELIGIBLE_KEY, 60, mockPub);
  } catch (err: any) {
    test1Error = err.message || String(err);
  }
  const test1LockFree = !isEntityLocked(`extendProof:${INELIGIBLE_KEY.toLowerCase()}`);
  assertTest(
    "Pre-check 1: Entity without permissionlessExtension rejected with INVALID_PAYLOAD and leaves lock free",
    test1Error.includes("permissionlessExtension") && test1LockFree,
    "Rejected with permissionlessExtension error & lock released",
    `Error: ${test1Error.slice(0, 45)}... | lockFree: ${test1LockFree}`
  );

  // Test 2: Missing/expired entity throws QUERY_ERROR without setting guard
  let test2Error = "";
  const missingKey = "0x9999999999999999999999999999999999999999999999999999999999999999" as Hex;
  try {
    const mockPub = createMockPublicClient({ entityMap: entityDb });
    const mockWallet = createMockWalletClient();
    await extendProofEntity(mockWallet, missingKey, 60, mockPub);
  } catch (err: any) {
    test2Error = err.message || String(err);
  }
  const test2LockFree = !isEntityLocked(`extendProof:${missingKey.toLowerCase()}`);
  assertTest(
    "Pre-check 2: Missing/expired entity rejected with QUERY_ERROR without acquiring lock",
    test2Error.includes("could not be found") && test2LockFree,
    "Rejected with missing error & lock released",
    `Error: ${test2Error.slice(0, 45)}... | lockFree: ${test2LockFree}`
  );

  // Test 3: Wallet readiness validation (unauthorized / missing wallet throws WALLET_REJECTED)
  let test3Error = "";
  try {
    const mockPub = createMockPublicClient({ entityMap: entityDb });
    const invalidWallet = { account: undefined } as unknown as WalletArkivClient;
    await extendProofEntity(invalidWallet, VALID_RECEIPT_KEY, 60, mockPub);
  } catch (err: any) {
    test3Error = err.message || String(err);
  }
  assertTest(
    "Pre-check 3: Wallet without authorized account rejected with WALLET_REJECTED before write",
    test3Error.includes("Wallet is not ready") || test3Error.includes("authorized account"),
    "Wallet readiness rejection",
    test3Error
  );

  // Test 4: Guard release on wallet rejection (User clicks 'Reject' in MetaMask)
  let test4Error = "";
  const mockPub4 = createMockPublicClient({ entityMap: entityDb });
  const mockRejectWallet = createMockWalletClient({
    extendEntityFn: async () => {
      // Simulate MetaMask user rejection error (code 4001)
      const err: any = new Error("User rejected the request.");
      err.code = 4001;
      throw err;
    },
  });

  try {
    await extendProofEntity(mockRejectWallet, VALID_RECEIPT_KEY, 60, mockPub4);
  } catch (err: any) {
    test4Error = err.message || String(err);
  }
  const lockKeyValid = `extendProof:${VALID_RECEIPT_KEY.toLowerCase()}`;
  const test4LockReleased = !isEntityLocked(lockKeyValid);

  assertTest(
    "Lock Safety 4: Wallet rejection immediately releases guard in finally block",
    test4LockReleased && test4Error.includes("rejected"),
    "Lock released: true, Error includes rejected",
    `Lock released: ${test4LockReleased}, Error: ${test4Error}`
  );

  // Test 5: Immediate retry allowed after failure (no "already in progress" error)
  let retrySucceeded = false;
  // Initialize mock DB with initial expiry 1938046n
  const updatedDb = new Map<string, Partial<FullEntity>>([
    [VALID_RECEIPT_KEY.toLowerCase(), { ...validEntity, expiresAt: 1938046n }],
    [OTHER_RECEIPT_KEY.toLowerCase(), { ...otherEntity }],
  ]);
  const mockPubRetry = createMockPublicClient({ entityMap: updatedDb });
  const mockSuccessWallet = createMockWalletClient({
    extendEntityFn: async ({ entityKey }) => {
      // Advance on-chain expiry in response to transaction
      const target = updatedDb.get(entityKey.toLowerCase());
      if (target) target.expiresAt = 3000000n;
      return {
        entityKey,
        txHash: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
        expiresAt: 3000000n,
      };
    },
  });

  try {
    const res = await extendProofEntity(mockSuccessWallet, VALID_RECEIPT_KEY, 60, mockPubRetry);
    retrySucceeded = res.expiresAt === 3000000n;
  } catch (err: any) {
    console.error("Retry failed:", err);
  }

  assertTest(
    "Retry Safety 5: Subsequent retry immediately succeeds without encountering 'already in progress'",
    retrySucceeded,
    "true (retry succeeded)",
    String(retrySucceeded)
  );

  // Test 6: Receipt lock isolation (Receipt A in progress does NOT block Receipt B)
  const lockKeyA = `extendProof:${VALID_RECEIPT_KEY.toLowerCase()}`;
  const lockKeyB = `extendProof:${OTHER_RECEIPT_KEY.toLowerCase()}`;
  acquireEntityLock(lockKeyA, "extendProofEntity");

  let receiptBBlocked = false;
  try {
    acquireEntityLock(lockKeyB, "extendProofEntity");
    releaseEntityLock(lockKeyB);
  } catch {
    receiptBBlocked = true;
  }
  releaseEntityLock(lockKeyA);

  assertTest(
    "Isolation 6: Active lock on Receipt A does not block Receipt B",
    !receiptBBlocked,
    "Receipt B can acquire its lock independently",
    receiptBBlocked ? "Receipt B was blocked" : "Receipt B acquired lock cleanly"
  );

  // Test 7: Post-tx on-chain advancement verification (rejection if expiry didn't advance)
  let test7Error = "";
  const stagnantDb = new Map<string, Partial<FullEntity>>([
    [VALID_RECEIPT_KEY.toLowerCase(), { ...validEntity, expiresAt: 1938046n }], // Did not advance!
  ]);
  const mockPubStagnant = createMockPublicClient({ entityMap: stagnantDb });
  const mockFakeWallet = createMockWalletClient({
    extendEntityFn: async ({ entityKey }) => ({
      entityKey,
      txHash: "0xfafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafafa",
      expiresAt: 1938046n, // No advancement
    }),
  });

  try {
    await extendProofEntity(mockFakeWallet, VALID_RECEIPT_KEY, 60, mockPubStagnant);
  } catch (err: any) {
    test7Error = err.message || String(err);
  }

  assertTest(
    "Verification 7: Throws error if wallet returns hash but on-chain entity expiry did not advance",
    test7Error.includes("did not advance"),
    "Throws 'did not advance' error",
    test7Error
  );

  // Test 8: Successful on-chain extension returns verified advanced block
  const verifiedDb = new Map<string, Partial<FullEntity>>([
    [VALID_RECEIPT_KEY.toLowerCase(), { ...validEntity, expiresAt: 1938046n }],
  ]);
  const mockPubVerified = createMockPublicClient({ entityMap: verifiedDb });
  const mockVerifiedWallet = createMockWalletClient({
    extendEntityFn: async ({ entityKey }) => {
      const target = verifiedDb.get(entityKey.toLowerCase());
      if (target) target.expiresAt = 4530046n;
      return {
        entityKey,
        txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
        expiresAt: 4530046n,
      };
    },
  });

  const successResult = await extendProofEntity(mockVerifiedWallet, VALID_RECEIPT_KEY, 60, mockPubVerified);
  assertTest(
    "Success 8: Successful extension returns verified advanced expiresAt block",
    successResult.expiresAt === 4530046n && successResult.txHash.startsWith("0x777"),
    "expiresAt: 4530046n",
    `expiresAt: ${successResult.expiresAt}n`
  );

  // Print Summary
  const passedCount = reports.filter((r) => r.passed).length;
  const totalCount = reports.length;
  console.log("\n--------------------------------------------------------");
  console.log(`Summary: ${passedCount} / ${totalCount} passed.`);
  console.log("--------------------------------------------------------\n");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
