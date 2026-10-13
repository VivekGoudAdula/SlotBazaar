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
- **Expiry**: `ExpirationTime.atDate(new Date((slot_ends_at + 86400) * 1000))` (Slot end time + 24 hours).
- **Reasoning**: Bookings must survive throughout the active slot window and slightly beyond so both parties can reference booking terms during fulfillment. Once the 24-hour settlement window closes, uncompleted bookings safely expire.

#### Winner & Tie-Break Logic
- A slot may receive multiple concurrent booking transactions.
- **Rule**: Earliest creation block wins (`createdAt` ascending).
- **Tie-Break within same block**: Lexicographical order of `entityKey` ascending (`a.key.toLowerCase() < b.key.toLowerCase()`).

---

### C. `completion` (Mutual Fulfillment Receipt)

Proof of job completion submitted by either the seller or buyer.

| Attribute | Type | Storage Reason | Constraints & Notes |
|-----------|------|----------------|---------------------|
| `project` | `str` | Query namespace | Must be `"slotbazaar"` |
| `entity_type` | `str` | Filter entity kind | Must be `"completion"` |
| `slot_key` | `key` | Foreign key to slot | Entity key of booked slot (`0x...`) |
| `role` | `str` | Role of submitter | `"seller"` or `"buyer"` |
| `completed_at` | `u64` | Fulfillment timestamp | Unix seconds |
| `synthetic` | `bool` | Filter test data | `true` for synthetic records |

#### Payload Schema (`application/json`)
```json
{
  "note": "string (optional review/feedback note, max 500 chars)",
  "schema_version": 1
}
```

#### Expiration Rule & Reasoning
- **Expiry**: `ExpirationTime.fromDays(365)` (1 year).
- **Reasoning**: Completion records are persistent proof of performance powering on-chain reputation. They outlive the slot and booking so that historical reputation scores remain verifiable over long time horizons.

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

*Last updated: 2026-10-13 IST*
