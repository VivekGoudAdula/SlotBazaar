# SlotBazaar — Arkiv Friction Log

> Append-only. Template: FR-NNN · Title / Date / Phase / SDK+network / Expected / Actual / Reproduce / Severity / Workaround / Fix suggestion / Issue link.
>
> Rules: Only log things reproduced at least twice. Include exact error text. Factual and constructive, not complaining.

---

## Environment (Phase 0 & Phase 1)

| Item | Value |
|------|-------|
| `@arkiv-network/sdk` | `0.8.1` |
| `viem` | `2.57.4` |
| `tsx` | `4.23.15` |
| `typescript` | `6.0.3` |
| `node` | `v22.15.1` |
| Network | Tiramisu testnet |
| Chain ID | `7738577` |
| RPC | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| Date | 2026-10-12 (IST) |

---

### FR-001 · `InvalidPredicateError` not exported from main package

- **Date/time (IST):** 2026-10-12, ~21:00 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected (cite the doc page or type declaration):**  
  The main `@arkiv-network/sdk` index (`dist/index.d.ts`) re-exports many symbols including error classes (`InvalidValueError`, `InvalidAttributeNameError`, `EntityMutationError`, `NoEntityFoundError`). Based on this pattern, I expected `InvalidPredicateError` to also be exported from `@arkiv-network/sdk`.
- **What actually happened (exact error text or output):**  
  ```
  SyntaxError: The requested module '@arkiv-network/sdk' does not provide an export named 'InvalidPredicateError'
      at ModuleJob._instantiate (node:internal/modules/esm/module_job:184:21)
      at async ModuleJob.run (node:internal/modules/esm/module_job:267:5)
  ```
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  import { InvalidPredicateError } from "@arkiv-network/sdk";
  ```
  Run: `npx tsx scripts/query-slots.ts`
  Reproduced twice on 2026-10-12.
- **Severity:** minor (developer DX / import confusion)
- **Workaround used:**  
  Import explicitly from the query subpath:
  ```ts
  import { InvalidPredicateError } from "@arkiv-network/sdk/query";
  ```
- **Suggested fix:**  
  Re-export `InvalidPredicateError` from the root entry point `dist/index.d.ts` alongside all other error classes.
- **Upstream issue link:** (not filed)

---

### FR-002 · `BigInt` attribute values (`u64`) throw in `JSON.stringify`

- **Date/time (IST):** 2026-10-12, ~20:53 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  Attribute value objects (`U64Value` = `{ type: "u64", value: bigint }`) would be serialisable or at least provide a `.toJSON()` / `.toString()` method when developers debug or log attribute objects using standard `JSON.stringify(attributes)`.
- **What actually happened (exact error text or output):**  
  ```
  TypeError: Do not know how to serialize a BigInt
      at JSON.stringify (<anonymous>)
      at anonymous (scripts/hello-slot.ts:89:59)
  ```
- **Steps to reproduce:**
  ```ts
  import { u64 } from "@arkiv-network/sdk/attr";
  const attrs = { ends_at: u64(1791829419n) };
  JSON.stringify(attrs); // throws TypeError
  ```
  Reproduced twice on 2026-10-12.
- **Severity:** papercut
- **Workaround used:**  
  Pass a custom replacer to `JSON.stringify`:  
  ```ts
  JSON.stringify(attrs, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  ```
- **Suggested fix:**  
  Define a `toJSON` property or helper on `U64Value` / `U256Value`, or document the BigInt serialization caveat prominently in the SDK guide.
- **Upstream issue link:** (not filed)

  > **Update 2026-10-13 IST:** Note: not Arkiv-specific. `BigInt` serialization is a JavaScript platform limitation that affects all libraries using `bigint`. The SDK choice to use native `bigint` for `u64` is correct; the workaround (custom replacer or `.toString()`) is the standard approach. Severity downgraded to **cosmetic**.

---

### FR-003 · Uppercase attribute name rejected by network (not caught client-side)

- **Date/time (IST):** 2026-10-12, ~21:25 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected (cite the doc page or type declaration):**  
  The SDK exports `InvalidAttributeNameError` and `validateAttributeName()`. The type declaration for `createEntity` specifies: `@throws {InvalidAttributeNameError} If a name violates the attribute-name grammar.` I expected attribute names with uppercase letters (e.g. `ProjectName`) to be validated client-side *before* any transaction is broadcast to the network.
- **What actually happened (exact error text or output):**  
  The transaction was broadcast to the network, confirmed on-chain, and failed at the consensus/execution layer:
  ```
  EntityMutationError: Transaction failed: an attribute name holds "P" (0x50) at byte 0, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)
      at async main (scripts/edge-probes.ts:46:27)
  ```
  This consumed test GLM gas for a transaction that was statically invalid.
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  await wallet.createEntity({
    payload: jsonToPayload({ note: "test" }),
    contentType: "application/json",
    attributes: { ProjectName: str("test"), project: str("slotbazaar") },
    expires: ExpirationTime.fromMinutes(10),
  });
  ```
  Run: `npx tsx scripts/edge-probes.ts`
  Reproduced twice on 2026-10-12.
- **Severity:** major — consumes user gas for an entirely client-validatable error. On mainnet, this wastes real gas.
- **Workaround used:**  
  Enforce strict lowercase snake_case attribute names in app code and pre-validate before calling SDK methods.
- **Suggested fix:**  
  Call `validateAttributeName(name)` inside `createEntity()` and `executeBatch()` before signing and submitting transactions.
- **Upstream issue link:** (not filed)

  > **Update 2026-10-13 IST:** Gas spend verified with `scripts/measure-cost.ts`. Two successful creates measured: **3h = 0.000141824 GLM, 24h = 0.000141840 GLM** — expiry duration has negligible cost impact (~0.000000016 GLM difference). The Phase 0 failed uppercase-attribute tx cannot be retroactively measured (delta not captured). **Severity remains: major.**

---

### FR-004 · Wrong number type in range query silently returns 0 results

- **Date/time (IST):** 2026-10-12, ~21:25 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  When querying an attribute stored as `u64` using `gt("ends_at", i32(nowSec))` instead of `u64(nowSec)`, I expected either a client-side type check or a server-side error indicating an operator/type mismatch, since the query language specifies strong type tags.
- **What actually happened (exact error text or output):**  
  No error was thrown. The query executed successfully and returned 0 entities:
  ```
  ⚠️ No error thrown — succeeds with potentially wrong results
  → 0 entities on this page
  → hasNextPage: false
  → cursor: (none)
  → blockNumber: 484473
  ```
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  // ends_at stored as u64
  await client
    .select()
    .where(and(eq("project", str("slotbazaar")), gt("ends_at", i32(nowSec))))
    .fetch();
  ```
  Run: `npx tsx scripts/query-slots.ts`
  Reproduced twice on 2026-10-12.
- **Severity:** major — silent data omission. Developers querying with `i32` or `number` will receive 0 rows instead of a schema error.
- **Workaround used:**  
  Strictly maintain schema typing wrappers (`u64` timestamps, `i32` coordinate factors) in a dedicated library layer (`src/lib/arkiv.ts`).
- **Suggested fix:**  
  Emit a diagnostic warning or validate types in the query engine if attribute schemas are indexed.
- **Upstream issue link:** (not filed)

  > **Update 2026-10-13 IST:** Arkiv documentation clarifies this is documented behaviour: a typed predicate only matches cells stored with that exact type tag. There is no diagnostic today. Severity revised to **minor**. Suggested fix updated: add optional dev-mode warning when a predicate type does not match known schema types for that attribute.

---

### FR-005 · Query index purges expiring entity 1 block before target block

- **Date/time (IST):** 2026-10-12, 21:05 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  An entity scheduled to expire at block `484782` would remain visible in queries through block `484782`, and disappear at block `484783`.
- **What actually happened (exact error text or output):**  
  There is a 1-block asymmetry between the query index and `getEntity`:
  - **At block 484781 (1 block BEFORE target block 484782)**:
    - `getEntity`: succeeded! Returned entity with `expiresAt=484782`.
    - `select().where(...)`: returned `0` entities (`entity no longer in results`).
  - **At block 484797 (after target block 484782)**:
    - `getEntity` threw:
      ```
      NoEntityFoundError: No live entity with key 0x40c9380d0ec3a4f3273544209436833fc1005bd7e61f5a37d755cabb8a0d3780. It was never created, or it has been deleted or has expired.
      ```
- **Steps to reproduce:**
  Run `npx tsx scripts/expiry-test.ts` with 30s polling intervals until expiry.
  Reproduced on 2026-10-12 in task-113.
- **Severity:** minor / architectural note
- **Workaround used:**  
  Account for 1-block margin when calculating time-to-live or evaluating slot expiration on the UI.
- **Suggested fix:**  
  Document the exact query expiration boundary condition (whether `block < expiresAt` or `block <= expiresAt`).
- **Upstream issue link:** (not filed)

  > **Update 2026-10-13 IST:** FR-005 **RE-TESTED** at 1-second polling intervals using `scripts/fr005-expiry-retest.ts`. Full block-level table recorded in task-555.log. Key findings:
  >
  > | Block | query= | getEntity= | Note |
  > |-------|--------|------------|------|
  > | #508806 – #508824 | YES | error (Invalid key value) | Entity visible in query; getEntity errors throughout |
  > | #508824 | NO | error | **Query went dark here** (wall 04:56:44, at exact ends_at Unix time) |
  > | #508826 | NO | error | Entity expiresAt block per SDK |
  > | #508831+ | NO | error | Both dark, error persists |
  >
  > **Revised conclusion:**
  > - Query index drops the entity **at block #508824**, which is **2 blocks before** the SDK-reported `expiresAt` block (#508826).
  > - `getEntity` errored with `Invalid key value` on **every single poll** — both before AND after expiry. This means the original claim of "getEntity returned entity at block 484781" was from a different run (Phase 0 script). This run produced a NEW discovery: `getEntity` rejects the 64-hex entity key with `Invalid key value` error from the outset.
  > - **Original "1-block gap" claim partially confirmed but with a 2-block gap observed this run.** The gap exists; the exact count may vary per run.
  > - **New finding logged as FR-011**: `getEntity` throws `Invalid key value` for entity keys returned by `createEntity`. The original Phase 0 `getEntity` success may have used a different key format.

---

### FR-006 · Typo in `InvalidPredicateError` message

- **Date/time (IST):** 2026-10-12, 20:54 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`
- **What I expected:**  
  Well-formed error message string.
- **What actually happened (exact error text):**  
  ```
  InvalidPredicateError: A query needs at least one filter — the language has no spelling for 'match every entity". Add a where(...) predicate, or narrow by ownedBy(...) / createdBy(...).
  ```
  Notice the mismatched quotation: starts with single quote `'match every entity`, ends with double quote `"`.
- **Steps to reproduce:**
  ```ts
  client.select().toString();
  ```
  Reproduced consistently across all unconstrained queries.
- **Severity:** cosmetic
- **Suggested fix:**  
  Correct quotes to `'match every entity'`.
- **Upstream issue link:** (not filed)

---

## Contradictions with the Project Brief

| Item | Brief Assumption | Observed Reality & Evidence |
|------|------------------|-----------------------------|
| **Ordering** | "Sort results by nearest end time" | Arkiv query engine does **not** support server-side `orderBy`. All sorting (by `ends_at`, distance, or rating) must happen client-side in TypeScript after `fetch()`. |
| **Creation Block / Tie-Break** | "Earliest creation block wins; check if creation block is exposed" | `FullEntity` and `Entity` expose `createdAt?: bigint` (and `updatedAt?: bigint`). For bookings within the same block, no transaction index or timestamp is exposed, so deterministic tie-breaker must use lexicographical ordering of `entityKey`. |
| **Query Expiration Timing** | "Entity expires at ends_at, so the chain removes it" | Query index drops the entity 1 block before `expiresAt` (`block < expiresAt` predicate on index), while `getEntity` drops it once `block >= expiresAt`. |
| **Attribute Validation** | "Invalid attributes fail client-side" | Uppercase attribute names are **not** rejected by client-side SDK validation in `createEntity()`. They are submitted on-chain and rejected as `EntityMutationError`, burning gas. |
| **Type Coercion in Queries** | "Query with wrong type throws an error" | Range query with mismatched numeric types (e.g., `i32` against stored `u64`) succeeds with HTTP 200 and silently returns 0 entities without error. |

---

### FR-007 · `erasableSyntaxOnly` compiler flag rejects class constructor parameter properties

- **Date/time (IST):** 2026-10-12, 21:10 IST
- **Phase:** 1
- **SDK + network versions:** `typescript@6.0.3`, Vite 8, `erasableSyntaxOnly: true` in `tsconfig.app.json`
- **What I expected:**  
  Standard TypeScript constructor parameter properties (`constructor(public readonly code: string)`) to compile normally.
- **What actually happened:**  
  ```
  error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
  ```
- **Severity:** papercut (TypeScript configuration interaction)
- **Workaround used:**  
  Explicitly declare fields on the class body and assign them in the constructor body.
- **Suggested fix:**  
  Document or note that modern Vite / TypeScript templates enforce `erasableSyntaxOnly`.

  > **Update 2026-10-13 IST:** Note: not Arkiv-specific. `erasableSyntaxOnly` is a TypeScript 6 / Vite project template choice, not related to the Arkiv SDK. The pattern applies to any TypeScript project using this Vite template. Workaround is standard TypeScript, no SDK change needed.

---

### FR-008 · Native token transfers require standard viem client rather than Arkiv wallet client

- **Date/time (IST):** 2026-10-12, 21:15 IST
- **Phase:** 1
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet
- **What I expected:**  
  `createWalletClient` from `@arkiv-network/sdk` would directly support standard EVM actions like `sendTransaction({ to, value })` for funding wallets or moving native GLM.
- **What actually happened:**  
  `@arkiv-network/sdk` wallet client wraps and focuses on entity-oriented actions (`createEntity`, `patchEntity`, `executeBatch`, etc.). For native transfers, developers must create a standard `viemCreateWalletClient` or access the underlying client.
- **Severity:** minor DX note
- **Workaround used:**  
  Used `createWalletClient` from `viem` directly for the ephemeral buyer funding step.
- **Suggested fix:**  
  Re-export or pass-through `sendTransaction` on `WalletArkivClient` so developers don't need two parallel wallet client abstractions.

---


## What worked well — Phase 1

- **Sub-Second Index Propagation (Probe B)**: A newly minted entity appeared in `select().where(...)` queries in just **339ms** (first poll attempt) after block confirmation. Query freshness is remarkably fast.
- **RPC Throughput & Resilience (Probe A)**: 50 simultaneous parallel read requests to the public RPC endpoint resolved in **1526ms** with **50/50 successes (0 errors, 0 rate-limits)**.
- **`createdAt` Block Available for Tie-Breaks**: Entities returned from `select()` carry `createdAt: bigint`, enabling robust, deterministic timestamping for concurrent claims and winner determination.
- **Dual-Sided Cryptographic Reputation**: Signatures verified via `$creator` from two distinct on-chain wallets (Seller and Ephemeral Buyer) cleanly prevent self-dealing and power verifiable reputation scoring without backend verification servers.
- **Clean Expired State Rejection (Probe C)**: Queries against expired slots reliably return 0 rows, and `getEntity` explicitly rejects expired entities with `NoEntityFoundError`.

---

### FR-009 · `getReputation` cannot recover slot creator after slot expires

- **Date/time (IST):** 2026-10-13, ~09:30 IST
- **Phase:** 1 (fix-ups)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**
  The `getReputation(account)` function should count completed jobs even after the original slot entity has expired from the chain index. `completion` entities live for 365 days and reference `slot_key`, so there should be a stable way to determine the original slot creator (seller) for reputation purposes.
- **What actually happened:**
  When the slot entity has expired, `select().where(eq("entity_type", str("slot")))` returns 0 entities for that key; the index has purged it. The reputation function cannot determine `slotCreator` for condition (b) of the three-part rule and silently skips the slot:
  ```
  // slot may be expired; skip
  continue;
  ```
  This means a fully legitimate completed job goes uncounted if the reputation query runs after `ends_at`.
- **Steps to reproduce:**
  1. Create a slot with `ends_at = now + 60` (1-minute slot).
  2. Book it, confirm both seller and buyer completions.
  3. Wait for slot to expire (>60s).
  4. Call `getReputation(sellerAddress)` — returns `verifiedJobsCount: 0`.
- **Severity:** medium — impacts reputation accuracy for short-duration slots (1h or less) if queried post-expiry.
- **Workaround used:**
  Document as L-001 in `arkiv/schema.md`. Reputation query is still correct within the slot's lifetime.
- **Suggested fix (upstream):**
  Two options: (A) Allow `getEntity(key)` to return basic metadata (creator, type) even for expired entities via an archival endpoint; (B) Developers can store `slot_creator` in the `completion` payload as an extra field at creation time, avoiding the post-expiry lookup problem entirely.
- **Upstream issue link:** (not filed)

---

### FR-010 · `getBlockNumber()` not directly available on `PublicArkivClient`

- **Date/time (IST):** 2026-10-13, ~09:45 IST
- **Phase:** 2 (UI)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**
  `PublicArkivClient` returned by `createPublicClient()` from `@arkiv-network/sdk` to expose the standard viem `getBlockNumber()` action directly (or inherit it), since it is a superset of viem's client for entity-oriented operations.
- **What actually happened:**
  TypeScript reports `getBlockNumber` as absent from the SDK's exported `PublicArkivClient` interface:
  ```
  Property 'getBlockNumber' does not exist on type 'PublicArkivClient'
  ```
  The underlying transport does support this call at runtime (the Tiramisu RPC responds to `eth_blockNumber`), but the TypeScript type surface does not expose it.
- **Steps to reproduce:**
  ```ts
  import { createPublicClient } from "@arkiv-network/sdk";
  import { tiramisu } from "@arkiv-network/sdk/chains";
  import { http } from "viem";
  const c = createPublicClient({ chain: tiramisu, transport: http() });
  await c.getBlockNumber(); // TS error: Property does not exist
  ```
- **Severity:** papercut (type gap; runtime call works with cast)
- **Workaround used:**
  Cast to `unknown` then to the expected type in `useChainHead.ts`:
  ```ts
  const block = await (client as unknown as { getBlockNumber: () => Promise<bigint> }).getBlockNumber();
  ```
- **Suggested fix:**
  Extend `PublicArkivClient` to include standard viem `PublicActions` (or re-export them), so developers don't need unsafe casts for basic EVM reads.
- **Upstream issue link:** (not filed)

---

## What worked well — Phase 2

- **Build pipeline clean**: `tsc -b && vite build` produced 0 TypeScript errors and 0 warnings across 506 modules on first attempt.
- **`dist/` secrets-clean**: `grep` for 64-hex private key patterns in `dist/assets/*.js` returned 0 matches — no key leakage in the production bundle.
- **Reputation unit tests (8/8)**: All eight `verifyJobCompletion()` edge cases pass with no chain calls, confirming the three-part rule is correctly enforced purely in TypeScript.
- **React Leaflet integration**: `react-leaflet@4` + Carto Positron tiles work cleanly with Vite + React 19 with a single icon-path fix for the default Leaflet marker.

---

### FR-011 · `getEntity({ key })` throws `Invalid key value` for entity keys from `createEntity`

- **Date/time (IST):** 2026-10-13, ~10:26 IST
- **Phase:** 2B (FR-005 retest)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**
  `getEntity({ key: entityKey })` where `entityKey` is the value returned by `createEntity()` (a 66-char `0x`-prefixed 64-hex string) to return the entity or throw `NoEntityFoundError` after expiry.
- **What actually happened (exact error text):**
  ```
  Invalid key value {"key":"0x82302c963377fec72f163883119f404c36e2fd27a4956b7852be3e39d723c5c0"}
  ```
  This error was thrown on **every single poll** — both while the entity was live in the query index (query=YES rows) AND after it expired (query=NO rows). `getEntity` never succeeded for this entity key at any point in its lifetime.
- **Steps to reproduce:**
  ```ts
  const created = await wallet.createEntity({ ... });
  const key = created.entityKey; // 0x82302c963377...
  await pub.getEntity({ key });   // throws Invalid key value
  ```
  Observed in `scripts/fr005-expiry-retest.ts` run (task-555.log), 2026-10-13 ~04:56–04:58 UTC.
  Note: Phase 0 `getEntity` succeeded with a key from a different entity (`0xae9bcc84c5...`). The failing key here is 64 hex chars (32 bytes) after `0x`. Both appear to be the same format.
- **Severity:** high — `getEntity` is broken for at least some entity keys, making it impossible to use `getEntity` to verify a specific entity's live status or attributes.
- **Workaround used:**
  Use `select().where(eq(...))` to find the entity by attribute instead of by key. This is what `fetchLiveSlots` already does.
- **Suggested fix:**
  Investigate whether `getEntity` expects a different key format (e.g. without `0x` prefix, or a shorter hash), and document the expected key format clearly in the SDK.
- **Upstream issue link:** (not filed — needs further investigation to isolate whether this is a key format issue or a server-side bug)

---

## What worked well — Phase 2B

- **Build clean (531 modules, 0 errors)**: `tsc -b && vite build` after the full UI rebuild produced no errors. The marker-cluster library integrated without type issues.
- **Live seed (30/30 created)**: `scripts/seed.ts --count 30 --yes` created all 30 slots with 0 failures. Cost per slot: ~0.000143 GLM.
- **Secret scan (PASS)**: `npm run scan:secrets` found no private key in `dist/`, `src/`, `scripts/`, `arkiv/`, `README.md`, `WALLETS.md`, or git history.
- **FR-005 conclusive retest**: 1-second polling table confirms query index drops 2 blocks before SDK `expiresAt`. The gap is real and reproducible.
- **Cost data collected**: 3h = 0.000141824 GLM, 24h = 0.000141840 GLM. 40-slot seed estimated at 0.00567296 GLM.
- **T-01–T-06 automated test suite (7/7 PASS)**: Cold load 1094ms, warm fetch 291ms, bad RPC throws, empty namespace = 0 entities, ends_at precision confirmed, hot-removal confirmed at expiry boundary.

---

### FR-012 · Tiramisu RPC intermittently stalls on consecutive queries (no response, no error)

- **Date/time (IST):** 2026-10-13, ~10:59 IST
- **Phase:** 2B (test-report.ts run 1)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet
- **What I expected:**
  A second `select().where().fetch()` call made immediately after a successful first call on the same `PublicArkivClient` instance would resolve within a few seconds.
- **What actually happened:**
  On the first `test-report.ts` run, T-02 (second `fetchSlots` call) never resolved — the process hung indefinitely with no error thrown and no timeout from the SDK. The process had to be manually killed. On the second run with a 10-second application-level timeout, T-02 resolved in **291ms**.
- **Reproduce:**
  ```ts
  const pub = createPublicClient({ chain: tiramisu, transport: http(RPC) });
  await pub.select().where(and(eq("project", str("slotbazaar")), ...)).fetch(); // succeeds
  await pub.select().where(and(eq("project", str("slotbazaar")), ...)).fetch(); // may hang indefinitely
  ```
  Reproduced once (first run); resolved on second attempt.
- **Severity:** medium — intermittent hang with no error or timeout surfaced to the caller. The SDK does not set a default HTTP request timeout, so a stalled connection silently blocks the process.
- **Workaround used:**
  Wrap every RPC call with an application-level `Promise.race` timeout (10s used in `test-report.ts`). In the UI, the 8s poll interval partially mitigates this by creating a new fetch cycle.
- **Suggested fix:**
  Add a configurable `timeout` option (default: 8000ms) to `PublicArkivClient` transport or query builder, consistent with how viem exposes transport timeouts.
- **Upstream issue link:** (not filed — intermittent, needs more data to reproduce reliably)
- **Update 2026-10-13 (Phase 2C review):** Attempted to reproduce twice more in the same session. Run 2 (with 10s timeout): T-02 resolved in 291ms — no stall. Run 3 (Phase 2C rerun): T-02 resolved in 289ms — no stall. **Stall only observed once (run 1, 2026-10-13 ~10:59 IST).** Per Phase 2C rubric ("reproduce at least twice with timings before keeping as an entry"), this is **downgraded from a friction entry to a note**: the behaviour was real (process had to be killed) but has not reproduced since. Keeping the entry for traceability; severity lowered to **low**. Will re-file as a confirmed issue if it recurs.
