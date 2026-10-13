# Arkiv SDK Notes — Phase 0

> **Ground-truth source**: installed `@arkiv-network/sdk@0.8.1` type declarations in `node_modules`,
> cross-referenced against docs at https://docs.arkiv.network  
> **Date**: 2026-10-12 (IST)

---

## Environment

| Package | Installed Version |
|---------|-------------------|
| `@arkiv-network/sdk` | `0.8.1` |
| `viem` | `2.57.4` |
| `tsx` | `4.23.15` |
| `typescript` | `6.0.3` |
| Network | Tiramisu testnet |
| Chain ID | `7738577` |

---

## 1. Client Creation

### Public client (read-only, no signing)

```ts
import { createPublicClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http } from "viem"

const publicClient = createPublicClient({
  chain: tiramisu,
  transport: http(),       // defaults to tiramisu RPC; or pass http("https://rpc.tiramisu…")
})
```

### Wallet client (for writes — scripts use privateKeyToAccount, browser uses MetaMask)

```ts
import { createWalletClient } from "@arkiv-network/sdk"
import { tiramisu } from "@arkiv-network/sdk/chains"
import { http } from "viem"
import { privateKeyToAccount } from "viem/accounts"

const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`)

const walletClient = createWalletClient({
  chain: tiramisu,
  transport: http(),
  account,
})
```

**Note**: The type signatures live in `dist/index.d.ts`. Both clients are re-exported from the root
`@arkiv-network/sdk` import — no separate subpath needed for client creation.

---

## 2. `createEntity`

Signature (from `dist/index.d.ts`):

```ts
createEntity(
  data: CreateEntityParameters,
  txParams?: TxParams
): Promise<CreateEntityReturnType>
```

`CreateEntityParameters`:

```ts
{
  payload: Uint8Array           // use jsonToPayload({}) or stringToPayload("")
  contentType: string           // "application/json" or "text/plain"
  expires: Expiry               // MUST use ExpirationTime helper — cannot construct manually
  attributes?: Record<string, AnyArkivValue>   // typed attribute values
  salt?: SaltInput              // optional; random by default
}
```

`CreateEntityReturnType`:

```ts
{
  entityKey: Hex    // bytes32 key
  txHash: Hex       // transaction hash
  expiresAt: bigint // block number the entity expires at
}
```

**Key insight**: `expires` is an `Expiry` type with a unique brand symbol — **cannot be constructed
with a plain object**. Must use `ExpirationTime` helpers.

---

## 3. `ExpirationTime` helpers (from `dist/payload-AfUfSctb.d.ts`)

```ts
import { ExpirationTime } from "@arkiv-network/sdk"

ExpirationTime.fromSeconds(seconds: number)   // must be multiple of block time (2s)
ExpirationTime.fromMinutes(minutes: number)
ExpirationTime.fromHours(hours: number)
ExpirationTime.fromDays(days: number)
ExpirationTime.fromWeeks(weeks: number)
ExpirationTime.fromMonths(months: number)     // 1 month = 30 days
ExpirationTime.fromYears(years: number)       // 1 year = 365 days
ExpirationTime.fromBlocks(blocks: number)
ExpirationTime.atBlock(block: bigint, options?: DeadlineOptions)
ExpirationTime.atDate(date: Date, options?: DeadlineOptions)
ExpirationTime.permanent()                    // atBlock(MAX_EXPIRES_AT)
```

**For SlotBazaar**: We use `ExpirationTime.atDate(slotEndDate)` to set Entity Expiration = slot end time.

**Short-lived test entity**: `ExpirationTime.fromMinutes(10)` (smallest available in docs;
actual minimum = 2 seconds since block time = 2s → `fromSeconds(2)` could work).

---

## 4. Attribute Type Constructors (from `dist/index.d.ts` and `dist/attr/`)

```ts
import { str, u64, i32, bool, addr, u256, bytes32, dec, key } from "@arkiv-network/sdk"
// OR import from "@arkiv-network/sdk/attr"

str("hello")          // StrValue    — max 128 bytes UTF-8
u64(12345n)           // U64Value    — bigint, 0 to 2^64-1 (Note: no native u64 in JS, use bigint)
i32(-5)               // I32Value    — number, -2^31 to 2^31-1  (supports negatives)
bool(true)            // BoolValue
addr("0xabc...")      // AddrValue
u256(999999n)         // U256Value   — bigint
bytes32("0x...")      // Bytes32Value
dec(1.5)              // DecValue    — fixed-point decimal
key("0x...")          // KeyValue    — entity key reference
```

**Critical**: Plain JS values (string, number) are NOT accepted — must use typed constructors.
Exception: the docs show `attributes: { testKey: "testValue" }` as passing a plain string — need to
verify whether plain strings are auto-wrapped or must use `str()`.

**SlotBazaar attribute types**:
- `project="slotbazaar"` → `str("slotbazaar")`
- `entity_type="slot"` → `str("slot")`
- `category="machine"` → `str("machine")`
- `cluster="surat"` → `str("surat")`
- `starts_at` → `u64(BigInt(Math.floor(Date.now()/1000)))`
- `ends_at` → `u64(BigInt(Math.floor(endTime.getTime()/1000)))`
- `price_band="mid"` → `str("mid")`
- `lat_e4` → `i32(latDegrees * 10000)`  ← NOTE: negative values supported by i32!
- `lon_e4` → `i32(lonDegrees * 10000)`
- `synthetic=true` → `bool(true)`

---

## 5. `getEntity`

```ts
const entity = await publicClient.getEntity(entityKey: Hex)
// Returns: FullEntity
// entity.toJson()  — parses payload as JSON
// entity.toText()  — decodes payload as UTF-8 text
// entity.attributes — Record<string, { type: string; value: ... }>
// entity.expiresAt — bigint (block number)
// entity.creator  — Hex (wallet that created it, immutable)
// entity.owner    — Hex (current owner, mutable)
```

Throws `NoEntityFoundError` if expired, deleted, or never existed.

---

## 6. Query: `select().where().fetch()`

```ts
import { eq, gt, gte, lt, lte, ne, and, or, not, exists, hasType } from "@arkiv-network/sdk/query"
// OR from "@arkiv-network/sdk" — both re-export same symbols

// Full select (typed as FullEntity[])
const result = await publicClient.select().where(eq("project", "slotbazaar")).fetch()

// Projected select
const result = await publicClient
  .select({ key: true, attributes: true })
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot"))
  ))
  .fetch()

// result.entities: Entity[]
// result.hasNextPage(): boolean
// result.fetchNextPage(): Promise<QueryResult>
// result.cursor: string  (for pagination)
```

**RULES**:
- At least one filter required (where / ownedBy / createdBy) — else error
- `where()` ANDs predicates when called multiple times
- Max 200 results per page — check `hasNextPage()`
- **No server-side ordering** — sort on client
- Number types must match between write and query (write u64, query with u64)

**Filter by creator**:

```ts
await publicClient
  .select()
  .createdBy(address)
  .fetch()
```

**Range filter on u64 timestamp**:

```ts
import { u64 } from "@arkiv-network/sdk"
const nowSec = BigInt(Math.floor(Date.now() / 1000))
await publicClient
  .select()
  .where(and(
    eq("project", str("slotbazaar")),
    gt("ends_at", u64(nowSec))   // must use u64() wrapper, not plain number/bigint
  ))
  .fetch()
```

---

## 7. Expiry behaviour (from type declarations and docs)

- `expiresAt` on the entity is a **block number** (bigint), not a timestamp
- Once the block passes, the entity disappears from all queries and `getEntity` throws `NoEntityFoundError`
- There is no separate "expiry" event polling endpoint — must repeatedly call `getEntity` or run queries
- `watchEntityEvents` with `onEntityDeleted` fires on expiry events

---

## 8. `jsonToPayload` / `stringToPayload`

```ts
import { jsonToPayload, stringToPayload } from "@arkiv-network/sdk"

// JSON payload (recommend for SlotBazaar)
const payload = jsonToPayload({ title: "CNC Machine", description: "4hr block available" })
// contentType must be "application/json" to use entity.toJson()

// Text payload
const payload = stringToPayload("hello")
// contentType must be "text/plain"
```

---

## 10. Injected Provider / MetaMask Browser Pattern (Verified in Phase 3)

The installed `@arkiv-network/sdk@0.8.1` builds wallet clients using standard Viem client composition:

```ts
import { createWalletClient } from "@arkiv-network/sdk"; // re-exported from viem
import { tiramisu } from "@arkiv-network/sdk/chains";
import { custom } from "viem";

// Injected provider from EIP-6963 discovery or window.ethereum
const provider = window.ethereum;
const accounts = await provider.request({ method: "eth_requestAccounts" });

const walletClient = createWalletClient({
  chain: tiramisu,
  transport: custom(provider),
  account: accounts[0] as `0x${string}`,
});
```

### Verified Properties
1. **EIP-6963 Compatibility**: Works seamlessly with modern multi-wallet discovery events (`eip6963:announceProvider` / `eip6963:requestProvider`) and legacy `window.ethereum`.
2. **Transaction Signing**: Calls to `walletClient.createEntity(...)` automatically trigger MetaMask's confirmation popup (`eth_sendTransaction`), correctly computing gas and prompt parameters.
3. **Chain ID**: Must be verified as `7738577` (hex: computed in code as `"0x" + Number(7738577).toString(16)`); `wallet_switchEthereumChain` and fallback `wallet_addEthereumChain` (on error 4902) handle network alignment cleanly.

