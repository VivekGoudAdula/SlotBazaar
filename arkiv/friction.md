# SlotBazaar — Arkiv Friction Log

> Append-only. Template: FR-NNN · Title / Date / Phase / SDK+network / Expected / Actual / Reproduce / Severity / Workaround / Fix suggestion / Issue link.
>
> Rules: Only log things reproduced at least twice. Include exact error text. Factual and constructive, not complaining.

---

## Environment (Phase 0)

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
  The main `@arkiv-network/sdk` index (`dist/index.d.ts`) re-exports many symbols including error classes. Based on the pattern of other error classes (`InvalidValueError`, `InvalidAttributeNameError`, `EntityMutationError`) being in the main export, I expected `InvalidPredicateError` to also be there.
- **What actually happened (exact error text or output):**  
  ```
  SyntaxError: The requested module '@arkiv-network/sdk' does not provide an export named 'InvalidPredicateError'
  ```
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  import { InvalidPredicateError } from "@arkiv-network/sdk";
  // → SyntaxError at runtime
  ```
  Run twice: `npx tsx scripts/query-slots.ts` on 2026-10-12 (first and second attempt before fix).
- **Severity:** minor
- **Workaround used:**  
  Import from the subpath: `import { InvalidPredicateError } from "@arkiv-network/sdk/query"`
- **Suggested fix:**  
  Re-export `InvalidPredicateError` from the main package index alongside the other error classes, or document clearly in the main entry point which subpath each class lives in.
- **Upstream issue link:** (not filed)

---

### FR-002 · `BigInt` attribute values (u64) serialise to `[object Object]` / throw via `JSON.stringify`

- **Date/time (IST):** 2026-10-12, ~20:53 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  Attribute value objects (`U64Value` = `{ type: "u64", value: bigint }`) would be inspectable with `JSON.stringify` for debug logging, as the shape looks like a plain object.
- **What actually happened (exact error text or output):**  
  ```
  TypeError: Do not know how to serialize a BigInt
      at JSON.stringify (<anonymous>)
      at anonymous (scripts/hello-slot.ts:89:59)
  ```
- **Steps to reproduce:**
  ```ts
  const attrs = { ends_at: u64(1791829419n) }
  JSON.stringify(attrs)  // throws: "Do not know how to serialize a BigInt"
  ```
  Reproduced twice on 2026-10-12 during first and second `hello-slot.ts` runs.
- **Severity:** papercut
- **Workaround used:**  
  Pass a custom `replacer` to `JSON.stringify`:  
  ```ts
  JSON.stringify(attrs, (_k, v) => typeof v === "bigint" ? v.toString() : v)
  ```
- **Suggested fix:**  
  Add a `.toString()` or `.toJSON()` method to `U64Value` / `U256Value` so they serialise naturally. Alternatively, document this gotcha prominently in the "working with attributes" section of the docs.
- **Upstream issue link:** (not filed)

---

### FR-003 · Uppercase attribute name rejected by network (not client-side)

- **Date/time (IST):** 2026-10-12, ~21:25 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected (cite the doc page or type declaration):**  
  The SDK exports `InvalidAttributeNameError` (visible in `dist/index.d.ts`) and `validateAttributeName()`. I expected attribute names with uppercase letters to be caught **client-side** before any transaction is sent, because the SDK has the validation machinery already.
- **What actually happened (exact error text or output):**  
  ```
  EntityMutationError: Transaction failed: an attribute name holds "P" (0x50) at byte 0, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)
  ```
  The error came back from the **network** (as `EntityMutationError`, which carries a `txHash`), meaning GLM gas was consumed for a transaction that failed.
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  await wallet.createEntity({
    payload: jsonToPayload({ note: "test" }),
    contentType: "application/json",
    attributes: { ProjectName: str("test"), project: str("slotbazaar") },
    expires: ExpirationTime.fromMinutes(10),
  });
  // → EntityMutationError (network-level rejection)
  ```
  Reproduced twice on 2026-10-12 in `edge-probes.ts`.
- **Severity:** major — consumes GLM gas for a preventable error; on mainnet this would be costly
- **Workaround used:**  
  Manually ensure all attribute names are lowercase snake_case before calling `createEntity`.
- **Suggested fix:**  
  Call `validateAttributeName()` for every key in `attributes` inside the SDK's `createEntity` implementation before signing/sending the transaction. The validation function exists in the SDK already. This would change the error from `EntityMutationError` to `InvalidAttributeNameError` and prevent wasted gas.
- **Upstream issue link:** (not filed)

---

### FR-004 · Wrong number type in range query silently returns 0 results

- **Date/time (IST):** 2026-10-12, ~21:25 IST
- **Phase:** 0
- **SDK + network versions:** `@arkiv-network/sdk@0.8.1`, viem `2.57.4`, Tiramisu testnet, chain ID `7738577`
- **What I expected:**  
  Querying a `u64` attribute (`ends_at`) with a range operator using a `i32` typed value should fail with a type error — either client-side (`UnsupportedOperatorError` or similar) or server-side (`QueryError` with `kind="type"`). The docs and `UnsupportedOperatorError` JSDoc confirm there is an operator × type matrix.
- **What actually happened (exact error text or output):**  
  No error was thrown. The query executed, returned 0 results, and `hasNextPage()` = false. The mismatch was silent.  
  (Exact output):
  ```
  ⚠️ No error thrown — succeeds with potentially wrong results
  → 0 entities on this page
  → hasNextPage: false
  → cursor: (none)
  → blockNumber: 484473
  ```
- **Steps to reproduce (exact commands/code, minimal):**
  ```ts
  // ends_at was written as u64, but queried with i32
  await client.select()
    .where(and(
      eq("project", str("slotbazaar")),
      gt("ends_at", i32(nowSec))    // i32 vs stored u64
    ))
    .fetch()
  // → succeeds, 0 results, no error
  ```
  Reproduced twice in `query-slots.ts` on 2026-10-12.
- **Severity:** major — this is a silent data integrity issue. Developers get wrong results instead of an error, and may not notice.
- **Workaround used:**  
  Manually ensure the query type exactly matches the write type. Maintain a schema doc (which we do in `/arkiv/schema.md`).
- **Suggested fix:**  
  Two options:  
  1. The SDK could check whether the typed value's `type` tag is compatible with the field's stored type (if the entity schema has been fetched once).  
  2. At minimum, add a prominent warning in the "Querying Data" docs: "Range queries on u64 attributes must use u64() values — using i32() silently returns 0 results."
- **Upstream issue link:** (not filed)

---

## What worked well — Phase 0

- **`ExpirationTime` API is clean and ergonomic**: `atDate()`, `fromMinutes()`, `fromDays()` cover all use cases naturally. The fact that `atDate()` rounds up to the nearest block (rather than failing) is excellent UX.
- **`executeBatch` with multiple creates works out of the box**: Two entities in one tx, returned as a keyed array — exactly as documented.
- **`InvalidValueError` for >128-byte strings is client-side**: The error is caught before any transaction is sent, saving gas. The error message even suggests putting the value in the payload instead.
- **`SelectQueryBuilder` chainable API is pleasant**: `.select().where(...).createdBy(...).limit(100).fetch()` flows naturally and the TypeScript types narrow correctly.
- **`createdBy()` and `ownedBy()` are real builder methods**: Not just docs — actually in the type declarations with JSDoc.
- **Entity creation is fast**: ~4 seconds from call to confirmed tx on Tiramisu testnet.
- **Block explorer link works**: `https://tiramisu.explorer.arkiv.network/tx/<hash>` loads correctly.
- **`getEntity` immediately after create works**: No indexing delay observed — the entity is queryable in the same block.
