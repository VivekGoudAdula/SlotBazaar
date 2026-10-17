# Building on SlotBazaar

Anyone can build alternative frontends, aggregators, dispatch engines, or auditing bots on top of SlotBazaar's open, permissionless on-chain state without asking for permission or API keys.

All capacity slots, booking commitments, and completion proofs exist as native Arkiv entities on the public Tiramisu testnet.

---

## 10-Line Query Example

Read all active, unexpired capacity slots directly from Arkiv's public RPC:

```typescript
import { createPublicClient, http } from "viem";
import { tiramisu } from "@arkiv-network/sdk/chains";
import { and, eq, gt } from "@arkiv-network/sdk";
import { str, u64 } from "@arkiv-network/sdk/attr";

const client = createPublicClient({ chain: tiramisu, transport: http("https://tiramisu-rpc.arkiv.network") });
const nowSec = BigInt(Math.floor(Date.now() / 1000));

const { entities } = await client.select().where(and(
  eq("project", str("slotbazaar")),
  eq("entity_type", str("slot")),
  gt("ends_at", u64(nowSec))
)).fetch();

console.log(`Fetched ${entities.length} active slots:`, entities.map((e) => ({ key: e.key, owner: e.owner, ...e.toJson() })));
```

---

## Entity Attributes & On-Chain Schema

SlotBazaar entities use typed attributes indexed for range, equality, and spatial filtering. For full payload structures and field specifications:

- **Entity Schema Reference**: [arkiv/schema.md](../arkiv/schema.md)
  - `slot` (`schema_v: "1"`, `flags: { readonly: true }`): Capacity listings with `category`, `cluster`, `lat_e4`, `lon_e4`, `starts_at`, `ends_at`, `price_band`, `synthetic`, `seed_batch`.
  - `booking` (`schema_v: "3"`, `flags: { readonly: true, permissionlessExtension: true }`): Immutable buyer commitment linked via `slot_key`.
  - `completion` (`schema_v: "3"`, `flags: { readonly: true, permissionlessExtension: true }`): Mutual buyer/seller job settlement proofs linked via `booking_key`.

You can query, stream (via Arkiv WebSocket subscriptions), and extend these entities directly using `@arkiv-network/sdk`.
