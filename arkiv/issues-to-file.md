# SlotBazaar — Arkiv Issues Ready to File

> Generated 2026-10-13. Paste each block directly into a GitHub issue on the Arkiv SDK repo.
> Only the 3 strongest, independently reproducible issues are listed.

---

## Issue 1: Uppercase attribute name silently burns gas before on-chain rejection (FR-003)

**Title**: `createEntity` should validate attribute name charset client-side before broadcasting transaction

**SDK version**: `@arkiv-network/sdk@0.8.1`  
**viem version**: `2.57.4`  
**Network**: Tiramisu testnet, chain ID 7738577  
**Node**: v22.15.1

### Steps to reproduce

```ts
import { createWalletClient, ExpirationTime, jsonToPayload } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str } from "@arkiv-network/sdk/attr";
import { http } from "viem";

const wallet = createWalletClient({ chain: tiramisu, transport: http(), account });

await wallet.createEntity({
  payload: jsonToPayload({ note: "test" }),
  contentType: "application/json",
  attributes: {
    ProjectName: str("test"),   // <-- uppercase P
    project: str("myapp"),
  },
  expires: ExpirationTime.fromMinutes(10),
});
```

Run: `npx tsx scripts/edge-probes.ts`

### Expected behaviour

`createEntity` should call `validateAttributeName(name)` before signing and submitting the transaction. An `InvalidAttributeNameError` should be thrown **client-side** with 0 gas consumed.

### Actual behaviour

The transaction is broadcast, included in a block, and **fails at the execution layer** with:

```
EntityMutationError: Transaction failed: an attribute name holds "P" (0x50) at byte 0,
which is outside the name charset ("A"–"Z", "a"–"z", "0"–"9", ".", "-" and "_", with a letter first)
```

A full transaction fee is charged for a statically invalid operation that can be caught without any network call.

### Severity

**High** — On a fee-bearing network this wastes real user funds. Client-side validation already exists (`validateAttributeName` is exported from the SDK) but is not applied inside `createEntity`.

### Suggested fix

```ts
// Inside createEntity, before signing:
for (const [name] of Object.entries(attributes)) {
  validateAttributeName(name); // throws InvalidAttributeNameError synchronously
}
```

---

## Issue 2: `select().where()` with type-mismatched predicate silently returns 0 results (FR-004)

**Title**: Range query with wrong numeric type (e.g. `i32` against `u64` field) succeeds with HTTP 200 and returns 0 rows — no error, no warning

**SDK version**: `@arkiv-network/sdk@0.8.1`  
**viem version**: `2.57.4`  
**Network**: Tiramisu testnet, chain ID 7738577

### Steps to reproduce

```ts
import { createPublicClient } from "@arkiv-network/sdk";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { str, u64, i32 } from "@arkiv-network/sdk/attr";
import { eq, gt, and } from "@arkiv-network/sdk/query";
import { http } from "viem";

const client = createPublicClient({ chain: tiramisu, transport: http() });
const nowSec = BigInt(Math.floor(Date.now() / 1000));

// ends_at stored as u64 — but querying with i32:
const page = await client
  .select()
  .where(and(
    eq("project", str("myapp")),
    gt("ends_at", i32(Number(nowSec)))   // ← wrong type: i32 vs u64
  ))
  .fetch();

console.log(page.entities.length); // 0 — should return many entities
```

Reproduced twice on 2026-10-12. All entities remain in the index when queried with the correct `u64` type.

### Expected behaviour

Either:
- (A) A client-side or server-side error indicating the type mismatch, OR
- (B) A diagnostic warning in dev mode that the predicate type does not match the indexed field type.

### Actual behaviour

HTTP 200, empty `entities` array, `hasNextPage: false`. The caller receives zero results with no indication that the query parameters are wrong. Silent data loss.

### Severity

**High** — Developers who accidentally use `i32` for a timestamp field get 0 results with no feedback. This is an invisible data correctness bug.

### Suggested fix

If attribute schemas are indexed, validate predicate types at query construction time and emit a dev-mode warning (or throw) when types don't match.

---

## Issue 3: `InvalidPredicateError` is not exported from the main `@arkiv-network/sdk` entry point (FR-001)

**Title**: `InvalidPredicateError` missing from root package export — must import from undocumented subpath

**SDK version**: `@arkiv-network/sdk@0.8.1`

### Steps to reproduce

```ts
import { InvalidPredicateError } from "@arkiv-network/sdk"; // ← fails
```

```
SyntaxError: The requested module '@arkiv-network/sdk' does not provide
an export named 'InvalidPredicateError'
```

Workaround: import from subpath `"@arkiv-network/sdk/query"`.

All other error classes (`InvalidValueError`, `InvalidAttributeNameError`, `EntityMutationError`, `NoEntityFoundError`) are available from the root entry point. `InvalidPredicateError` is the only exception.

### Expected behaviour

```ts
import { InvalidPredicateError } from "@arkiv-network/sdk"; // ← should work
```

### Actual behaviour

`SyntaxError` at import time. Requires `import { InvalidPredicateError } from "@arkiv-network/sdk/query"`.

### Severity

**Low / DX papercut** — breaks the symmetry of the error export surface and forces developers to know about the `/query` subpath.

### Suggested fix

Add `InvalidPredicateError` to the root `dist/index.d.ts` and `dist/index.js` re-exports.
