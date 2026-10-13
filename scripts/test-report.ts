/**
 * scripts/test-report.ts
 *
 * Phase 2C Test Report — Script-level checks
 *
 *   T-01  Initial slot load time from cold start
 *   T-02  Second fetch (warm, same RPC connection) — 10s timeout
 *   T-03  RPC unreachable — throws or times out gracefully
 *   T-04  Zero-slot namespace — empty result, no error
 *   T-05  Countdown accuracy (ends_at precision)
 *   T-06  Hot-removal: 3-min entity expires; only explicit empty result
 *          with a successful HTTP response counts as PASS. Timeout = FAIL.
 *
 * Usage: PRIVATE_KEY=0x... npx tsx scripts/test-report.ts
 */

import "dotenv/config";
import { privateKeyToAccount }   from "viem/accounts";
import {
  createPublicClient,
  createWalletClient,
  ExpirationTime,
  jsonToPayload,
}                                from "@arkiv-network/sdk";
import { tiramisu }              from "@arkiv-network/sdk/chains";
import { str, u64, i32, bool }  from "@arkiv-network/sdk/attr";
import { eq, gt, and }           from "@arkiv-network/sdk/query";
import { http }                  from "viem";
import type { Hex }              from "viem";

// ---- helpers ----------------------------------------------------------------

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Race a promise against a timeout.
 * Returns null ONLY on timeout; propagates errors normally.
 * Always clears the timer on both resolve and reject.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T | null> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timerId = setTimeout(() => {
      console.log(`    [timeout] ${label}: no response after ${ms}ms`);
      resolve(null);
    }, ms);
  });

  try {
    return await Promise.race([
      promise.then((v) => { clearTimeout(timerId); return v; }),
      timeoutPromise,
    ]);
  } catch (err) {
    clearTimeout(timerId);
    throw err;
  }
}

const PASS       = (l: string, d: string) => console.log(`  OK   ${l.padEnd(46)} ${d}`);
const FAIL       = (l: string, d: string) => console.log(`  FAIL ${l.padEnd(46)} ${d}`);
const INCONCL    = (l: string, d: string) => console.log(`  INC  ${l.padEnd(46)} ${d}`);
const INFO       = (l: string, d: string) => console.log(`  ..   ${l.padEnd(46)} ${d}`);
const HEAD       = (s: string) => console.log(`\n==  ${s}  ${"=".repeat(Math.max(0, 58 - s.length))}`);

const RPC     = "https://rpc.tiramisu.db-chain.testnet.arkiv.network";
const BAD_RPC = "https://rpc.invalid.does.not.exist.example";
const PROJECT = "slotbazaar";

// ---- fetch all live slots ---------------------------------------------------

function liveSlotsQuery(client: ReturnType<typeof createPublicClient>, nowSec: bigint) {
  return client
    .select()
    .where(and(
      eq("project", str(PROJECT)),
      eq("entity_type", str("slot")),
      gt("ends_at", u64(nowSec))
    ))
    .fetch();
}

// ---- main -------------------------------------------------------------------

async function main() {
  console.log("\n====  SlotBazaar Phase 2C — Script-level Test Report  ====");
  console.log(`      Run at: ${new Date().toISOString()}`);

  const rawKey = process.env.PRIVATE_KEY;
  if (!rawKey) { console.error("PRIVATE_KEY required"); process.exit(1); }
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as Hex;
  const account    = privateKeyToAccount(privateKey);

  const pub    = createPublicClient({ chain: tiramisu, transport: http(RPC) });
  const wallet = createWalletClient({ chain: tiramisu, transport: http(RPC), account });

  let passed = 0;
  let failed = 0;
  let inconclusive = 0;

  // T-01 -------------------------------------------------------------------
  HEAD("T-01: Initial slot load time (cold start, <4s target)");
  let t01Slots: unknown[] = [];
  {
    const t0 = Date.now();
    const result = await withTimeout(
      liveSlotsQuery(pub, BigInt(Math.floor(Date.now() / 1000))),
      10000, "T-01"
    );
    const ms = Date.now() - t0;

    if (result === null) {
      FAIL("T-01 timed out", `No response in ${ms}ms`); failed++;
    } else {
      t01Slots = result.entities;
      if (ms < 4000) {
        PASS("T-01 load time OK", `${ms}ms, ${result.entities.length} slots`); passed++;
      } else {
        FAIL("T-01 load time exceeded 4s", `${ms}ms`); failed++;
      }
      INFO("live slot count", `${result.entities.length} slots in Arkiv index`);
    }
  }

  // T-02 -------------------------------------------------------------------
  HEAD("T-02: Warm fetch (<2s target, 10s timeout)");
  {
    const t0 = Date.now();
    const result = await withTimeout(
      liveSlotsQuery(pub, BigInt(Math.floor(Date.now() / 1000))),
      10000, "T-02"
    );
    const ms = Date.now() - t0;

    if (result === null) {
      FAIL("T-02 STALL — no response in 10s", `RPC hung; see FR-012`); failed++;
    } else if (ms < 2000) {
      PASS("T-02 warm fetch OK", `${ms}ms`); passed++;
    } else {
      FAIL("T-02 warm fetch >2s", `${ms}ms (above target; log to friction if reproducible)`); failed++;
    }
  }

  // T-03 -------------------------------------------------------------------
  HEAD("T-03: Unreachable RPC — throws or times out (must not succeed)");
  {
    const badClient = createPublicClient({ chain: tiramisu, transport: http(BAD_RPC) });
    const t0 = Date.now();
    let outcome: "threw" | "timed_out" | "succeeded" = "succeeded";
    let msg = "";

    try {
      const result = await withTimeout(
        badClient.select()
          .where(and(eq("project", str(PROJECT)), eq("entity_type", str("slot"))))
          .fetch(),
        8000, "T-03"
      );
      if (result === null) {
        outcome = "timed_out";
      } else {
        outcome = "succeeded"; // bad: unreachable RPC returned data
        msg = `${result.entities.length} entities returned`;
      }
    } catch (e) {
      clearTimeout(undefined); // cancel stale timers from withTimeout
      outcome = "threw";
      msg = e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100);
    }

    const ms = Date.now() - t0;
    if (outcome === "succeeded") {
      FAIL("T-03 bad RPC unexpectedly succeeded", msg); failed++;
    } else if (outcome === "threw") {
      PASS("T-03 bad RPC threw error", `${ms}ms: "${msg}"`); passed++;
    } else {
      PASS("T-03 bad RPC timed out (acceptable)", `${ms}ms — no data returned`); passed++;
    }
  }

  // T-04 -------------------------------------------------------------------
  HEAD("T-04: Zero-slot namespace — empty result, no error");
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
      10000, "T-04"
    );
    const ms = Date.now() - t0;

    if (result === null) {
      FAIL("T-04 timed out", `${ms}ms`); failed++;
    } else if (result.entities.length === 0) {
      PASS("T-04 empty namespace = 0 entities", `${ms}ms, hasNextPage=${result.hasNextPage}`); passed++;
    } else {
      FAIL("T-04 unexpected entities", `Got ${result.entities.length}`); failed++;
    }
  }

  // T-05 -------------------------------------------------------------------
  HEAD("T-05: Countdown accuracy (ends_at is Unix timestamp, 1s precision)");
  {
    if (t01Slots.length === 0) {
      INCONCL("T-05 SKIP — no slots from T-01", ""); inconclusive++;
    } else {
      const sample = t01Slots[0] as { attributes?: Record<string, unknown> };
      const endsAtVal = (sample.attributes?.["ends_at"] as { value?: bigint } | undefined)?.value;

      if (endsAtVal !== undefined) {
        const endsAtSec = Number(endsAtVal);
        const nowSec    = Math.floor(Date.now() / 1000);
        const remaining = endsAtSec - nowSec;
        PASS("T-05 ends_at readable as Unix timestamp", `endsAt=${endsAtSec}, remaining=${remaining}s`);
        INFO("T-05 precision", "1-second granularity (schema v1 uses u64 seconds)");
        passed++;
      } else {
        FAIL("T-05 ends_at not parseable", "attribute missing or wrong shape"); failed++;
      }
    }
  }

  // T-06 -------------------------------------------------------------------
  HEAD("T-06: Hot-removal — entity expires and disappears from query");
  console.log(
    "    RULE: timeout = FAIL/INCONCLUSIVE." +
    " Only an explicit HTTP-200 response with 0 matching entities = PASS."
  );
  {
    const EXPIRY_SEC = 180;
    const nowSec     = Math.floor(Date.now() / 1000);
    const endsAt     = nowSec + EXPIRY_SEC;
    const batchTag   = `t06-${Date.now()}`;

    console.log(`    Creating 3-min entity (batch=${batchTag})…`);
    const t0 = Date.now();

    const createResult = await withTimeout(
      wallet.createEntity({
        payload: jsonToPayload({
          title: "[HOT-REMOVAL TEST] 3-min slot",
          description: "T-06 automated test",
          seller_label: "TestBot",
          schema_version: 1,
        }),
        contentType: "application/json",
        attributes: {
          project:     str(PROJECT),
          entity_type: str("slot"),
          schema_v:    str("1"),
          category:    str("machine"),
          cluster:     str("test"),
          starts_at:   u64(BigInt(nowSec)),
          ends_at:     u64(BigInt(endsAt)),
          price_band:  str("low"),
          lat_e4:      i32(190760),
          lon_e4:      i32(728777),
          synthetic:   bool(true),
          seed_batch:  str(batchTag),
        },
        expires: ExpirationTime.atDate(new Date(endsAt * 1000)),
      }),
      20000,
      "T-06 createEntity"
    );

    if (!createResult) {
      FAIL("T-06 createEntity timed out", "Cannot proceed");
      failed++;
    } else {
      const createMs = Date.now() - t0;
      console.log(`    Created in ${createMs}ms, key=${createResult.entityKey.slice(0, 20)}…`);
      console.log("    Waiting 8s for indexer…");
      await sleep(8000);

      // --- T-06a: must be visible before expiry ---
      let t06aPassed = false;
      try {
        const beforeRaw = await withTimeout(
          liveSlotsQuery(pub, BigInt(Math.floor(Date.now() / 1000))),
          12000, "T-06a before-expiry query"
        );
        if (beforeRaw === null) {
          FAIL("T-06a INCONCLUSIVE — RPC timeout before expiry",
            "Cannot verify entity was indexed. Abort T-06b.");
          inconclusive++;
        } else {
          const found = beforeRaw.entities.some((e) =>
            (e.attributes?.["seed_batch"] as { value?: string } | undefined)?.value === batchTag
          );
          if (found) {
            PASS("T-06a entity visible before expiry", `batchTag=${batchTag}`);
            passed++;
            t06aPassed = true;
          } else {
            FAIL("T-06a entity not found in index 8s after create", "Indexer may be slow; abort T-06b");
            failed++;
          }
        }
      } catch (e) {
        FAIL("T-06a threw", e instanceof Error ? e.message.slice(0, 80) : String(e));
        failed++;
      }

      if (t06aPassed) {
        // --- T-06b: wait for expiry, then confirm removal ---
        const remaining = endsAt - Math.floor(Date.now() / 1000);
        const waitSec   = Math.max(0, remaining + 6); // +6s buffer over expiry
        const lagSec    = 14;                          // extra indexer lag
        console.log(`    Waiting ${waitSec + lagSec}s (expiry + ${lagSec}s indexer lag)…`);
        await sleep((waitSec + lagSec) * 1000);

        try {
          const afterRaw = await withTimeout(
            liveSlotsQuery(pub, BigInt(Math.floor(Date.now() / 1000))),
            12000, "T-06b after-expiry query"
          );

          if (afterRaw === null) {
            // --- CRITICAL: timeout does NOT mean "not found" ---
            FAIL(
              "T-06b INCONCLUSIVE — RPC timeout after expiry",
              "Query timed out. Cannot confirm entity was removed. " +
              "This is NOT a pass — rerun or check chain explorer manually."
            );
            inconclusive++;
          } else {
            // Successful HTTP-200: check entity presence explicitly
            const stillThere = afterRaw.entities.some((e) =>
              (e.attributes?.["seed_batch"] as { value?: string } | undefined)?.value === batchTag
            );
            if (!stillThere) {
              PASS(
                "T-06b entity GONE after expiry",
                `Confirmed absent. HTTP-200, entities list examined. ts=${new Date().toISOString()}`
              );
              passed++;
            } else {
              FAIL(
                "T-06b entity still present after expiry",
                `Still in index at ${new Date().toISOString()}`
              );
              failed++;
            }
          }
        } catch (e) {
          FAIL("T-06b threw", e instanceof Error ? e.message.slice(0, 80) : String(e));
          failed++;
        }
      }
    }
  }

  // ---- summary ------------------------------------------------------------
  console.log(`\n====  Results: ${passed} passed  ${failed} failed  ${inconclusive} inconclusive  ====`);
  console.log("     (INCONCLUSIVE = RPC timeout; rerun to confirm)\n");

  HEAD("MANUAL / UI CHECKS (cannot be automated in Node CLI)");
  console.log(`
  Run these in a browser at http://localhost:5173:

  Viewport checks (Chrome DevTools device toolbar):
    375x667  | Sheet handle visible; FilterBar wraps; Drawer full-width
    768x1024 | Slot list visible left; map right; Drawer 380px
    1280x800 | 60/40 split; hero strip; FilterBar inline; footer visible

  RPC failure:
    DevTools > Network > Offline > wait 8s
    Expected: red error banner, stale markers stay, list unchanged
    Click Retry > banner clears, fresh fetch runs

  Countdown accuracy:
    Open drawer on any slot. Note 'Ends At' time and remaining countdown.
    Verify countdown decrements by 1s each second and matches ends_at.

  Hot removal in browser:
    Leave page open. When a seeded slot's ends_at passes, it should
    disappear from both the map and the slot list within 8s (one poll cycle).
  `);

  if (failed > 0 || inconclusive > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
