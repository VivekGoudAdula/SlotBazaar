# SlotBazaar — Arkiv Entity Schema v1

> Last updated: 2026-10-12  
> Status: `slot` = live · `booking` = planned · `completion` = planned

---

## Design Principles

1. **Filterable vs payload**: Anything a query will filter on goes in `attributes`. Everything else (long descriptions, nested JSON, display data) goes in the `payload`.
2. **Attribute budget**: Max ~30 attributes per entity. We use 11 on `slot`; leave headroom for future fields.
3. **Types**: u64 for unix timestamps (never strings); i32 for lat/lon encoded as degrees × 10 000 (supports negatives); str for enums.
4. **Namespace**: Every entity carries `project="slotbazaar"` and `entity_type` so queries are safely scoped.
5. **Entity Expiration = slot end time**: The Arkiv entity expires when the time slot ends, so expired slots are automatically removed from the chain.

---

## Entity Type: `slot`

**Status: Live (Phase 0)**

### Attributes

| Attribute | Type | Why attribute (not payload) | Notes |
|-----------|------|----------------------------|-------|
| `project` | `str` | Namespace all queries — required by every select | Value: `"slotbazaar"` |
| `entity_type` | `str` | Scope by entity kind | Value: `"slot"` |
| `schema_v` | `str` | Forward compat — query UI can adapt to schema changes | Value: `"1"` |
| `category` | `str` | Users filter by category (machine/transport/freelance) | `"machine"`, `"transport"`, `"freelance"` |
| `cluster` | `str` | Users filter by city cluster | `"surat"`, `"mumbai"`, `"delhi"`, … |
| `starts_at` | `u64` | Range query: slots starting after a time | Unix seconds |
| `ends_at` | `u64` | Range query: slots still active (ends_at > now) | Unix seconds, must match Entity Expiration |
| `price_band` | `str` | Users filter by price bucket | `"low"`, `"mid"`, `"high"` |
| `lat_e4` | `i32` | Map marker position, filterable for geo bounding box | degrees × 10 000, supports negatives |
| `lon_e4` | `i32` | Map marker position | degrees × 10 000, supports negatives |
| `synthetic` | `bool` | Mark seeded/test data — used to clean up in queries | `true` for all seed data |

### Payload (JSON, non-filterable)

```json
{
  "title": "string (≤80 chars display name)",
  "description": "string (longer description, no PII)",
  "seller_label": "string (fake business name, synthetic)",
  "schema_version": 1
}
```

### Entity Expiration

`ExpirationTime.atDate(new Date(endsAtSec * 1000))`

**Reasoning**: The slot ceases to be relevant when its end time passes. Using `atDate(endTime)` means Arkiv automatically removes it from all queries — no manual cleanup needed. This is the core semantic elegance of the design.

### UI Queries

| Use case | Query |
|----------|-------|
| All active slots | `project=slotbazaar AND entity_type=slot AND ends_at > u64(now)` |
| By category | + `AND category = str("machine")` |
| By cluster | + `AND cluster = str("surat")` |
| By seller | `.createdBy(walletAddress)` |
| Single slot | `getEntity(key)` |

---

## Entity Type: `booking` _(planned — Phase 1)_

**Status: Planned**

A buyer's claim on a slot — created when a buyer signs a booking transaction.

### Planned Attributes

| Attribute | Type | Why attribute | Notes |
|-----------|------|--------------|-------|
| `project` | `str` | Namespace | `"slotbazaar"` |
| `entity_type` | `str` | Scope | `"booking"` |
| `slot_key` | `key` | Query bookings for a slot | Reference to slot entity key |
| `status` | `str` | Filter by booking state | `"pending"`, `"confirmed"`, `"cancelled"` |
| `created_at` | `u64` | Ordering | Unix seconds |
| `synthetic` | `bool` | Test marker | |

### Payload (planned)

```json
{
  "message": "optional buyer note (synthetic/no PII)",
  "schema_version": 1
}
```

### Entity Expiration (planned)

Booking lives as long as the parent slot: `ExpirationTime.atDate(slot.endsAt)`.  
**Reasoning**: Booking with no slot is meaningless — auto-expire together.

### Creator / Reputation

`entity.$creator` = buyer's wallet. Immutable. Powers buyer reputation score (count of confirmed bookings per wallet).

---

## Entity Type: `completion` _(planned — Phase 2)_

**Status: Planned**

A seller's confirmation that a booked slot was fulfilled. Completes the reputation loop.

### Planned Attributes

| Attribute | Type | Why attribute | Notes |
|-----------|------|--------------|-------|
| `project` | `str` | Namespace | `"slotbazaar"` |
| `entity_type` | `str` | Scope | `"completion"` |
| `booking_key` | `key` | Link to booking | Reference |
| `slot_key` | `key` | Direct link to slot | For seller dashboard queries |
| `synthetic` | `bool` | Test marker | |

### Entity Expiration (planned)

Long-lived — `ExpirationTime.fromDays(365)`.  
**Reasoning**: Completion records are reputation evidence — they should persist long after the slot expired.

---

## Attribute Constraints (SDK enforced)

| Rule | Value |
|------|-------|
| Max attribute name length | 32 bytes |
| Attribute name pattern | `[a-z][a-z0-9_]*` (lowercase, start with letter) |
| Max string value | 128 bytes UTF-8 |
| Max attributes per entity | ~30 |
| u64 range | 0 to 2^64 - 1 |
| i32 range | -2^31 to 2^31 - 1 |

---

## Ordering Note

Arkiv does **not** support server-side ordering by attribute. All results are sorted **client-side** after fetching. For the map view we sort by `ends_at` ascending (soonest-expiring first).
