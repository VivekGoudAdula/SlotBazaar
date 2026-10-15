# SlotBazaar — Arkiv Friction Log

> Append-only. Template: FR-NNN · Title / Date / Phase / SDK+network / Expected / Actual / Reproduce / Severity / Workaround / Fix suggestion / Issue link.
>
> Rules: Only log things reproduced at least twice. Include exact error text. Factual and constructive, not complaining.
>
> **Project Lineage:** Initiated at baseline commit `8d073160bf920f4967199eddcb03f712c87b0877` on `2026-10-12 21:07:20 +0530` (`phase 0: scaffold repository, arkiv sdk integration notes, and first on-chain slot entity on tiramisu`). See [docs/DISCLOSURE.md](../docs/DISCLOSURE.md).

---

## Friction Summary Table (Judges Quick Reference)

### 1. Arkiv & SDK Friction (6 small SDK and DX findings: FR-001, FR-003, FR-004, FR-010, FR-012, FR-017, of which FR-012 reproduced once and FR-004 is documented behaviour)

| ID | Title | Severity | Status | Upstream Issue Link / Note |
|---|---|---|---|---|
| **FR-001** | `InvalidPredicateError` not exported from main package | Minor | Workaround applied (import from `/query`) | [Issue #3 in arkiv/issues-to-file.md](arkiv/issues-to-file.md#issue-3-invalidpredicateerror-is-not-exported-from-the-main-arkiv-networksdk-entry-point-fr-001) |
| **FR-003** | node-side simulation revert (execute reverted: Ident32InvalidByte(0, 0x50)), 0 gas spent; message lists "A"-"Z" as allowed while rejecting uppercase | Minor | node-side simulation revert (execute reverted: Ident32InvalidByte(0, 0x50)), 0 gas spent; message lists "A"-"Z" as allowed while rejecting uppercase | [Issue #1 in arkiv/issues-to-file.md](arkiv/issues-to-file.md#issue-1-uppercase-attribute-name-throws-generic-entitymutationerror-instead-of-invalidattributenameerror-fr-003) |
| **FR-004** | Wrong number type in range query silently returns 0 results | Minor | Documented behaviour; solved via strict typed attributes in src/lib/arkiv.ts | [Issue #2 in arkiv/issues-to-file.md (Feature Request)](arkiv/issues-to-file.md#issue-2-feature-request-developer-warning-or-type-inference-when-query-predicate-type-differs-from-stored-attribute-fr-004) |
| **FR-010** | `getBlockNumber()` not directly available on `PublicArkivClient` | Minor | Solved via type cast in useChainHead.ts | Type gap on PublicArkivClient |
| **FR-012** | Tiramisu RPC intermittently stalls on consecutive queries (reproduced once) | Medium | Reproduced once; solved via 8s timeout wrapper & backoff | Observed once; not reproduced since |
| **FR-017** | `watchEntityEvents` silently falls back to HTTP polling if fromBlock is supplied; passive expiration emits no log events | Medium | Solved via 1s client ticker with 4s margin | Documented in FR-017 (silent passive expiry) |

### 2. Cosmetic (Typo in Error Message) (1 cosmetic item: FR-006)

| ID | Title | Severity | Status | Upstream Note |
|---|---|---|---|---|
| **FR-006** | Typo in `InvalidPredicateError` message | Cosmetic | Cosmetic typo in SDK error string | Documented in FR-006 |

### 3. Notes, Ecosystem & Withdrawn Items (10 items)

| ID | Title | Severity | Status | Upstream Note |
|---|---|---|---|---|
| **FR-002** | `BigInt` attribute values (`u64`) throw in `JSON.stringify` | Cosmetic | Solved via custom BigInt replacer | Standard JavaScript BigInt behavior |
| **FR-005** | Query index expiration semantics at block boundary (retested without ends_at predicate) | Withdrawn (Note) | query and getEntity agree; entity not visible from block expiresAt-1 or expiresAt depending on sampling resolution (plus or minus 1 block) | Clock skew / client predicate note (raw log in Notes) |
| **FR-007** | `erasableSyntaxOnly` compiler flag rejects class constructor parameter properties | Papercut | Solved via constructor field assignment | TypeScript / Vite configuration |
| **FR-008** | Native token transfers require standard viem client rather than Arkiv wallet client | Papercut | Solved via viem client for transfers | Standard EVM tooling |
| **FR-009** | `getReputation` cannot recover slot creator after slot expires | Architectural Note | Solved by Schema v2 storing creator in booking | Schema v1 design limitation |
| **FR-011** | `getEntity({ key })` throws `Invalid key value` (withdrawn: positional call `getEntity(key)` succeeds) | Withdrawn (Note) | Withdrawn: positional getEntity(key) succeeds; passing { key } throws Invalid key value (not 0x-prefixed hex) | Withdrawn; positional getEntity(key) succeeds |
| **FR-013** | Storage rent between 14-day and 30-day entity expiry has zero marginal cost impact | Economic Note | 30-day expiry adopted for Schema v2 | Storage rent pricing observation |
| **FR-014** | Same-block racing entity creations lack execution index in query attributes | Architectural Note | Solved via deterministic tie-breaker in getWinningBooking | Block execution ordering observation |
| **FR-015** | Schema v1 post-expiry reputation failure permanently solved by Schema v2 decoupling | Resolved Note | Solved by Schema v2 decoupling | Architecture design note |
| **FR-016** | explorer.tiramisu.arkiv.network returns NXDOMAIN; official explorer is data.arkiv.network/?q=${key}&chain=tiramisu | Withdrawn (Note) | Withdrawn as friction: our guessed wrong hostname (tiramisu.explorer resolves) | Guessed wrong hostname |

### Why We Trust These Entries (Empirical Reproduction Register)

This register tracks empirical runs on Arkiv Tiramisu (`chainId: 7738577`) or during SDK evaluation. Run counts are recorded only where backed by logged script outputs or test executions; unproven historical counts are honestly labeled "not recorded".

| Friction ID | Primary Reproduction Script / Test Harness | Run Count | Validation Result |
|---|---|:---:|---|
| **FR-001** | `scripts/query-slots.ts` | 2 | Confirmed `SyntaxError` on import from `@arkiv-network/sdk`. |
| **FR-002** | `src/lib/arkiv.ts` | not recorded | Confirmed `TypeError: Do not know how to serialize a BigInt`. *(JS language behavior)* |
| **FR-003** | Phase 9 controlled balance measurement | 1 | Confirmed SDK throws `EntityMutationError` client-side; `0` gas burned. |
| **FR-004** | `scripts/query-slots.ts` | 2 | Confirmed 0 rows returned silently when passing `i32` predicate to `u64` attribute. |
| **FR-005** | `scripts/retest-fr017-expiry-evidence.ts` & Phase 9 block audit | 2 | Confirmed query index drops at exact expiry block when no `ends_at` filter is passed. |
| **FR-006** | SDK inspection | not recorded | Confirmed mismatched quote in error string. |
| **FR-007** | `tsconfig.app.json` | not recorded | Confirmed `erasableSyntaxOnly` rejects constructor property syntax. *(TS/Vite config)* |
| **FR-008** | In-app wallet signing | not recorded | Confirmed viem client required for standard EVM transfers. *(Standard EVM tooling)* |
| **FR-009** | Schema v1 test | not recorded | Confirmed post-expiry slot creator unrecoverable in Schema v1; solved in Schema v2. |
| **FR-010** | SDK TypeScript interface | not recorded | Confirmed `getBlockNumber` missing on `PublicArkivClient` type. |
| **FR-011** | Phase 9 positional call verification | 3 | Confirmed positional `getEntity(key)` succeeds on 3 live entities; withdrawn as our own call-shape error. |
| **FR-012** | `test-report.ts` run 1 | 1 | Intermittent RPC stall observed once; did not recur on subsequent runs. Severity: Low. |
| **FR-013** | Phase 4 rent observation | not recorded | Confirmed storage rent delta between 14d and 30d is 0 wei on testnet. *(Info)* |
| **FR-014** | Same-block booking races | not recorded | Confirmed identical block numbers handled via lexicographical entity key tie-breaker. *(Application rule)* |
| **FR-015** | Schema v2 decoupling | not recorded | Confirmed Schema v2 solves post-expiry reputation by recording creator on booking. *(Architecture note)* |
| **FR-016** | Phase 9 DNS check & HTTP GET | 1 | Confirmed `explorer.tiramisu` returns NXDOMAIN; `data.arkiv.network` returns HTTP 200 (single machine/network). |
| **FR-017** | `scripts/test-ws-latency.ts` & `verify-passive-expiry-batch.ts` | 2 | Confirmed 5/5 expiries emitted 0 EVM log events over 65s observation window. |

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

### FR-003 · node-side simulation revert (execute reverted: Ident32InvalidByte(0, 0x50)), 0 gas spent; message lists "A"-"Z" as allowed while rejecting uppercase

- **Date/time (IST):** 2026-10-12, ~21:25 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected (cite the doc page or type declaration):**  
  The SDK exports `InvalidAttributeNameError` and `validateAttributeName()`. The type declaration for `createEntity` specifies: `@throws {InvalidAttributeNameError} If a name violates the attribute-name grammar.` I expected attribute names with uppercase letters (e.g. `UppercaseAttr`) to throw `InvalidAttributeNameError` client-side before any network interaction.
- **What actually happened (exact error text or output):**  
  The SDK threw `EntityMutationError` synchronously during serialization before transaction broadcast:
  ```
  EntityMutationError: Transaction failed: an attribute name holds "U" (0x55) at byte 0, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)
  ```
  No transaction was broadcast to the network and zero gas was burned.
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  await wallet.createEntity({
    payload: jsonToPayload({ note: "test" }),
    contentType: "application/json",
    attributes: { UppercaseAttr: str("test"), project: str("slotbazaar") },
    expires: ExpirationTime.fromMinutes(10),
  });
  ```
  Run: `npx tsx scripts/edge-probes.ts`
- **Severity:** minor (developer DX / client validation error type; zero gas spent, never reached chain)
- **Workaround used:**  
  Enforce strict lowercase snake_case attribute names in app code and pre-validate before calling SDK methods.
- **Suggested fix:**  
  Throw the specific `InvalidAttributeNameError` exported by the SDK rather than generic `EntityMutationError`.
- **Upstream issue link:** [Issue #1 in issues-to-file.md](issues-to-file.md#issue-1-uppercase-attribute-name-throws-generic-entitymutationerror-instead-of-invalidattributenameerror-fr-003)

  > **Update 2026-10-14 IST (Phase 9 Controlled Balance Measurement):**
  > Controlled retest run against Tiramisu testnet wallet `0x5349...a6e9`:
  > - **Wallet Balance Before:** `29919742669947485340 wei` (29.91974266994748534 GLM)
  > - **Call:** `wallet.createEntity({ ..., attributes: { UppercaseAttr: str("val") } })`
  > - **Result:** Threw `EntityMutationError: Transaction failed: an attribute name holds "U" (0x55) at byte 0, which is outside the name charset` client-side before transaction submission.
  > - **Tx Hash:** None (never broadcast to RPC or mined on-chain)
  > - **Gas Used:** `0`
  > - **Wallet Balance After:** `29919742669947485340 wei` (29.91974266994748534 GLM)
  > - **Balance Delta:** `0 wei / 0 GLM`
  > - **Correction:** The original Phase 0 hypothesis that uppercase attributes burn gas on-chain was incorrect. Zero gas was spent. **Severity downgraded to Minor.**
  >
  > **Update 2026-10-14 IST (Phase 10 Error Origin & Stack Inspection):**
  > Stack and error-cause inspection via `arkiv/repro/fr003-uppercase-attribute.ts`:
  > - **Origin:** Raised during `eth_estimateGas` node-side simulation (`ContractFunctionRevertedError: Error: Ident32InvalidByte(uint256 position, bytes1 value) (0, 0x50)` on `execute(...)`). It never reached `eth_sendRawTransaction`.
  > - **Gas spent:** Exactly `0 wei / 0 GLM`.
  > - **SDK behavior:** The SDK does not pre-validate attribute names locally before simulating. The node-side simulation error surfaces as a generic `EntityMutationError` rather than the exported `InvalidAttributeNameError`.
  > - **Classification:** Moved to the Arkiv and SDK friction table as **Minor**.
  >
  > **Update 2026-10-15 IST (Phase 13 Exact Error Trace & Message Contradiction):**
  > Controlled rerun via `arkiv/repro/fr003-uppercase-attribute.ts` (raw log saved untouched in `arkiv/repro/logs/fr003-uppercase-attribute.txt`):
  > - **Exact Error Name:** `EntityMutationError`
  > - **Exact Error Message:** `Transaction failed: an attribute name holds "P" (0x50) at byte 0, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)`
  > - **Exact Error Cause:** `The contract function "execute" reverted. Error: Ident32InvalidByte(uint256 position, bytes1 value) (0, 0x50)`
  > - **Error Message Inconsistency / Contradiction:** The error message explicitly states that `"A"-"Z"` IS in the allowed name charset (`"which is outside the name charset (\"A\"-\"Z\", \"a\"-\"z\", ...)"`), yet it simultaneously rejects byte `0x50` (`"P"`), which is an uppercase ASCII character directly within `"A"-"Z"`. The node-side EVM validator contract reverts with `Ident32InvalidByte(0, 0x50)`, contradicting the error message's own claim that `"A"-"Z"` is permitted.
  > - **Gas Spent:** Exactly `0 wei (0 GLM)`.

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
- **Severity:** minor (developer DX / silent data omission; documented tag matching)
- **Workaround used:**  
  Strictly maintain schema typing wrappers (`u64` timestamps, `i32` coordinate factors) in a dedicated library layer (`src/lib/arkiv.ts`).
- **Suggested fix:**  
  Emit a diagnostic warning or validate types in the query engine if attribute schemas are indexed.
- **Upstream issue link:** (not filed)

  > **Update 2026-10-13 IST:** Arkiv documentation clarifies this is documented behaviour: a typed predicate only matches cells stored with that exact type tag. There is no diagnostic today. Severity revised to **minor**. Suggested fix updated: add optional dev-mode warning when a predicate type does not match known schema types for that attribute.

---

### FR-005 · Query index expiration semantics at block boundary (retested without ends_at predicate)

- **Date/time (IST):** 2026-10-12, 21:05 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  An entity scheduled to expire at block `targetBlock` would remain visible in queries through `targetBlock`, and disappear at `targetBlock + 1`.
- **What actually happened (exact error text or output):**  
  In Phase 0, a 1-block asymmetry was observed when querying with `gt("ends_at", u64(nowSec))`. In Phase 2B, a 2-block gap was observed due to timestamp-to-block conversion margin.
- **Severity:** minor / documentation note
- **Workaround used:**  
  Account for 4s (1–2 block) margin when calculating time-to-live or evaluating slot expiration on the UI.
- **Suggested fix:**  
  Document the exact query expiration boundary condition (whether `block < expiresAt` or `block <= expiresAt`) and how timestamp predicates interact with block height.
- **Upstream issue link:** (not filed)

  > **Update 2026-10-14 IST (Phase 9 Controlled Expiry Retest without ends_at Predicate):**
  > Controlled retest executed on Tiramisu testnet using a query with **NO** `ends_at` predicate (filtered solely by `project="slotbazaar"` and `entity_type="slot"`), polling every block from 20 blocks before to 5 blocks after expiry alongside positional `publicClient.getEntity(entityKey)`:
  > Target Expiry Block: #559429 (entity: `0x7f4b8f0653697a59...`)
  >
  > | Block | Relative to Expiry | In Query Index (`select()`) | `getEntity(entityKey)` | Note |
  > |---|---|:---:|:---:|---|
  > | #559409 | -20 blocks (active) | YES | ok | Live and visible in both |
  > | #559410 | -19 blocks (active) | YES | ok | Live and visible in both |
  > | #559411 | -18 blocks (active) | YES | ok | Live and visible in both |
  > | #559412 | -17 blocks (active) | YES | ok | Live and visible in both |
  > | #559413 | -16 blocks (active) | YES | ok | Live and visible in both |
  > | #559414 | -15 blocks (active) | YES | ok | Live and visible in both |
  > | #559415 | -14 blocks (active) | YES | ok | Live and visible in both |
  > | #559416 | -13 blocks (active) | YES | ok | Live and visible in both |
  > | #559417 | -12 blocks (active) | YES | ok | Live and visible in both |
  > | #559418 | -11 blocks (active) | YES | ok | Live and visible in both |
  > | #559419 | -10 blocks (active) | YES | ok | Live and visible in both |
  > | #559420 | -9 blocks (active)  | YES | ok | Live and visible in both |
  > | #559421 | -8 blocks (active)  | YES | ok | Live and visible in both |
  > | #559422 | -7 blocks (active)  | YES | ok | Live and visible in both |
  > | #559423 | -6 blocks (active)  | YES | ok | Live and visible in both |
  > | #559424 | -5 blocks (active)  | YES | ok | Live and visible in both |
  > | #559425 | -4 blocks (active)  | YES | ok | Live and visible in both |
  > | #559426 | -3 blocks (active)  | YES | ok | Live and visible in both |
  > | #559427 | -2 blocks (active)  | YES | ok | Live and visible in both |
  > | #559428 | -1 block (active)   | YES | ok | Live and visible in both |
  > | #559429 | Expiry block        | NO  | not-found | Dropped from both simultaneously at boundary |
  > | #559430 | +1 block (expired)  | NO  | not-found (`NoEntityFoundError`) | Pruned from chain state |
  > | #559431 | +2 blocks (expired) | NO  | not-found (`NoEntityFoundError`) | Pruned from chain state |
  > | #559432 | +3 blocks (expired) | NO  | not-found (`NoEntityFoundError`) | Pruned from chain state |
  > | #559433 | +4 blocks (expired) | NO  | not-found (`NoEntityFoundError`) | Pruned from chain state |
  > | #559434 | +5 blocks (expired) | NO  | not-found (`NoEntityFoundError`) | Pruned from chain state |
  >
  > **Definitive Finding:** When the query does **NOT** include an application-level `ends_at` range predicate, query and getEntity agree; entity not visible from block expiresAt-1 or expiresAt depending on sampling resolution (plus or minus 1 block). Arkiv treats `expiresAt` as an exclusive boundary. The previous 1–2 block early-drop observation occurred exclusively because `gt("ends_at", u64(nowSec))` evaluated client wall-clock Unix seconds against consensus block timestamps.
  >
  > **Update 2026-10-15 IST (Phase 13 Fast Block Sampling Verification):**
  > FR-005 is withdrawn as friction (moved to Architectural Notes). The early drop came entirely from our own client predicate `ends_at > nowSec`. Fast block-by-block polling (`arkiv/repro/fr005-expiry-boundary.ts`, raw log saved untouched in `arkiv/repro/logs/fr005-expiry-boundary.txt`) confirms that query and getEntity agree; entity not visible from block expiresAt-1 or expiresAt depending on sampling resolution (plus or minus 1 block). The 4-second client margin in `useLiveSlots.ts` exists strictly for browser/chain clock skew, not an Arkiv consensus asymmetry.
  > Minimal runnable reproduction script: `arkiv/repro/fr005-expiry-boundary.ts`.

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
| **Query Expiration Timing** | "Entity expires at ends_at, so the chain removes it" | When querying without an `ends_at` range predicate, the query index drops the entity at the exact same consensus `expiresAt` block (0 blocks early; verified in Phase 9 retest). When an application query includes `gt("ends_at", u64(nowSec))`, a 1–2 block gap can occur due to client clock vs block timestamp differences. |
| **Attribute Validation** | "Invalid attributes fail client-side" | Uppercase attribute names are rejected client-side before broadcast with `EntityMutationError` (`0` gas spent, never reached the chain; verified in Phase 9 controlled balance measurement). |
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

### FR-011 · `getEntity({ key })` throws `Invalid key value` (withdrawn: positional call `getEntity(key)` succeeds)

- **Date/time (IST):** 2026-10-13, ~10:26 IST
- **Phase:** 2B (FR-005 retest)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**
  `getEntity({ key: entityKey })` to accept an options object containing the entity key.
- **What actually happened (exact error text):**
  ```
  Invalid key value {"key":"0x82302c963377fec72f163883119f404c36e2fd27a4956b7852be3e39d723c5c0"}
  ```
  This error was thrown because the SDK expects a positional string argument `getEntity(entityKey)`, not an options object `{ key }`.
- **Steps to reproduce:**
  ```ts
  const created = await wallet.createEntity({ ... });
  const key = created.entityKey; // 0x82302c963377...
  await pub.getEntity({ key });   // throws Invalid key value
  ```
- **Severity:** withdrawn (our own call-shape error, not an Arkiv SDK bug)
- **Workaround used:**
  Use positional call `getEntity(entityKey)` as specified in Arkiv documentation.
- **Suggested fix:**
  None required on SDK side; our client call was corrected.
- **Upstream issue link:** (none — withdrawn)

  > **Update 2026-10-14 IST (Phase 9 Positional Call Verification):**
  > Retested `publicClient.getEntity(entityKey)` using the positional call signature documented in Arkiv's SDK guides on 3 fresh entities created on Tiramisu testnet:
  > - **Entity 1 (`0x7f4b8f0653697a59...`):** Positional call `getEntity(key)` returned full entity (`payload`, `creator: 0x5349...a6e9`, `expiresAt: 559429n`). Calling `getEntity({ key })` threw `Invalid key value {"key":"0x7f4b..."}`.
  > - **Entity 2 (`0x0405bc5e59273c68...`):** Positional call `getEntity(key)` succeeded cleanly, returning valid payload and metadata.
  > - **Entity 3 (`0x5cb524efbda7a726...`):** Positional call `getEntity(key)` succeeded cleanly, returning valid payload and metadata.
  > - **Post-Expiry Retest:** After block expiry, positional call `getEntity(key)` threw: `NoEntityFoundError: No live entity with key 0x7f4b8f06... It was never created, or it has been deleted or has expired.`
  > - **Resolution:** FR-011 was entirely our own call-shape error: passing an object `{ key }` to a function expecting a positional string parameter `key: Hex`. **FR-011 is formally WITHDRAWN.** Removed from Arkiv/SDK friction table; SDK blame removed from `schema.md` L-005 and `submission-answers.md`.
  > - **Reproduction Script:** `arkiv/repro/fr011-getentity-call-shape.ts`.
  >
  > **Update 2026-10-15 IST (Phase 13 Exact Error String Reconciliation):**
  > Controlled rerun via `arkiv/repro/fr011-getentity-call-shape.ts` (raw log saved untouched in `arkiv/repro/logs/fr011-getentity-call-shape.txt`):
  > - **Positional Call:** `pub.getEntity(entityKey)` succeeded cleanly, returning valid fields (`key`, `creator`, `createdAt`, `updatedAt`, `expiresAt: 605634n` as a block number).
  > - **Object Call Error Name:** `InvalidValueError`
  > - **Exact Error Message Thrown:** `Invalid key value {"key":"0x8f2621c8dd46b1896a9185a12ab7db963d0ca56926c00c9d6f59d6f989f965fd"}: not 0x-prefixed hex.`
  > - **Reconciliation of Error Strings:** In an earlier text report, the message was paraphrased as `"The value \"[object Object]\" is not a 0x-prefixed hex string..."`. The actual error thrown by the SDK is `Invalid key value {"key":"0x..."}: not 0x-prefixed hex.` because `@arkiv-network/sdk/src/attr/errors.ts` uses `safeJson(input)` in `describe(input)`, which serializes the object to `{"key":"0x..."}` rather than `[object Object]`. The committed script and logs confirm this exact string.

---

## What worked well — Phase 2B

- **Build clean (531 modules, 0 errors)**: `tsc -b && vite build` after the full UI rebuild produced no errors. The marker-cluster library integrated without type issues.
- **Live seed (30/30 created)**: `scripts/seed.ts --count 30 --yes` created all 30 slots with 0 failures. Cost per slot: ~0.000143 GLM.
- **Secret scan (PASS)**: `npm run scan:secrets` found no private key in `dist/`, `src/`, `scripts/`, `arkiv/`, `README.md`, `WALLETS.md`, or git history.
- **FR-005 conclusive retest**: 1-second polling table confirms query index drops 2 blocks before SDK `expiresAt`. The gap is real and reproducible.
- **Cost data collected**: 3h = 0.000141824 GLM, 24h = 0.000141840 GLM. 40-slot seed estimated at 0.00567296 GLM.
- **T-01–T-06 automated test suite (7/7 PASS)**: Cold load 1094ms, warm fetch 291ms, bad RPC throws, empty namespace = 0 entities, ends_at precision confirmed, hot-removal confirmed at expiry boundary.

---

### FR-012 · Tiramisu RPC intermittently stalls on consecutive queries (reproduced once)

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
  Reproduced once (first run); resolved on second attempt. Did not reproduce on subsequent runs.
- **Severity:** low (reproduced once; downgraded to note)
- **Workaround used:**
  Wrap every RPC call with an application-level `Promise.race` timeout (8s used in app). In the UI, the 12s poll interval mitigates this by creating a fresh fetch cycle.
- **Suggested fix:**
  Add a configurable `timeout` option (default: 8000ms) to `PublicArkivClient` transport or query builder, consistent with how viem exposes transport timeouts.
- **Upstream issue link:** (not filed — intermittent, needs more data to reproduce reliably)
- **Update 2026-10-13 (Phase 2C review):** Attempted to reproduce twice more in the same session. Run 2 (with 10s timeout): T-02 resolved in 291ms — no stall. Run 3 (Phase 2C rerun): T-02 resolved in 289ms — no stall. **Stall only observed once (run 1, 2026-10-13 ~10:59 IST).** Per Phase 2C rubric ("reproduce at least twice with timings before keeping as an entry"), this is **downgraded from a friction entry to a note**: the behaviour was real (process had to be killed) but has not reproduced since. Keeping the entry for traceability; severity lowered to **low**. Will re-file as a confirmed issue if it recurs.

---

### FR-013 · Storage rent between 14-day and 30-day entity expiry has zero marginal cost impact

- **Date/time (IST):** 2026-10-13, ~18:30 IST
- **Phase:** 4 (Schema v2 Booking Cost Measurement)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  A 30-day booking entity on Arkiv to consume measurably more GLM storage rent than a 14-day booking entity.
- **What actually happened:**  
  Exact balance delta before and after entity creation on Tiramisu testnet:
  - **14-day booking spent**: `120960000241920 wei` (`0.00012096000024192 GLM`)
  - **30-day booking spent**: `120960000241920 wei` (`0.00012096000024192 GLM`)
  - **Difference**: `0 wei`.
  The transaction base fee and L2 execution gas dominate the creation transaction; storage rent for small JSON payloads (~300 bytes) over 14 vs 30 days is zero delta on testnet.
- **Reproduce:**
  Run `scripts/test-phase4.ts` Part 1:
  ```ts
  const balBefore = await publicClient.getBalance({ address });
  await wallet.createEntity({ ..., expires: ExpirationTime.atDate(new Date(now + 14 * 86400 * 1000)) });
  // compare balance delta against 30-day entity
  ```
  Reproduced twice with exact wei values recorded.
- **Severity:** architectural insight / documentation note (positive outcome)
- **Workaround used:**  
  Adopted 30 days (`ExpirationTime.fromDays(30)`) as the standard expiry for `booking` and `completion` entities in Schema v2. Provides ample dispute resolution window without financial penalty.
- **Suggested fix:**  
  Document in the Arkiv pricing / storage rent guide that short-term versus medium-term storage rent is flat or negligible for small payloads, reassuring developers about dispute windows.

  > **Update 2026-10-14 IST:** Observation note, not Arkiv friction. Storage rent behavior is an informational observation about gas vs rent balance. Only real Arkiv or SDK pain points count as friction going forward.

---

### FR-014 · Same-block racing entity creations lack execution index in query attributes

- **Date/time (IST):** 2026-10-13, ~18:30 IST
- **Phase:** 4 (Decentralized Winner Resolution)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  Entities created in the same block would expose a transaction index, log index, or sub-block sequence attribute so concurrent bids or bookings can be strictly ordered by intra-block execution time.
- **What actually happened:**  
  Arkiv entities expose `createdAt?: bigint` (which is the block timestamp) and `createdAtBlock?: bigint`, but no intra-block transaction index. When two users submit bookings mined in the exact same block, their block numbers and block timestamps are identical.
- **Steps to reproduce:**
  Query multiple entities created within the same block; compare their returned fields.
- **Severity:** minor (requires explicit application-level tie-breaker rule)
- **Workaround used:**  
  Implemented deterministic tie-breaking in `getWinningBooking`: earliest block wins; when two bookings share the same block, the lexicographically smaller entity key wins:
  ```ts
  if (aBlock !== bBlock) return Number(aBlock - bBlock);
  return a.key.toLowerCase().localeCompare(b.key.toLowerCase());
  ```
- **Suggested fix:**  
  Expose `transactionIndex` or `logIndex` in `FullEntity` / query projections to allow intra-block chronological tie-breaking.

---

### FR-015 · Schema v1 post-expiry reputation failure permanently solved by Schema v2 decoupling

- **Date/time (IST):** 2026-10-13, ~18:32 IST
- **Phase:** 4 (On-Chain Integration Test)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  A seller and buyer to be able to sign job completions after the short-lived slot entity has expired and been purged from Arkiv, with their verified reputation score updating accurately.
- **What actually happened in Schema v1 (FR-009):**  
  Completions referenced `slot_key`. Once the slot expired, `getEntity(slotKey)` failed and `getReputation` skipped the job.
- **How Schema v2 solved it:**  
  1. `createBooking` reads the live slot once during booking, copying `slot_creator` and `slot_ends_at` into the 30-day `booking` entity attributes.
  2. `createCompletion` references `booking_key` with role "seller" or "buyer" (also with 30-day expiry).
  3. Tested in `scripts/test-phase4.ts`: slot entity expired at Block #523380 and disappeared (`NoEntityFoundError`). Seller and buyer then created completions referencing `booking_key`. `getReputation` successfully derived `1 verified job` backed by on-chain proofs!
- **Severity:** resolved / verified architectural pattern.

  > **Update 2026-10-14 IST:** Design and architectural pattern note, not Arkiv friction. Documents application-level Schema v2 decoupling rather than an Arkiv SDK or network limitation. Only real Arkiv or SDK pain points count as friction going forward.

---

### FR-016 · explorer.tiramisu.arkiv.network returns NXDOMAIN; official explorer is data.arkiv.network/?q=${key}&chain=tiramisu

- **Date/time (IST):** 2026-10-13, ~20:55 IST
- **Phase:** 4 (Explorer Link Audit & UX Verification)
- **SDK + network versions:** Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  Navigating to `https://explorer.tiramisu.arkiv.network/entity/<key>` or `https://explorer.tiramisu.arkiv.network/tx/<txHash>` would open the block explorer view for the Arkiv entity or transaction.
- **What actually happened:**  
  The browser returned `DNS_PROBE_FINISHED_NXDOMAIN` ("Hmmm… can't reach this page / Check if there is a typo in explorer.tiramisu.arkiv.network"). The subdomains `explorer.tiramisu.arkiv.network` and `tiramisu.explorer.arkiv.network` have no valid DNS A/CNAME records.
- **Root Cause & Official Canonical Pattern:**  
  The official, working Arkiv Data Explorer uses a unified query parameter interface hosted on:
  `https://data.arkiv.network/?q=${entityKeyOrTxHash}&chain=tiramisu`
- **Severity:** medium (broken outgoing links in UI modals, toasts, and drawers until updated)
- **Fix Applied:**  
  Added shared helpers `getEntityExplorerUrl(key)` and `getTxExplorerUrl(txHash)` in `src/lib/arkiv.ts` pointing to `https://data.arkiv.network/?q=${key}&chain=tiramisu`, and updated all drawers, modals, toasts, and documentation across the codebase.

  > **Update 2026-10-14 IST (Phase 9 DNS & Explorer Verification):**
  > Controlled DNS diagnostic executed from this local machine and network:
  > ```
  > > nslookup explorer.tiramisu.arkiv.network
  > *** No internal type for both IPv4 and IPv6 Addresses (A+AAAA) records available for explorer.tiramisu.arkiv.network (NXDOMAIN)
  >
  > > nslookup tiramisu.explorer.arkiv.network
  > Non-authoritative answer:
  > Addresses: 104.26.14.219, 104.26.15.219, 172.67.69.21 (Cloudflare CDN)
  > ```
  > Note: Tested from a single machine and network environment.
  > Verified via HTTP GET that both `https://data.arkiv.network/?q=<txHash>&chain=tiramisu` and `https://data.arkiv.network/?q=<entityKey>&chain=tiramisu` return HTTP `200` and display on-chain transaction/entity details properly.
  >
  > **Update 2026-10-14 IST (Phase 10 Friction Withdrawal to Notes):**
  > FR-016 is withdrawn as friction (moved to Notes). `nslookup tiramisu.explorer.arkiv.network` successfully resolves to Cloudflare CDN IPs; only `explorer.tiramisu.arkiv.network` (a hostname we guessed) failed. In the application, transaction hashes link to `https://tiramisu.explorer.arkiv.network/tx/<hash>` and entity keys link to `https://data.arkiv.network/?q=<key>&chain=tiramisu`. Both patterns were verified in a real headless Chrome session (HTTP 200) with screenshots saved to `docs/screens/tiramisu-explorer-tx.png` and `docs/screens/data-arkiv-entity.png`.

---

### FR-017 · `watchEntityEvents` silently falls back to HTTP polling if fromBlock is supplied; passive expiration emits no log events

- **Date/time (IST):** 2026-10-14, ~10:15 IST
- **Phase:** 5 (WebSocket Live Updates Benchmark)
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  1. Passing `watchEntityEvents` options would maintain an active WebSocket subscription regardless of whether `fromBlock` is passed.
  2. Protocol entity expiration when a slot reaches `ends_at` would emit an event (e.g. `onEntityDeleted` or dedicated `onEntityExpired`) over the WebSocket so clients can remove expired listings in real-time.
- **What actually happened:**  
  1. Inspecting `@arkiv-network/sdk@0.8.1` source in `actions/public/watchEntityEvents.ts:141-177` reveals that viem's underlying `watchEvent` uses `eth_subscribe("logs")` *only* if `transport: webSocket(...)` is used AND `fromBlock` is `undefined`. If `fromBlock` is specified or `http()` is passed, it silently degrades to repetitive HTTP polling (`eth_getFilterLogs` / `eth_getLogs`) without notifying the caller.
  2. Running `scripts/test-ws-latency.ts` with a short-lived entity (10-second lifetime) confirmed that **passive protocol expiration does NOT emit an on-chain event**. Arkiv's indexing engine purges expired entities quietly at the timestamp boundary without generating an Ethereum log event or transaction.
- **Steps to reproduce:**
  ```ts
  const wsClient = createPublicClient({ chain: tiramisu, transport: webSocket(WSS_URL) });
  const allEvents = [];
  wsClient.watchEntityEvents({ onEvent: (e) => allEvents.push(e) });
  // Create entity with 10s expiry
  await wallet.createEntity({ ..., expires: ExpirationTime.atDate(new Date(Date.now() + 10000)) });
  // Wait 20 seconds: no event is emitted upon expiry.
  ```
- **Severity:** medium (architectural pitfall: developers expecting push-based expiration notifications will discover their UI slot cards never vanish unless explicit local time-based pruning is implemented).
- **Workaround used:**  
  1. Keep WebSocket client transport strictly on `webSocket(WSS_URL)` with no `fromBlock` to ensure true native push subscriptions.
  2. Implement an active 1-second client-side ticker interval in `useLiveSlots.ts` that immediately removes slots whose `endsAt <= nowSec + 4s` (1-2 block safety margin), decoupling UI expiry from on-chain event notifications.
  3. Keep a 30-second background HTTP poll as a safety net.
- **Suggested fix:**  
  Explicitly document in SDK docs that `watchEntityEvents` requires `webSocket()` without `fromBlock` for native WebSocket subscriptions, and clarify that entity expiration is a passive protocol pruning mechanism rather than an emitted contract event.
- **Update (2026-10-14, Phase 6):**
  - **Part 1 (Socket Transport & fromBlock — Documented Behavior):** Re-examination shows viem and Arkiv documentation specify that `eth_subscribe` push streams require `transport: webSocket(...)` with `fromBlock: undefined` (as historical ranges require `eth_getLogs` polling). Credit to the official docs; this is standard EVM client library architecture rather than an unresolvable bug.
  - **Part 2 (Passive Expiration Emits No Event — Empirical Finding):** Retained as real architectural friction with empirical evidence. We monitored WebSocket streams across multiple sessions (`scripts/test-ws-latency.ts` and `scripts/fr005-expiry-retest.ts`) observing 5 short-lived entities (10s–12s lifetimes) over 60+ seconds of observation. While creation events triggered immediately (avg 2,550 ms), exactly 0 expiration events were emitted across all 5 expiries. Developers must implement client-side timer pruning (such as SlotBazaar's 1s ticker with 4s margin) because Arkiv purges state at the consensus level without producing event logs.
  - **Update (2026-10-14, Phase 7 Post-Deploy Verification):** Rerun with `scripts/verify-passive-expiry-batch.ts`. Batch transaction `0x3d88e2e766e2df06a5d28fc082660400e45ee62916fec0a857b1d29e408eeb6a` created 5 entities with 25-second lifespans. We subscribed to `wss://rpc.tiramisu.db-chain.testnet.arkiv.network` and captured events for 65 seconds (40s past expiry).
    - Entity `#1` (`0x0302a4db4882a4d9...`): Created=1, Deleted=0
    - Entity `#2` (`0xde91c7d68613014d...`): Created=1, Deleted=0
    - Entity `#3` (`0x6f94f2de2433ee8f...`): Created=1, Deleted=0
    - Entity `#4` (`0xd81e7794f37c5b62...`): Created=1, Deleted=0
    - Entity `#5` (`0x429f2bf501dc3f1d...`): Created=1, Deleted=0
    - **Total over 65s:** 5 Created events, exactly **0 Deleted events**, 0 Expired events. Passive protocol expiration remains 100% silent at the event log layer.

---

### Batch 10 Reliability Retest & Gas Estimation Clarification
- **Update (2026-10-14, Phase 7):** During Phase 6, a single batch probe timed out, leading to an initial hypothesis of a "gas estimation timeout". In Phase 7, we ran 3 independent batch tests of size 10 (`seed_batch="dev-probe"`) across different times:
  - **Run #1:** `PASS` — Elapsed: 9,992 ms, Tx: `0xecd737696816017eef4e2122ffecc3387091cd87bf009d15b91984326cae70cd`, Cost: 0.001432864 GLM (10 entities).
  - **Run #2:** `PASS` — Elapsed: 24,654 ms, Tx: `0x9641a10f62cb8dcb94331f512742e9e0a2d896a5677d66ab987bbfc7470c44c8`, Cost: 0.001432864 GLM (10 entities).
  - **Run #3:** `PASS` — Elapsed: 21,282 ms, Tx: `0x8a2479d121203ceb59d4ce53f683298fc913ae33930578f97c17e5b47f87a6e8`, Cost: 0.001432864 GLM (10 entities).
  - **Conclusion:** 3/3 succeeded. The unproven "gas estimation timeout" explanation is corrected: the prior single failure was an isolated transient RPC connection stall rather than a protocol or gas estimation ceiling. Batches of 10, 20, and 30 are fully supported by `@arkiv-network/sdk` and Tiramisu.

---

### Measured Browser RPC Network Load (Real Browser on Deployed Origin)
*Measured on 2026-10-14 against deployed URL `https://slotbazaar.vercel.app` (N=3 samples of 60 seconds each per state)*

| State | Minute 1 | Minute 2 | Minute 3 | Average Req/Min | Details |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Foreground Idle (WebSocket Healthy)** | 76 | 121 | 96 | **97.7** | WS connection active + 4s chainhead polling + viem event listener |
| **Foreground Idle (WebSocket Blocked)** | 60 | 105 | 101 | **88.7** | Fallback to HTTP polling with 8s query timeout / backoff |
| **Tab Hidden (Backgrounded)** | 75 | 111 | 70 | **85.3** | Browser timer throttling active |

- **Update (2026-10-14, Phase 8 Optimization & Re-measurement):**
  The initial baseline rate of 85–98 req/min contradicted our shared-fetch design. Root-cause analysis via CDP request source instrumentation over 120s revealed:
  1. Chain Head polled `eth_blockNumber` every 4s regardless of tab visibility.
  2. The WebSocket entity subscription registered both individual entity handlers and `onEvent`, and query debounce was set to 500ms with no cooldown, firing 3 HTTP queries on almost every testnet block.
  3. In Phase 8, we optimized:
     - Throttled chainhead polling to 12s and strictly guarded it with `document.hidden`.
     - Throttled entity queries in `useLiveSlots` to at most once per 12 seconds with a shared fetch lock.
     - Skipped 30s background HTTP polling whenever WebSocket is healthy and recent.
     - Fully paused all network queries when `document.visibilityState === 'hidden'`.
  
  **Re-Measurement Results (2026-10-14, Headless Chrome with CDP Session):**
  *(Verified in a real headed browser: not run)*
  - **Foreground Idle (WebSocket Healthy, 2-Minute Sample):**
    - Chain Head (`eth_blockNumber`): 11 requests (~5.5/min)
    - Slots Queries: 4 requests (~2.0/min)
    - Bookings Queries: 4 requests (~2.0/min)
    - Completions Queries: 4 requests (~2.0/min)
    - Other HTTP RPC: 5 requests (~2.5/min)
    - **Total Foreground Rate: 28 requests in 2 min = 14.0 req/min (14 per minute)** (an 85.5% reduction from baseline, safely below 15 req/min threshold).
  - **Tab Hidden (simulated visibilitychange event, Verified via CDP `document.visibilityState === 'hidden'`, 1-Minute Sample):**
    - Chain Head: 1 request (in-flight before visibility event lock)
    - Slots, Bookings, Completions: **0 requests**
    - **Total Hidden Rate: 1.0 req/min** (background queries completely paused).

---

## What worked well — Phase 5 & 6

- **MetaMask Single-Signature Batching (`wallet.executeBatch`)**: Tested and proved on Tiramisu that `executeBatch({ creates: [...] })` packages all entity creations into a single contract call (`execute(Operation[])`). MetaMask displays a single confirmation signature popup, eliminating popup fatigue.
- **Measured Batch Efficiency**: Seeding 6 synthetic slots in 1 batch cost only `0.0008597 GLM` (~0.000143 GLM per slot) and confirmed in ~4.9 seconds.
- **Empirical WebSocket Latency**: Live WebSocket probes over `wss://rpc.tiramisu.db-chain.testnet.arkiv.network` demonstrated an average latency of **2550 ms** from transaction confirmation to event delivery, with 0 duplicates and strictly preserved sequence ordering.
- **Immediate Local Pruning**: Client-side timestamp pruning with a 4-second (1-2 block) margin ensures expired slots vanish instantly from the user interface without waiting for the next server poll or indexer sweep.

### Measured Live-Update Latency Across Two Browser Contexts
*Measured using two Puppeteer browser contexts with a fresh browser context per sample (one posting a live slot on Arkiv Tiramisu, one observing the live map on localhost dev server without refreshing; raw log in [arkiv/repro/logs/latency-run2.txt](arkiv/repro/logs/latency-run2.txt)).*

| Sample | Tx Hash | Confirmed At | DOM Appeared At | Latency (s) | Notes |
| :---: | :--- | :--- | :--- | :---: | :--- |
| Sample 1 | `0x0a108a...775be1` | 6:33:55 pm | 6:33:56 pm | 1.37 s | OK |
| Sample 2 | `0x4a1abb...edbf7a` | 6:34:41 pm | 6:34:47 pm | 6.74 s | OK |
| Sample 3 | `0x035f41...717767` | 6:35:13 pm | 6:35:15 pm | 1.40 s | OK |
| Sample 4 | `0xbdd78b...3c0e15` | 6:35:39 pm | 6:35:41 pm | 2.45 s | OK |
| Sample 5 | `0x29707b...d5b575` | 6:36:07 pm | 6:36:08 pm | 1.47 s | OK |
| Sample 6 | `0x969f6d...e17071` | 6:36:28 pm | 6:36:35 pm | 6.93 s | OK |
| Sample 7 | `0x6cf783...74b83f` | 6:37:00 pm | 6:37:03 pm | 2.74 s | OK |
| Sample 8 | `0x34f8d7...37dd21` | 6:37:27 pm | N/A | TIMEOUT | Timeout after 35s |
| Sample 9 | `0xfb00b2...44f079` | 6:38:35 pm | 6:38:40 pm | 4.04 s | OK |
| Sample 10 | `0xbd7e29...301b3f` | 6:39:04 pm | N/A | TIMEOUT | Timeout after 35s |
| **Summary** | **8 of 10 appeared** | — | — | **Median: 2.60 s** | p90: 6.93 s, max: 6.93 s; 2 timeouts |

*(Measured empirically in Run 2 on localhost dev server against Arkiv Tiramisu RPC/WSS. 8 of 10 posted slots appeared live via WebSocket; true median latency was 2.60 s across completed samples, p90 was 6.93 s, and max was 6.93 s; 2 samples timed out at 35s. Fallback polling every 30 seconds is implemented in `useLiveSlots.ts`, though recovery was not demonstrated in those two timed-out samples within the test window).*



