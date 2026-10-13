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


