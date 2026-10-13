/**
 * scripts/test-report.ts
 *
 * Phase 2B Test Report
 *
 * Automated checks:
 *   T-01  Initial slot load time from cold start
 *   T-02  Second fetch (warm, same RPC connection) — with 10s timeout
 *   T-03  RPC unreachable behaviour (bad URL) — with 8s timeout
 *   T-04  Zero-slot namespace — empty result
 *   T-05  Countdown accuracy (ends_at precision)
 *   T-06  Hot-removal: 3-min entity expires and disappears
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/test-report.ts
 */

import "dotenv/config";
import { privateKeyToAccount }                from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
}                                              from "@arkiv-network/sdk";
import { tiramisu }                            from "@arkiv-network/sdk/chains";
import { str, u64, i32, bool }                from "@arkiv-network/sdk/attr";
import { eq, gt, and }                         from "@arkiv-network/sdk/query";
import { http }                                from "viem";
import type { Hex }                            from "viem";

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** Race a promise against a timeout. Resolves to null on timeout. */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`    ⏱  ${label}: timed out after ${ms}ms`);
      resolve(null);
    }, ms);
  });
  const result = await Promise.race([
    promise.then((v) => { clearTimeout(timeoutId); return v; }),
    timeout,
  ]);
  return result;
}

const PASS = (label: string, detail: string) =>
  console.log(`  ✅  ${label.padEnd(44)} ${detail}`);
const FAIL = (label: string, detail: string) =>
  console.log(`  ❌  ${label.padEnd(44)} ${detail}`);
const INFO = (label: string, detail: string) =>
  console.log(`  ℹ   ${label.padEnd(44)} ${detail}`);
const HEAD = (s: string) => console.log(`\n── ${s} ${"─".repeat(Math.max(0, 60 - s.length))}`);

const RPC     = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
const BAD_RPC = "https://rpc.invalid.does.not.exist.example";
const PROJECT = "slotbazaar";

// ─── fetch helper ─────────────────────────────────────────────────────────────

function buildFetch(client: ReturnType<typeof createPublicClient>, nowSec: bigint) {
  return client
    .select()
    .where(and(
      eq("project", str(PROJECT)),
      eq("entity_type", str("slot")),
      gt("ends_at", u64(nowSec))
    ))
    .fetch();
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║  SlotBazaar Phase 2B — Automated Test Report                   ║");
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);
  console.log(`  Run at: ${new Date().toISOString()}`);

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) { console.error("\n❌  PRIVATE_KEY required"); process.exit(1); }
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account    = privateKeyToAccount(privateKey);

  const pub    = createPublicClient({ chain: tiramisu, transport: http(RPC) });
  const wallet = createWalletClient({ chain: tiramisu, transport: http(RPC), account });

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // ── T-01 ──────────────────────────────────────────────────────────────────
  HEAD("T-01 · Initial slot load time (cold start)");
  let t01Slots: unknown[] = [];
  {
    const t0 = Date.now();
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const result = await withTimeout(buildFetch(pub, nowSec), 10000, "T-01");
    const ms = Date.now() - t0;

    if (result === null) {
      FAIL("T-01 timed out", `No response after ${ms}ms`); failed++;
    } else if (ms < 4000) {
      t01Slots = result.entities;
      PASS("T-01 load time < 4 s", `${ms}ms (${result.entities.length} slots)`); passed++;
      INFO("Slot count", `${result.entities.length} live slots in Arkiv index`);
    } else {
      t01Slots = result.entities;
      FAIL("T-01 load time < 4 s", `${ms}ms exceeds 4 s target`); failed++;
    }
  }

  // ── T-02 ──────────────────────────────────────────────────────────────────
  HEAD("T-02 · Second fetch (warm, same client) — 10 s timeout");
  {
    const t0 = Date.now();
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const result = await withTimeout(buildFetch(pub, nowSec), 10000, "T-02");
    const ms = Date.now() - t0;

    if (result === null) {
      FAIL("T-02 timed out (RPC stall on repeat)", `No response after ${ms}ms`);
      INFO("T-02 Note", "Tiramisu RPC sometimes stalls on back-to-back calls — see FR-012 below");
      failed++;
    } else if (ms < 2000) {
      PASS("T-02 warm fetch < 2 s", `${ms}ms (${result.entities.length} slots)`); passed++;
    } else if (ms < 10000) {
      PASS("T-02 warm fetch < 10 s", `${ms}ms (slower than ideal, no timeout)`);
      INFO("T-02 Note", `${ms}ms warm fetch — consider adding to friction log`);
      passed++;
    } else {
      FAIL("T-02 timed out", `${ms}ms`); failed++;
    }
  }

  // ── T-03 ──────────────────────────────────────────────────────────────────
  HEAD("T-03 · Unreachable RPC — throws or times out gracefully");
  {
    const badClient = createPublicClient({ chain: tiramisu, transport: http(BAD_RPC) });
    const t0 = Date.now();
    const result = await withTimeout(
      badClient.select()
        .where(and(eq("project", str(PROJECT)), eq("entity_type", str("slot"))))
        .fetch()
        .catch((err) => { throw err; }),
      8000,
      "T-03"
    ).catch((err) => {
      return { __err: err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100) };
    });
    const ms = Date.now() - t0;

    if (result === null) {
      // Timed out — acceptable, means RPC is unreachable and we surfaced the timeout
      PASS("T-03 unreachable RPC timed out", `Timed out after ${ms}ms — caller receives null/error`);
      passed++;
    } else if (result && typeof result === "object" && "__err" in result) {
      PASS("T-03 unreachable RPC threw", `Error in ${ms}ms: "${result.__err}"`);
      passed++;
    } else {
      FAIL("T-03 unreachable RPC succeeded", "Unexpected success from bad URL — network may be routing to a valid host");
      failed++;
    }
  }

  // ── T-04 ──────────────────────────────────────────────────────────────────
  HEAD("T-04 · Zero-slot namespace — empty result, no error");
  {
    const t0 = Date.now();
    const result = await withTimeout(
      pub.select()
        .where(and(
          eq("project", str("slotbazaar-nonexistent-xyz-999")),
          eq("entity_type", str("slot")),
          gt("ends_at", u64(BigInt(Math.floor(Date.now() / 1000))))
        ))
        .fetch(),
      10000,
      "T-04"
    );
    const ms = Date.now() - t0;

    if (result === null) {
      FAIL("T-04 timed out", `No response after ${ms}ms`); failed++;
    } else if (result.entities.length === 0) {
      PASS("T-04 empty namespace → 0 entities", `entities=0, hasNextPage=${result.hasNextPage} in ${ms}ms`);
      passed++;
    } else {
      FAIL("T-04 unexpected entities found", `Got ${result.entities.length} — unexpected`); failed++;
    }
  }

  // ── T-05 ──────────────────────────────────────────────────────────────────
  HEAD("T-05 · Countdown accuracy (ends_at is Unix timestamp)");
  {
    if (t01Slots.length === 0) {
      INFO("T-05 SKIP", "No slots available from T-01"); skipped++;
    } else {
      const slots = t01Slots as Array<{ attributes?: Record<string, unknown> }>;
      const sample = slots[0];
      const endsAtVal = (sample.attributes?.["ends_at"] as { value?: bigint } | undefined)?.value;

      if (endsAtVal !== undefined) {
        const endsAtSec = Number(endsAtVal);
        const nowLocal  = Math.floor(Date.now() / 1000);
        const remaining = endsAtSec - nowLocal;
        PASS("T-05 ends_at is readable Unix timestamp", `endsAt=${endsAtSec}, remaining=${remaining}s`);
        INFO("T-05 precision", "1-second — no sub-second data in schema v1");
        passed++;
      } else {
        FAIL("T-05 ends_at not parseable", "Could not read ends_at from entity attributes"); failed++;
      }
    }
  }

  // ── T-06 ──────────────────────────────────────────────────────────────────
  HEAD("T-06 · Hot-removal — 3-min slot expires and leaves index");
  {
    const EXPIRY_SEC     = 180;
    const nowSec         = Math.floor(Date.now() / 1000);
    const endsAt         = nowSec + EXPIRY_SEC;
    const batchTag       = `t06-${Date.now()}`;

    console.log(`    Creating 3-min test slot (batch=${batchTag})…`);
    const t0 = Date.now();
    const createResult = await withTimeout(
      wallet.createEntity({
        payload: jsonToPayload({
          title: "[HOT-REMOVAL TEST] 3-min slot",
          description: "T-06 automated test — will expire in 3 minutes",
          seller_label: "TestBot",
          schema_version: 1,
        }),
        contentType: "application/json",
        attributes: {
          project:      str(PROJECT),
          entity_type:  str("slot"),
          schema_v:     str("1"),
          category:     str("machine"),
          cluster:      str("test"),
          starts_at:    u64(BigInt(nowSec)),
          ends_at:      u64(BigInt(endsAt)),
          price_band:   str("low"),
          lat_e4:       i32(190760),
          lon_e4:       i32(728777),
          synthetic:    bool(true),
          seed_batch:   str(batchTag),
        },
        expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
      }),
      20000,
      "T-06 createEntity"
    );

    if (!createResult) {
      FAIL("T-06 createEntity timed out", "Cannot proceed with hot-removal test"); failed++;
    } else {
      const createMs = Date.now() - t0;
      console.log(`    Created in ${createMs}ms — waiting 6s for indexer…`);
      await sleep(6000);

      // Verify visible before expiry
      const beforeQ = BigInt(Math.floor(Date.now() / 1000));
      const before = await withTimeout(buildFetch(pub, beforeQ), 10000, "T-06a query-before");
      const visibleBefore = before?.entities.some((e) => {
        const sb = (e.attributes?.["seed_batch"] as { value?: string })?.value;
        return sb === batchTag;
      }) ?? false;

      if (visibleBefore) {
        PASS("T-06a visible before expiry", `key: ${createResult.entityKey.slice(0, 18)}…`);
        passed++;
      } else {
        FAIL("T-06a not visible before expiry", "Entity not found in index 6s after create"); failed++;
      }

      // Wait for expiry + 1 poll cycle (8s app interval + 2s buffer)
      const waitMs = Math.max(0, (endsAt - Math.floor(Date.now() / 1000) + 2) * 1000);
      console.log(`    Waiting ${Math.round(waitMs / 1000)}s until expiry + 2s…`);
      await sleep(waitMs + 10000); // +10s extra for indexer lag

      const afterQ = BigInt(Math.floor(Date.now() / 1000));
      const after = await withTimeout(buildFetch(pub, afterQ), 10000, "T-06b query-after");
      const visibleAfter = after?.entities.some((e) => {
        const sb = (e.attributes?.["seed_batch"] as { value?: string })?.value;
        return sb === batchTag;
      }) ?? false;

      if (!visibleAfter) {
        PASS("T-06b gone after expiry", `Removed from index at ${new Date().toISOString()}`);
        passed++;
      } else {
        FAIL("T-06b still visible after expiry", "Entity persists in query — unexpected"); failed++;
      }
    }
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════════════╗");
  console.log(`║  Results: ${String(passed).padStart(2)} passed  ${String(failed).padStart(2)} failed  ${String(skipped).padStart(2)} skipped              ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

  HEAD("MANUAL CHECKS — Responsiveness");
  console.log(`
  Viewport | What to verify (open http://localhost:5173 in DevTools)
  ─────────┼────────────────────────────────────────────────────────
  375×667  │ Mobile sheet handle visible; FilterBar wraps; Drawer full-width
  768×1024 │ Mobile sheet hidden; map fills height; Drawer = 380px
  1280×800 │ Hero strip + footer visible; FilterBar inline; nudge positioned
  `);

  console.log("  RPC failure (manual):");
  console.log("    1. Open DevTools → Network → Offline");
  console.log("    2. Wait 8 s (one poll cycle)");
  console.log("    3. Confirm: red error banner appears, stale markers remain on map");
  console.log("    4. Go back online, click Retry → banner disappears, fresh slots load\n");

  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
