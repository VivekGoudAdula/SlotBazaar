# SlotBazaar — Arkiv Entity Schema v1 (LOCKED)

> Phase 1 Schema Lock  
> Ground-truth specification for all on-chain entities and queries in SlotBazaar.  
> Namespace: `project="slotbazaar"`

---

## 1. Design & Architecture Principles

1. **Arkiv is the Sole Data Layer**:
   - Zero traditional databases, zero centralized servers, zero localStorage truth.
   - All app state is read directly from and written directly to the Arkiv Tiramisu testnet.
2. **Immutable Append-Only Records**:
   - Slots are **never edited**. When a slot is booked, a separate `booking` entity is created.
   - When a job completes, separate `completion` entities are minted by seller and buyer.
3. **Filterable Attributes vs. Unindexed Payload**:
   - `attributes`: Only properties evaluated in search predicates (`==`, `>`, `<`) or geo-bounding queries.
   - `payload`: Opaque JSON containing display text (titles, descriptions, notes). Payloads are decoded and strictly validated at runtime.
4. **Autonomous Chain Expiration**:
   - Entities have strict lifetimes set via `ExpirationTime`.
   - Expired entities are automatically pruned by the protocol, eliminating manual maintenance and garbage collection.
5. **Cryptographic Authentication ($creator)**:
   - Entity `$creator` is the signer's wallet address and is strictly immutable.
   - Trusted reads authenticate transactions via `$creator`, never by trusting payload strings.

---

## 2. Entity Specifications

### A. `slot` (Expiring Available Time Slot)

A machine hour, freight capacity, or freelance time slot offered by an SME or individual.

| Attribute | Type | Storage Reason | Constraints & Notes |
|-----------|------|----------------|---------------------|
| `project` | `str` | Query namespace | Must be `"slotbazaar"` |
| `entity_type` | `str` | Filter entity kind | Must be `"slot"` |
| `schema_v` | `str` | Versioning | `"1"` |
| `category` | `str` | Filterable by user | `"machine"`, `"transport"`, `"freelance"` |
| `cluster` | `str` | Filterable regional hub | `"surat"`, `"mumbai"`, `"delhi"`, `"bengaluru"`, `"hyderabad"`, `"chennai"`, etc. |
| `starts_at` | `u64` | Range filter (`>=`) | Unix seconds |
| `ends_at` | `u64` | Range filter (`> now`) | Unix seconds; strictly matches slot end |
| `price_band` | `str` | Price tier filter | `"low"`, `"mid"`, `"high"` |
| `lat_e4` | `i32` | Geo bounding filter | Latitude × 10 000 (signed integer handles negative coords) |
| `lon_e4` | `i32` | Geo bounding filter | Longitude × 10 000 (signed integer) |
| `synthetic` | `bool` | Filter test/seed data | `true` for synthetic/mock slots |

#### Payload Schema (`application/json`)
```json
{
  "title": "string (1-80 chars)",
  "description": "string (max 1000 chars)",
  "seller_label": "string (business or trade name)",
  "schema_version": 1
}
```

#### Expiration Rule & Reasoning
- **Expiry**: `ExpirationTime.atDate(new Date(ends_at * 1000))`
- **Reasoning**: A time slot has no commercial utility once its window has passed. Setting entity expiration equal to `ends_at` guarantees the chain purges it from live search and the map without manual intervention.

---

### B. `booking` (Buyer Slot Claim)

A claim placed on an available slot by a buyer. Created as an autonomous entity pointing to `slot_key`.

| Attribute | Type | Storage Reason | Constraints & Notes |
|-----------|------|----------------|---------------------|
| `project` | `str` | Query namespace | Must be `"slotbazaar"` |
| `entity_type` | `str` | Filter entity kind | Must be `"booking"` |
| `slot_key` | `key` | Foreign key to slot | Entity key of parent slot (`0x...`) |
| `booked_at` | `u64` | Timestamp of booking | Unix seconds |
| `synthetic` | `bool` | Filter test data | `true` for synthetic records |

#### Payload Schema (`application/json`)
```json
{
  "note": "string (optional buyer message/requirement, max 500 chars)",
  "schema_version": 1
}
```

#### Expiration Rule & Reasoning
- **Expiry**: `ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))` (30-day lifecycle).
- **Reasoning**: Bookings must survive throughout the active slot window and beyond so both parties can complete physical fulfillment and verify on-chain reputation after slot expiry.

#### Winner & Tie-Break Logic
- A slot may receive multiple concurrent booking transactions.
- **Rule**: Earliest creation block wins (`createdAtBlock` ascending).
- **Tie-Break within same block**: Lexicographical order of `entityKey` ascending (`a.key.toLowerCase() < b.key.toLowerCase()`).

---

### C. `completion` (Mutual Fulfillment Receipt)

Proof of job completion submitted by either the seller or buyer.

| Attribute | Type | Storage Reason | Constraints & Notes |
|-----------|------|----------------|---------------------|
| `project` | `str` | Query namespace | Must be `"slotbazaar"` |
| `entity_type` | `str` | Filter entity kind | Must be `"completion"` |
| `booking_key` | `key` | Foreign key to booking | Entity key of winning booking (`0x...`) |
| `role` | `str` | Role of submitter | `"seller"` or `"buyer"` |
| `completed_at` | `u64` | Fulfillment timestamp | Unix seconds |
| `synthetic` | `bool` | Filter test data | `true` for synthetic records |

#### Payload Schema (`application/json`)
```json
{
  "note": "string (optional review/feedback note, max 500 chars)",
  "schema_version": 2
}
```

#### Expiration Rule & Reasoning
- **Expiry**: `ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))` (30-day lifecycle matching booking).
- **Reasoning**: Completion records are persistent proof of performance powering on-chain reputation. They outlive the slot (15 min to 7 days) and match the booking lifetime so that historical reputation scores remain verifiable even after the slot itself has expired.

#### Dual-Sided Reputation Verification (Three-Part Rule — Phase 1 Lock)

A job counts toward an account's reputation score **only if ALL three conditions hold**:

| # | Condition | What it prevents |
|---|-----------|------------------|
| (a) | A winning booking exists for the slot **and** the winning booking's `creator` ≠ the slot's `creator` | Self-booking fraud |
| (b) | A `seller` completion exists whose `creator` equals the slot's `creator` | Fake seller confirmations |
| (c) | A `buyer` completion exists whose `creator` equals the winning booking's `creator` | Fake buyer confirmations |

Implemented in `verifyJobCompletion()` (pure function) in `src/lib/arkiv.ts`.
Unit-tested in `scripts/test-reputation.ts` (8 cases, 0 failures).

---

## 3. Standard UI Queries

### 1. Fetch All Live Active Slots
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot")),
    gt("ends_at", u64(nowSec))
  ))
  .fetch()
```
*Client sorts results by `ends_at` ascending.*

### 2. Fetch Live Slots by Regional Cluster
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot")),
    eq("cluster", str(clusterName)),
    gt("ends_at", u64(nowSec))
  ))
  .fetch()
```

### 3. Fetch Live Slots by Category
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot")),
    eq("category", str(categoryName)),
    gt("ends_at", u64(nowSec))
  ))
  .fetch()
```

### 4. Fetch Slots Created by a Specific Seller
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("slot"))
  ))
  .createdBy(sellerAddress)
  .fetch()
```

### 5. Fetch Bookings for a Slot
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("booking")),
    eq("slot_key", key(slotKey))
  ))
  .fetch()
```
*Client determines winning booking by sorting by `createdAt` ascending with deterministic `entityKey` tie-break.*

### 6. Fetch Completions for a Slot
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("completion")),
    eq("slot_key", key(slotKey))
  ))
  .fetch()
```

### 7. Fetch All Completions Involving an Account
```ts
client.select()
  .where(and(
    eq("project", str("slotbazaar")),
    eq("entity_type", str("completion"))
  ))
  .createdBy(userAddress)
  .fetch()
```

---

## 4. Known Limitations

| # | Limitation | Impact | Mitigation |
|---|------------|--------|------------|
| L-001 | **Expired slot creator lookup**: When `getReputation()` checks a slot that has expired from the Arkiv index, its `creator` address cannot be recovered via `select().where()` (entity is pruned). The function skips the slot silently. | A reputation score from a completed-but-expired slot is not counted. | Run reputation queries within the slot's lifetime window. Completions persist 365 days; slots expire at `ends_at`. Post-expiry reputation requires the slot creator address to be cached client-side or stored in the completion payload. |
| L-002 | **No server-side ordering**: Arkiv's `select()` API does not support `orderBy`. All sorting (by `ends_at`, block number, etc.) is performed client-side in TypeScript after `fetch()`. | Pagination may return entities in non-deterministic order; full pagination needed before sorting. | Always exhaust `hasNextPage()` before sorting. |
| L-003 | **2-block query expiry asymmetry** (FR-005, retested 2026-10-13): Query index drops an entity ~2 blocks before SDK-reported `expiresAt`. | UI may show a slot as "about to expire" while the chain index has already removed it. | Add a 2-block (≈4s) buffer when evaluating near-expiry display logic. |
| L-004 | **Single winning booking per slot**: The tie-break rule (earliest block + lexicographic key) is enforced client-side only. A malicious client could display a different winner. | Reputation depends on trust in client-side winner determination. | Future: Arkiv entity linking or a dedicated `award` entity signed by the seller could anchor the winner on-chain. |
| L-005 | **`getEntity` throws `Invalid key value`** (FR-011): Calling `getEntity({ key })` with a key returned by `createEntity` throws `Invalid key value` for at least some entity keys. | Cannot use `getEntity` to verify a specific entity's live status. | Use `select().where()` with attribute predicates to find entities instead of by key. |

---

## 5. Empirical Cost Data (Phase 2B, 2026-10-13)

Measured with `scripts/measure-cost.ts` on Tiramisu testnet. Balance delta (before – after) per `createEntity` call:

| Slot duration | GLM spent      | Wei spent        |
|---------------|----------------|------------------|
| 3 hours       | 0.000141824 GLM | 141824000283648 |
| 24 hours      | 0.000141840 GLM | 141840000283680 |
| Δ (3h vs 24h) | 0.000000016 GLM | 16000000032 wei  |

**Interpretation:** Expiry duration has negligible cost impact (~0.011% difference between 3h and 24h). The cost is dominated by the base entity creation fee, not the expiration window.

**Estimated cost for 40-slot seed run:** ~0.005673 GLM (based on 3h baseline × 40).

---

## 6. Client-Side Test Entity Filter Rule (Updated in Phase 4)

To prevent automated developer probe and cost measurement entities from polluting the user-facing map and slot lists without suppressing valid user listings, SlotBazaar applies a strict `seed_batch`-only filter (`isProductionSlot` in `src/lib/arkiv.ts`):

1. **Title & Cluster Never Filtered**: `isProductionSlot` **never** hides a slot based on its `title`, `description`, or `cluster`. A user slot titled "test slot" or situated in any custom cluster remains 100% visible.
2. **Explicit Probe Batches Excluded**: An entity is hidden **only** if its `seed_batch` attribute matches one of the known developer probe batches:
   - `dev-probe`
   - `cost-measure`
   - `fr005-retest`
   - Or starts with `t06-` (automated end-to-end hot removal test harness).

All production user slots and synthetic demo slots created via `seed.ts` (tagged `seed_batch="seed-YYYY-MM-DD"`) remain visible and fully functional.

---

## 7. Schema V2 Specification (Phase 4: Book, Confirm, Reputation)

Schema v2 extends the protocol to support decentralized, verifiable job completions with race-resistant winning bookings and two-sided cryptographic verification. Existing Schema v1 data remains backward-compatible.

### 7.1 Entity: `booking` (v2)

Bookings are independent immutable entities. Existing slots are **never mutated**.

| Attribute | Arkiv Type | Encoding | Description |
|-----------|------------|----------|-------------|
| `project` | `StrValue` | UTF-8 `"slotbazaar"` | Project partition key |
| `entity_type` | `StrValue` | UTF-8 `"booking"` | Entity type discriminant |
| `schema_v` | `StrValue` | UTF-8 `"2"` | Schema version (`"1"` for legacy) |
| `slot_key` | `KeyValue` | `key(slotKey)` | Foreign key referencing the slot entity |
| `slot_creator` | `StrValue` | UTF-8 address string | Copied from live on-chain slot (lowercase) |
| `slot_starts_at` | `U64Value` | `u64(BigInt(startsAt))` | Copied from live on-chain slot (preserves start window post slot expiry) |
| `slot_ends_at` | `U64Value` | `u64(BigInt(endsAt))` | Copied from live on-chain slot |
| `booked_at` | `U64Value` | `u64(BigInt(sec))` | Unix timestamp when booking was created |
| `synthetic` | `BoolValue` | `bool(boolean)` | `false` for user bookings |

- **Expiration Policy**: 30 days from creation (`ExpirationTime.atDate(new Date(Date.now() + 30 * 86400 * 1000))`).
- **Gas Cost**: ~0.000142 GLM (consistent with Arkiv's flat entity creation fee).
- **Integrity Invariant**: Booking creation reads the live slot from Arkiv first; `slot_creator`, `slot_starts_at` and `slot_ends_at` are copied directly from the on-chain slot, never accepted from untrusted client input. Recording `slot_starts_at` directly onto the booking ensures the reputation rule "completion before slot start is rejected" remains strictly enforceable even after the original slot entity has expired and been pruned by Arkiv.

### 7.2 Entity: `completion` (v2)

Completions reference the specific **`booking_key`** (not `slot_key`), enabling post-expiry confirmation.

| Attribute | Arkiv Type | Encoding | Description |
|-----------|------------|----------|-------------|
| `project` | `StrValue` | UTF-8 `"slotbazaar"` | Project partition key |
| `entity_type` | `StrValue` | UTF-8 `"completion"` | Entity type discriminant |
| `schema_v` | `StrValue` | UTF-8 `"2"` | Schema version |
| `booking_key` | `KeyValue` | `key(bookingKey)` | Foreign key referencing the winning booking |
| `role` | `StrValue` | UTF-8 `"seller"` or `"buyer"` | Role confirmed by signing wallet |
| `completed_at` | `U64Value` | `u64(BigInt(sec))` | Unix timestamp when confirmation occurred |
| `synthetic` | `BoolValue` | `bool(boolean)` | `false` for user completions |

- **Post-Expiry Creation**: Because completions link to `booking_key` (which has a 30-day lifespan), sellers and buyers can confirm job completion **after the slot itself has expired on-chain**.

---

## 8. Two-Sided Reputation Rule & Sybil Caveat

A job qualifies as a verified reputation point if and only if **ALL** of the following conditions hold:

1. **Legitimate Winning Booking**:
   - A booking exists for the slot.
   - The booking's creator is **NOT** the `slot_creator` (self-booking fraud is rejected).
   - The booking is the **winning booking** for its slot: confirmed in the earliest block (`createdAtBlock`). Tie-breaks between bookings in the same block are resolved lexicographically by entity key (`a.key.toLowerCase().localeCompare(b.key.toLowerCase())`).
2. **Two-Sided Completion**:
   - A completion with `role="seller"` exists on the `booking_key` whose creator equals `booking.slot_creator`.
   - A completion with `role="buyer"` exists on the `booking_key` whose creator equals `booking.creator`.
3. **Temporal Validity**:
   - Neither completion was executed before `effectiveStartsAt` (`winner.slotStartsAt ?? slot.startsAt`). This prevents premature completion claims even when the original slot entity has already expired and pruned.
4. **De-duplication**:
   - Duplicate completions submitted by the same role/wallet do not double-count.

### Honest Sybil Limitation
> **Cryptographic / Economic Caveat**: On public EVM networks, generating new wallet addresses is essentially free. A malicious actor with testnet GLM could generate two separate addresses and execute synthetic self-trades to inflate reputation. Within SlotBazaar, reputation proves cryptographic consensus that **two distinct wallets both signed mutual agreement on a specific winning booking**. Full anti-sybil resistance in production requires proof-of-humanity or economic stake.

---

## 9. Ground Truth Code Constants

| Constant | Value | Source of Truth |
|---|---|---|
| **Min Slot Duration** | 15 minutes (`15 * 60 = 900s`) | `src/lib/slotValidation.ts:39` |
| **Max Slot Duration** | 7 days (`7 * 86400 = 604800s`) | `src/lib/slotValidation.ts:40` |
| **Slot Expiry** | Set to `ends_at` timestamp | `src/lib/arkiv.ts:1099` |
| **Booking Expiry** | 30 days (`30 * 86400 * 1000ms`) | `src/lib/arkiv.ts:1157` |
| **Completion Expiry** | 30 days (`30 * 86400 * 1000ms`) | `src/lib/arkiv.ts:1222` |
| **Real Batch Limit** | 20 slots per tx (`REAL_BATCH_LIMIT = 20`) | `src/components/SeedModal.tsx:38` |
| **Max Live Synthetic Cap** | 40 slots (`MAX_LIVE_SYNTHETIC_CAP = 40`) | `src/components/SeedModal.tsx:37` |
| **Pure Unit Test Count** | 44 tests (21 Phase 4 + 23 Phase 5) | `npm run test:unit` |

---

*Last updated: 2026-10-14 IST (Phase 8 Specification Harmonization)*

