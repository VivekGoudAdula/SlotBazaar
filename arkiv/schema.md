# SlotBazaar — Arkiv Entity Schema (current, v2)

> **Namespace:** `project="slotbazaar"`  
> **Network:** Arkiv Tiramisu Testnet (`chainId: 7738577` / `0x7614d1`)  
> **Specification Status:** LOCKED (Schema v2)

---

## 1. Architectural Principles

1. **Arkiv is the Sole Decentralized Data Layer**:
   - Zero centralized database (no Postgres, MongoDB, or Firebase).
   - Zero custom backend API servers.
   - All state is read directly from and written directly to Arkiv Tiramisu.
2. **Immutable Append-Only Records**:
   - Entities are never mutated on-chain.
   - Booking a slot creates an independent `booking` entity referencing `slot_key`.
   - Confirming job fulfillment creates independent `completion` entities referencing `booking_key`.
3. **Indexed Typed Attributes vs. Unindexed Payload**:
   - `attributes`: Typed metadata fields evaluated in query predicates (`eq`, `gt`).
   - `payload`: Opaque UTF-8 JSON containing human-readable titles, descriptions, and notes.
4. **Autonomous Protocol Expiration**:
   - Slots expire at their exact `ends_at` Unix timestamp via `ExpirationTime.atDate(new Date(endsAt * 1000))`. The chain purges them automatically at the consensus level.
   - Bookings and completions persist for **30 days** (`ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))`), ensuring counterparty verification and dispute resolution outlive short-duration slots.
5. **Cryptographic Authentication (`$creator`)**:
   - Entity creator address is verified directly from the EVM transaction signature, preventing impersonation.

---

## 2. Entity Specifications

### A. `slot` (Expiring Available Industrial Capacity)

Represents an available machine hour, freight capacity, or engineering sprint.

| Attribute | Type | Description & Value | Notes |
|---|---|---|---|
| `project` | `str` | `"slotbazaar"` | Partition namespace |
| `entity_type` | `str` | `"slot"` | Discriminant |
| `schema_v` | `str` | `"2"` (or `"1"` legacy) | Schema version |
| `category` | `str` | `"machine"` \| `"transport"` \| `"freelance"` | Category filter |
| `cluster` | `str` | Industrial hub (e.g. `"jeedimetla"`, `"surat"`) | Cluster filter |
| `starts_at` | `u64` | Unix timestamp in seconds | Slot start window |
| `ends_at` | `u64` | Unix timestamp in seconds | Slot end window; determines expiry |
| `price_band` | `str` | `"low"` \| `"mid"` \| `"high"` | Price tier |
| `lat_e4` | `i32` | Latitude × 10 000 | **Display attribute only** (no geo-range query is used) |
| `lon_e4` | `i32` | Longitude × 10 000 | **Display attribute only** (no geo-range query is used) |
| `synthetic` | `bool` | `true` for demo/seed data, `false` for user slots | Test filter |

> **Geo-Attributes Note:** `lat_e4` and `lon_e4` are stored as signed 32-bit integers for map coordinate placement and client-side distance calculation. **No server-side geo-range query is used**; listings are queried by cluster tag (`cluster`) and active time (`gt("ends_at", u64(nowSec))`), and coordinates are rendered as Leaflet map pins.

#### Payload Schema (`application/json`)
```json
{
  "title": "string (1-60 chars)",
  "description": "string (max 280 chars)",
  "seller_label": "string (business or trade name)",
  "schema_version": 2
}
```

#### Expiration Rule
- `expires: ExpirationTime.atDate(new Date(ends_at * 1000))` (set to `ends_at` timestamp).

---

### B. `booking` (Buyer Capacity Claim)

Created when a buyer reserves an available slot. Records on-chain metadata from the live slot to ensure permanence post slot expiry.

| Attribute | Type | Description & Value | Notes |
|---|---|---|---|
| `project` | `str` | `"slotbazaar"` | Partition namespace |
| `entity_type` | `str` | `"booking"` | Discriminant |
| `schema_v` | `str` | `"2"` | Schema version |
| `slot_key` | `key` | Entity key of target slot (`0x...`) | Foreign key to slot |
| `slot_creator` | `str` | Address of seller (lowercase hex) | Copied from live on-chain slot |
| `slot_starts_at` | `u64` | Unix timestamp in seconds | Copied from live on-chain slot |
| `slot_ends_at` | `u64` | Unix timestamp in seconds | Copied from live on-chain slot |
| `booked_at` | `u64` | Unix timestamp in seconds | Timestamp of booking creation |
| `synthetic` | `bool` | `true` for mock bookings | Test filter |

#### Payload Schema (`application/json`)
```json
{
  "note": "string (optional buyer requirement, max 500 chars)",
  "schema_version": 2
}
```

#### Expiration Rule
- `expires: ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))` (30-day lifecycle).

#### Winning Booking Resolution
- Earliest block number wins (`createdAtBlock` ascending).
- Same-block tie-breaker: Lexicographical order of `entityKey` ascending (`a.key.toLowerCase().localeCompare(b.key.toLowerCase())`).

---

### C. `completion` (Mutual Fulfillment Receipt)

Submitted by seller and buyer to confirm that the booked job was completed satisfactorily.

| Attribute | Type | Description & Value | Notes |
|---|---|---|---|
| `project` | `str` | `"slotbazaar"` | Partition namespace |
| `entity_type` | `str` | `"completion"` | Discriminant |
| `schema_v` | `str` | `"2"` | Schema version |
| `booking_key` | `key` | Entity key of the winning booking (`0x...`) | Foreign key to booking |
| `role` | `str` | `"seller"` or `"buyer"` | Confirmed role |
| `completed_at` | `u64` | Unix timestamp in seconds | Confirmation timestamp |
| `synthetic` | `bool` | `true` for mock completions | Test filter |

#### Payload Schema (`application/json`)
```json
{
  "note": "string (optional review note, max 500 chars)",
  "schema_version": 2
}
```

#### Expiration Rule
- `expires: ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))` (30-day lifecycle, matching booking).

---

## 3. Two-Sided Cryptographic Reputation Rule

An account receives **+1 Verified Job** reputation point if and only if:
1. **Winning Booking Exists**: A booking entity points to the slot, confirmed in the earliest block (with deterministic key tie-break), and `booking.creator !== booking.slot_creator` (rejects self-booking fraud).
2. **Seller Confirmation**: A completion entity with `booking_key = winningBooking.key` and `role = "seller"` was signed by `booking.slot_creator`.
3. **Buyer Confirmation**: A completion entity with `booking_key = winningBooking.key` and `role = "buyer"` was signed by `winningBooking.creator`.
4. **Temporal Integrity**: Neither completion timestamp occurred prior to `slot_starts_at`.
5. **Deduplication**: Duplicate completions by the same role do not double-count.

---

## 4. Standard UI Queries

### 1. Fetch All Live Active Slots
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot")),
    gt("ends_at", u64(nowSec))
  ))
  .fetch();
```

### 2. Fetch Live Slots Filtered by Cluster
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot")),
    eq("cluster", str(clusterName)),
    gt("ends_at", u64(nowSec))
  ))
  .fetch();
```

### 3. Fetch Bookings for a Slot
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("booking")),
    eq("slot_key", key(slotKey))
  ))
  .fetch();
```

### 4. Fetch Completions for a Slot (Two-Step Workflow via `booking_key`)
Because Schema v2 completions link to the specific `booking_key` (enabling post-slot expiry confirmation), the UI queries completions through the winning booking:
```ts
// Step 1: Query all bookings referencing the slot key
const bookingsResult = await client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("booking")),
    eq("slot_key", key(slotKey))
  ))
  .fetch();

const bookings = bookingsResult.entities.map(parseBookingEntity).filter(Boolean);
const winningBooking = getWinningBooking(bookings);

// Step 2: Query completions referencing the winning booking_key
if (winningBooking) {
  const completionsResult = await client.select()
    .where(and(
      eq("project", str("slotbazaar")),
      eq("entity_type", str("completion")),
      eq("booking_key", key(winningBooking.key))
    ))
    .fetch();
  const completions = completionsResult.entities.map(parseCompletionEntity).filter(Boolean);
}
```
*(Alternatively, in the full dashboard, `fetchAllCompletions()` loads completions in a single batched query to compute reputation scores across all accounts with zero N+1 overhead).*

---

## 5. Protocol & Architecture Limitations

| # | Limitation | Impact | Mitigation / Status |
|---|---|---|---|
| **L-001** | **Post-expiry reputation derivation** | In Schema v1, completions referenced `slot_key`. Once the slot expired, its creator could not be looked up from Arkiv, preventing post-expiry reputation counting. | **Resolved by Schema v2**: The `booking` entity copies `slot_creator`, `slot_starts_at`, and `slot_ends_at` at creation time. Both `booking` and `completion` entities live for 30 days, allowing full cryptographic verification long after the short-duration slot has expired. |
| **L-002** | **No server-side ordering** | Arkiv's query language does not support `orderBy`. | Handled client-side in TypeScript: `useLiveSlots` fetches results and sorts by `ends_at` ascending or block number. |
| **L-003** | **Query expiration semantics at block boundary** | If an application adds `gt("ends_at", u64(nowSec))`, a 1–2 block gap can occur due to client clock vs block timestamp differences. Retested in Phase 9: without an `ends_at` range filter, the query index drops entities at the exact consensus `expiresAt` block (0 blocks early). | The UI applies a proactive 1-second client ticker with a 4-second (1–2 block) margin to smoothly synchronize UI state with consensus. |
| **L-004** | **Client-side tie-break rule** | Intra-block ordering is not provided by Arkiv attributes. | Deterministic tie-breaker in `getWinningBooking` sorts by earliest block number, then lexicographical entity key ascending. |
| **L-005** | **Positional call signature in `getEntity`** | Passing `{ key }` object threw `Invalid key value` error. Retested in Phase 9: passing positional `getEntity(entityKey)` succeeds cleanly on all live entities and throws `NoEntityFoundError` after expiry. | FR-011 was withdrawn as our own call-shape error. Positional call `publicClient.getEntity(entityKey)` works as documented. |

---

## 6. Code Constants vs Documented Specification

Every parameter documented in this specification matches the active codebase constants exactly:

| Parameter | Documented Value | Code Constant | Source File & Line |
|---|---|---|---|
| **Min Slot Duration** | 15 minutes (`900s`) | `MIN_DURATION_SEC = 15 * 60` | `src/lib/slotValidation.ts:39` |
| **Max Slot Duration** | 7 days (`604,800s`) | `MAX_DURATION_SEC = 7 * 86400` | `src/lib/slotValidation.ts:40` |
| **Slot Expiry** | `ends_at` Unix seconds | `ExpirationTime.atDate(new Date(endsAt * 1000))` | `src/lib/arkiv.ts:1099` |
| **Booking Expiry** | 30 days (`2,592,000s`) | `30 * 86400 * 1000` ms | `src/lib/arkiv.ts:1157` |
| **Completion Expiry** | 30 days (`2,592,000s`) | `30 * 86400 * 1000` ms | `src/lib/arkiv.ts:1222` |
| **Real Batch Write Limit** | 20 slots per tx | `REAL_BATCH_LIMIT = 20` | `src/components/SeedModal.tsx:38` |
| **Max Live Synthetic Cap** | 40 slots | `MAX_LIVE_SYNTHETIC_CAP = 40` | `src/components/SeedModal.tsx:37` |
| **Pure Unit Test Count** | 44 tests | 21 Phase 4 + 23 Phase 5 | `scripts/test-phase4-unit.ts`, `scripts/test-phase5-unit.ts` |
| **Tiramisu Decimal Chain ID** | `7738577` | `tiramisu.id` | `src/lib/wallet.ts:24` |
| **Tiramisu Hex Chain ID** | `0x7614d1` | `0x${tiramisu.id.toString(16)}` | `src/lib/wallet.ts:25` |
