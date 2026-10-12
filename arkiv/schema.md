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

#### Dual-Sided Reputation Verification
- An account's verified reputation score is calculated as:
  **Number of completed jobs where BOTH a seller completion and a buyer completion exist from DIFFERENT creator addresses for the same slot key.**
- One-sided completion claims or self-dealing completions from the same wallet address are rejected.

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
