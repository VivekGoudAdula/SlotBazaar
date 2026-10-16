# SlotBazaar — Arkiv Entity Schema (current, v3)

> **Namespace:** `project="slotbazaar"`  
> **Network:** Arkiv Tiramisu Testnet (`chainId: 7738577` / `0x7614d1`)  
> **Specification Status:** LOCKED (Schema v3)

---

## 1. Architectural Principles

1. **Arkiv is the Sole Decentralized Data Layer**:
   - Zero centralized database (no Postgres, MongoDB, or Firebase).
   - Zero custom backend API servers.
   - All state is read directly from and written directly to Arkiv Tiramisu.
2. **Protocol-Enforced Immutable Records & Creation Flags**:
   - Entities are protected at the Arkiv protocol level using `flags`:
     - **Slot Listings**: Created with `flags: { readonly: true }` (`schema_v: "2"`). Attributes and payload cannot be altered after creation. Read-only records can still be cancelled/deleted or expired autonomously by block consensus.
     - **Booking Snapshots**: Created with `flags: { readonly: true, permissionlessExtension: true }` (`schema_v: "3"`). Counterparty claims are cryptographically fixed upon submission, and permissionless extension guarantees anyone can preserve the proof set.
     - **Completion Evidence**: Created with `flags: { readonly: true, permissionlessExtension: true }` (`schema_v: "3"`). Receipts are immutable, but anyone may extend their on-chain storage lifetime to guarantee perpetual cryptographic evidence availability.
   - *On-Chain Proof Verification:* The application inspects the actual `creationFlags` returned from the Arkiv node on fetched entities (`slot.creationFlags.readonly`), never inferring flags from client constants.
3. **Indexed Typed Attributes vs. Unindexed Payload**:
   - `attributes`: Typed metadata fields evaluated in query predicates (`eq`, `gt`).
   - `payload`: Opaque UTF-8 JSON containing human-readable titles, descriptions, and notes.
4. **Autonomous Protocol Expiration & Demonstrable Lifecycle**:
   - *UI Countdown:* A prominent visual timer in the client displaying time remaining until `ends_at`.
   - *Visual Lifecycle Stages:* Transitions visibly from **🟢 Active** (>15m) → **🔴 Expiring soon** (≤15m) → **⚫ Expired** (≤0s).
   - *Client-Side Availability Pruning:* `useLiveSlots.ts` proactively prunes ended listings (with a 4s margin matching 2 blocks) to prevent booking attempts on dead capacity, triggering queries refresh.
   - *Consensus Expiration:* Slots are created with `expires: ExpirationTime.atDate(new Date(endsAt * 1000))`. The Arkiv consensus engine autonomously cleans up expired records at block boundaries without external cron jobs.
   - *History Preservation & Extension:* Bookings and completions persist for **30 days** by default. Completed job proof sets (booking + seller completion receipt + buyer completion receipt) can be permissionlessly extended for another 60 days via `extendJobProof()`. Older bookings without `permissionlessExtension` can only be extended by their `$owner`.
5. **Cryptographic Authentication, Ownership & Transferability**:
   - `$creator`: Immutable address derived from the transaction signature at creation.
   - `$owner`: Current owner of the entity. Supports owner-initiated `changeOwnership()` to transfer custodial control to another wallet while preserving `$creator` provenance permanently.

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

Created when a buyer reserves an available slot. Records on-chain metadata from the live slot to ensure permanence post slot expiry. Created with `flags: { readonly: true, permissionlessExtension: true }` and `schema_v: "3"`.

| Attribute | Type | Description & Value | Notes |
|---|---|---|---|
| `project` | `str` | `"slotbazaar"` | Partition namespace |
| `entity_type` | `str` | `"booking"` | Discriminant |
| `schema_v` | `str` | `"3"` (or legacy `"2"`) | Schema version |
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
  "schema_version": 3
}
```

#### Creation Flags & Expiration Rule
- `flags: { readonly: true, permissionlessExtension: true }`
- `expires: ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))` (30-day lifecycle).

#### Winning Booking Resolution & Concurrency Guarantee
- A slot may have at most one active booking. Capacity windows are strictly single-use; once booked or completed, the capacity window cannot be re-booked.
- **Client Preflight Check**: Before creating a booking, the client calls `fetchBookingsForSlot(slotKey)`. If an active booking exists, creation is immediately rejected (`CONCURRENT_SUBMISSION`). Self-booking by the slot creator or current owner is prohibited. Bookings on expired slots (`endsAt <= nowSec`) are rejected.
- **Consensus Arbitration (Residual In-Flight Race)**: Arkiv SDK does not provide an atomic cross-wallet compare-and-set or uniqueness constraint on `slot_key`. If two wallets sign and broadcast bookings concurrently before either is indexed:
  1. Earliest block number wins (`createdAtBlock` ascending).
  2. Same-block tie-breaker: Lexicographical order of `entityKey` ascending (`a.key.toLowerCase().localeCompare(b.key.toLowerCase())`).
  3. Only the winning booking qualifies for two-sided completion and verified on-chain reputation. Any losing booking entity remains unconfirmed and cannot trigger completion receipts.

#### Derived Booking State
The UI computes canonical derived state via `getSlotBookingStatus`:
- `AVAILABLE`: Active slot (`endsAt > nowSec`) with no active bookings.
- `BOOKED`: Active booking exists on Arkiv referencing this slot key. Booking is disabled for all wallets.
- `EXPIRED`: Current time past `ends_at` (`endsAt <= nowSec`). Booking is disabled for all wallets.
- `COMPLETED`: Mutual seller and buyer completion receipts verified on Arkiv for the winning booking. Capacity window remains single-use and cannot be re-booked.
- **Cancellation Policy**: Arkiv entities with `flags: { readonly: true }` cannot be deleted or mutated by arbitrary parties. Cancellations are not silently permitted via client state manipulation. An active reservation locks the slot permanently for that specific time window.

---

### C. `completion` (Mutual Fulfillment Receipt)

Submitted by seller and buyer to confirm that the booked job was completed satisfactorily. Created with `flags: { readonly: true, permissionlessExtension: true }` and `schema_v: "3"`.

| Attribute | Type | Description & Value | Notes |
|---|---|---|---|
| `project` | `str` | `"slotbazaar"` | Partition namespace |
| `entity_type` | `str` | `"completion"` | Discriminant |
| `schema_v` | `str` | `"3"` (or legacy `"2"`) | Schema version |
| `booking_key` | `key` | Entity key of the winning booking (`0x...`) | Foreign key to booking |
| `role` | `str` | `"seller"` or `"buyer"` | Confirmed role |
| `completed_at` | `u64` | Unix timestamp in seconds | Confirmation timestamp |
| `synthetic` | `bool` | `true` for mock completions | Test filter |

#### Payload Schema (`application/json`)
```json
{
  "note": "string (optional review note, max 500 chars)",
  "schema_version": 3
}
```

#### Creation Flags & Expiration Rule
- `flags: { readonly: true, permissionlessExtension: true }`
- `expires: ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))` (30-day lifecycle, matching booking).

---

## 3. Two-Sided Cryptographic Reputation Rule & Proof Preservation

An account receives **+1 Verified Job** reputation point if and only if:
1. **Winning Booking Exists**: A booking entity points to the slot, confirmed in the earliest block (with deterministic key tie-break), and `booking.creator !== booking.slot_creator` (rejects self-booking fraud).
2. **Seller Confirmation**: A completion entity with `booking_key = winningBooking.key` and `role = "seller"` was signed by `booking.slot_creator`.
3. **Buyer Confirmation**: A completion entity with `booking_key = winningBooking.key` and `role = "buyer"` was signed by `winningBooking.creator`.
4. **Temporal Integrity**: Neither completion timestamp occurred prior to `slot_starts_at`.
5. **Deduplication**: Duplicate completions by the same role do not double-count.

### Critical Proof Set Preservation Rule (3-Entity Job Proof Set)
Reputation verification requires the **booking entity to still exist alongside both completion receipts**. Because cryptographic derivation inspects `booking.slot_creator`, `booking.creator` (buyer), and `booking.slot_starts_at` directly from the booking entity, all **three entities (booking + seller completion receipt + buyer completion receipt) must be preserved together** to retain the verifiable reputation score on-chain.
- The "Preserve proof" button executes `extendJobProof()`, which atomically (via `wallet.executeBatch()`) or sequentially extends all three entities by 60 days.
- New bookings are created with `flags: { readonly: true, permissionlessExtension: true }` so that anyone (buyer, seller, or third party) can permissionlessly preserve the complete proof set.
- Older legacy bookings without `permissionlessExtension` can only be extended by their owner (`$owner`). If a non-owner attempts to extend, the UI disables the button and displays the owner-only restriction.

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
| **L-003** | **Client and chain clock skew** | Browser wall-clock time can diverge slightly from consensus block timestamps. Arkiv drops entities at the exact consensus `expiresAt` block (0 blocks early, verified in Phase 9 and Phase 10). | The UI applies a proactive 1-second client ticker with a 4-second client margin strictly for browser/chain clock skew, not an Arkiv asymmetry. |
| **L-004** | **Client-side tie-break rule** | Intra-block ordering is not provided by Arkiv attributes. | Deterministic tie-breaker in `getWinningBooking` sorts by earliest block number, then lexicographical entity key ascending. |
| **L-005** | **Positional call signature in `getEntity`** | Passing `{ key }` object threw `Invalid key value` error. Retested in Phase 9: passing positional `getEntity(entityKey)` succeeds cleanly on all live entities and throws `NoEntityFoundError` after expiry. | FR-011 was withdrawn as our own call-shape error. Positional call `publicClient.getEntity(entityKey)` works as documented. |
| **L-006** | **No atomic cross-wallet lock for bookings** | Arkiv does not provide an atomic cross-wallet compare-and-set or unique constraints on custom attributes (`slot_key`). | Solved via client preflight (`fetchBookingsForSlot`) rejecting duplicate submissions, combined with deterministic consensus arbitration in `getWinningBooking` (earliest confirmed block `createdAtBlock`, with lexicographical entity key tie-breaker). Active booking transitions slot to `BOOKED` state across all wallets, permanently disabling re-booking. |

---

## 6. Code Constants vs Documented Specification

Every parameter documented in this specification matches the active codebase constants exactly:

| Parameter | Documented Value | Code Constant | Source File & Line |
|---|---|---|---|
| **Min Slot Duration** | 15 minutes (`900s`) | `MIN_DURATION_SEC = 15 * 60` | `src/lib/slotValidation.ts:39` |
| **Max Slot Duration** | 7 days (`604,800s`) | `MAX_DURATION_SEC = 7 * 86400` | `src/lib/slotValidation.ts:40` |
| **Slot Expiry** | `ends_at` Unix seconds | `ExpirationTime.atDate(new Date(endsAt * 1000))` | `src/lib/arkiv.ts:1220` |
| **Booking Expiry** | 30 days (`2,592,000s`) | `30 * 86400 * 1000` ms | `src/lib/arkiv.ts:1738` |
| **Booking Schema Version** | Schema v3 | `"3"` (`flags: { readonly: true, permissionlessExtension: true }`) | `src/lib/arkiv.ts:1726` |
| **Completion Expiry** | 30 days (`2,592,000s`) | `30 * 86400 * 1000` ms | `src/lib/arkiv.ts:1796` |
| **Completion Schema Version** | Schema v3 | `"3"` (`flags: { readonly: true, permissionlessExtension: true }`) | `src/lib/arkiv.ts:1792` |
| **Real Batch Write Limit** | 20 slots per tx | `REAL_BATCH_LIMIT = 20` | `src/components/SeedModal.tsx:38` |
| **Max Live Synthetic Cap** | 40 slots | `MAX_LIVE_SYNTHETIC_CAP = 40` | `src/components/SeedModal.tsx:37` |
| **Pure Unit Test Count** | 77 tests | 21 Phase 4 + 56 Phase 5 | `scripts/test-phase4-unit.ts`, `scripts/test-phase5-unit.ts` |
| **Tiramisu Decimal Chain ID** | `7738577` | `tiramisu.id` | `src/lib/wallet.ts:24` |
| **Tiramisu Hex Chain ID** | `0x7614d1` | `0x${tiramisu.id.toString(16)}` | `src/lib/wallet.ts:25` |
