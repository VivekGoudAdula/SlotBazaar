# SlotBazaar — Arkiv Issues Ready to File

> Generated 2026-10-13. Paste each block directly into a GitHub issue on the Arkiv SDK repo.
> Only the 3 strongest, independently reproducible issues are listed.

---

## Issue 1: Uppercase attribute name throws generic EntityMutationError instead of InvalidAttributeNameError (FR-003)

**Title**: `createEntity` throws generic `EntityMutationError` on node-side simulation revert (`Ident32InvalidByte(0, 0x50)`); error message lists "A"-"Z" as allowed while rejecting uppercase

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

Run: `npx tsx arkiv/repro/fr003-uppercase-attribute.ts`

### Expected behaviour

`createEntity` should validate attribute names client-side before transaction simulation. When an attribute name violates the grammar, `InvalidAttributeNameError` (which is exported from `@arkiv-network/sdk`) should be thrown client-side.

### Actual behaviour

The transaction reverts during node-side `eth_estimateGas` simulation (`execute` reverted with `Ident32InvalidByte(0, 0x50)`). Zero gas is burned (0 wei) because the transaction is never broadcast via `eth_sendRawTransaction`. The SDK surfaces this node revert as a generic `EntityMutationError`:

```
EntityMutationError: Transaction failed: an attribute name holds "P" (0x50) at byte 0, which is outside the name charset ("A"-"Z", "a"-"z", "0"-"9", ".", "-" and "_", with a letter first)
```
Underlying cause:
```
The contract function "execute" reverted. Error: Ident32InvalidByte(uint256 position, bytes1 value) (0, 0x50)
```

Furthermore, there is a documentation / error-message inconsistency: the message explicitly states that `"A"-"Z"` is in the allowed name charset, yet it rejects byte `0x50` (`"P"`), which is an uppercase letter directly in `"A"-"Z"`.

### Severity

**Minor (DX / Error Typing & Message Consistency)** — 0 gas is consumed (simulation revert before broadcast). However, throwing `EntityMutationError` breaks expected error discrimination since `InvalidAttributeNameError` is documented and exported, and the error string contradicts itself regarding `"A"-"Z"`.

### Suggested fix

```ts
// Inside createEntity, before signing/simulation:
for (const [name] of Object.entries(attributes)) {
  validateAttributeName(name); // throws InvalidAttributeNameError synchronously
}
```

---

## Issue 2: Feature Request: Developer warning or type inference when query predicate type differs from stored attribute (FR-004)

**Title**: Feature Request: Diagnostic warning / strict mode when predicate type differs from stored attribute (e.g. `i32` against `u64` field)

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
    gt("ends_at", i32(Number(nowSec)))   // ← predicate type i32 vs stored u64
  ))
  .fetch();

console.log(page.entities.length); // 0 — returns 0 rows without diagnostic feedback
```

Reproduced twice on 2026-10-12. All entities are returned when queried with the matching `u64` type.

### Expected behaviour (Feature Suggestion)

In dynamic schema environments, type-strict matching is valid backend behavior, but developer experience is significantly improved if the SDK or indexer provides an optional dev-mode diagnostic warning:
- (A) An optional `strictTypes: true` flag that emits a console warning when comparing different numeric types (e.g. comparing `i32` with `u64`), OR
- (B) Clear documentation in the query guide emphasizing that predicate types must exactly mirror the stored attribute type.

### Actual behaviour

HTTP 200, empty `entities` array (`hasNextPage: false`). Because the index matches byte representations by type tag, queries return 0 rows silently without an error or warning.

### Severity

**Minor (DX Feature Request)** — The indexer is behaving according to strict typing rules; however, adding developer tooling warnings prevents silent user query mistakes during prototyping.

### Suggested fix

Add a query builder diagnostic check or add a prominent note in `@arkiv-network/sdk` documentation highlighting that numeric query predicates are strictly type-bound to stored attribute types.

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
