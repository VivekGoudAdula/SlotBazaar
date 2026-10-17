# Why Arkiv? Architecture, Trade-Offs & Rubric Rationale

> **SlotBazaar Submission Document**  
> [TRACKS: to be filled by the author]  
> **Network:** Arkiv Tiramisu Testnet (`chainId: 7738577` / `0x7614d1`)

---

## 1. The Rubric Question: What Would Break on Other Stacks?

When building a decentralized bazaar for perishable SME capacity (machine hours, freight transport, freelance engineering), alternative Web2 and Web3 storage architectures fail fundamental requirements:

### A. What Breaks on PostgreSQL / Centralized Databases
* **Operator Monopoly & Feed Manipulation:** In a centralized database, the platform operator controls what users see. The operator can shadow-ban competing MSMEs, artificially demote listings, or front-run attractive time-slot reservations.
* **Revision of Historical Truth:** Centralized database administrators can alter past job records or fabricate artificial 5-star seller ratings. On SlotBazaar, job completions are sealed by two cryptographic signatures (seller and buyer): SlotBazaar's front end cannot forge another wallet's signed entity; Tiramisu currently has a single sequencer, so Arkiv node operators remain a trust assumption.
* **Platform Intermediary Fees:** In our survey (46 respondents), 47.8% find buyers through WhatsApp groups, 15.2% through agents or middlemen and 8.7% through online marketplaces. There is no platform fee in the app; users pay only network gas.

### B. What Breaks on IPFS & Arweave
* **No Dynamic Attribute Querying:** IPFS and Arweave store static blobs indexed by Content Identifier (CID). You cannot execute structured range queries such as:
  ```ts
  and(
    eq("project", str("slotbazaar")),
    eq("cluster", str("jeedimetla")),
    gt("ends_at", u64(nowSec))
  )
  ```
  To query IPFS, an application must maintain a centralized indexing server (e.g., ElasticSearch), re-introducing centralized operator dependency and censorship risks.
* **Zero Native Entity Expiration:** IPFS content persists as long as pinned. Perishable time slots (e.g., a 2-hour CNC lathe slot expiring at 2:00 PM) would pollute IPFS storage indefinitely, forcing clients to download gigabytes of dead slots.

### C. What Breaks on The Graph / Subgraphs
* **Subgraphs are Event Indexers, Not Application Data Stores:** The Graph indexes Ethereum contract event logs into GraphQL. It cannot receive direct data writes from browser clients. Posting a time slot would require smart contract execution on an L1/L2 and subsequent indexing pipelines for temporary data that expires in a few hours.
* **Indexer Latency:** Subgraph indexing pipelines introduce delay between block confirmation and query availability, whereas Arkiv index updates were empirically measured in arkiv/repro/logs (query freshness 339 ms once; WebSocket-to-DOM median 2.60 s of completed samples, 2 of 10 timeouts).

### D. What Breaks on a Custom Server / REST API
* **Trust Dependency:** If the startup running the API ceases operations or suffers a database wipe, small business merchants lose their verified reputation and trade histories. With Arkiv, any developer can fork the open-source front-end and immediately query the exact same on-chain state without our permission.

---

## 2. Why Entity Expiration IS the Product

Industrial capacity is fundamentally perishable:
* A CNC lathe sitting idle between 10:00 AM and 2:00 PM has **zero residual value** at 2:01 PM.
* An empty 2-tonne pickup returning from Jeedimetla to Balanagar loses all capacity once the return trip ends.
* An on-call hydraulic technician's morning availability window closes once booked or expired.

### Autonomous Protocol-Level Expiration
Traditional databases require off-chain cron bots or garbage-collection jobs (`DELETE FROM slots WHERE ends_at < NOW()`). If the bot crashes, stale listings remain live, misleading buyers.

On Arkiv, **Entity Expiration is enforced directly by consensus rules**:
```ts
expires: ExpirationTime.atDate(new Date(slot.endsAt * 1000))
```
Entity Expiration is a block deadline computed from ends_at; when that block deadline is reached, the entity is dropped automatically from active state. The protocol guarantees that the live query index reflects only currently actionable time slots.

### Would a Postgres cron job do?
Yes, a cron could delete expired rows, but then the operator controls deletion. Here, the network consensus enforces it; anyone can read the exact same state without trusting our backend, and proof entities can be kept alive by anyone through permissionless extension without our permission.

**Limitations:**
- **Deletion by Owners:** Readonly prevents editing attributes, but the entity owner can delete their own entity, removing evidence (though they cannot forge it).
- **Sybil / Cheap Wallets:** One person can run two wallets and confirm their own jobs; reputation is only as strong as the cost of making wallets.
- **Booking Squatting:** Anyone can book an open slot without a deposit and block capacity, as no payment or escrow exists in the protocol today.
- **Single Sequencer:** Tiramisu testnet currently runs a single sequencer, meaning node uptime and sequencer liveness remain a trust assumption during testnet.

---

## 3. Arkiv Features Leveraged & Architectural Rationale

| Arkiv Feature | Where Used in SlotBazaar | Architectural Rationale |
|---|---|---|
| **Cryptographic `$creator`** | Reputation Engine (`verifyJobCompletion`) | Verifies the sender address on-chain. Prevents impersonation; only the genuine seller and winning buyer can create valid completion receipts. |
| **Immutable Creation Flags** | Slot listings (`createSlot`); Booking (`createBooking`); Completion (`createCompletion`) | Slot has `readonly` only. Booking has `readonly` + `permissionlessExtension`. Completion has `readonly` + `permissionlessExtension`. Passing `flags: { readonly: true }` prevents post-creation tampering of attributes and payload at the protocol level. |
| **Permissionless Extension** | Booking & Completion proof entities (`createBooking`, `createCompletion`, `extendProofEntity`, `extendJobProof`) | Created with `flags: { readonly: true, permissionlessExtension: true }`. Allows any public party to pay gas to extend reputation persistence for 365 days via `extendEntity()` without owner approval. |
| **Ownership Transfer** | Slot entities (`transferEntityOwnership`) | Enables owner-only reassignment via native `changeOwnership()`. Preserves immutable `$creator` provenance while transferring `$owner` stewardship. |
| **Typed Attribute Filtering** | `fetchLiveSlots`, `fetchAllBookings` | Enables rich client-side and RPC queries (`str`, `u64`, `i32`, `bool`) without centralized middleware. |
| **Numeric Coordinate Scaling (`e4`)** | Cluster spatial coordinates (`lat_e4`, `lon_e4`) | Stored as signed 32-bit integers (`Math.round(lat * 10000)`); display attributes only (no geo-range query is used in the app; cluster tag filtering is used instead). |
| **Single-Signature Batching** | In-app seed & bulk post (`executeBatch`) | Bundles multiple slot entities into a single EVM transaction call (`execute(Operation[])`). MetaMask prompts the user only **once**, preventing signature fatigue. |
| **Native WebSocket Streams** | Real-time map updates (`watchEntityEvents`) | Subscribes to `wss://` RPC without polling overhead. Pushes newly posted slots to open peer tabs with real empirical latency measured on localhost (8 of 10 appeared; median 2.60 s, p90: 6.93 s; 2 timed out at 35s; 30s fallback polling is implemented, though recovery was not demonstrated in those two samples). |

---

## 4. What We Deliberately Kept Off Arkiv

Decentralized state storage persists for as long as its entities exist (365 days today for proof entities, with permissionless extension thereafter), is public, and is replicated across nodes. To safeguard SME privacy and optimize chain bandwidth, we established strict boundary rules:

1. **No Personal Identifiable Information (PII):**
   * Absolute ban on phone numbers, personal email addresses, Aadhaar numbers, and GSTINs in entity payloads or attributes.
   * Sellers communicate out-of-band or via burner identifiers once reservations are confirmed.
2. **No Map Raster Tiles:**
   * OpenStreetMap map tiles are served from distributed CDN caches, never stored on-chain.
3. **No Ephemeral UI State:**
   * Filter chip toggles, slide-over drawer states, map zoom levels, and draft inputs reside exclusively in client-side React memory.
4. **No Off-Chain Media Blobs:**
   * Slot descriptions are constrained to 280 characters of clean text. No heavy images or video attachments burden Arkiv node state.
5. **No Direct Fiat / Custodial Payments:**
   * SlotBazaar is a discovery and reservation coordination protocol. Financial settlement occurs directly between SME parties (cash, UPI, or escrow), avoiding custodial liability.

---

## 5. Honest Assessment of Limitations

In adherence to hackathon friction rules, we document existing protocol constraints openly:

1. **Passive Expiration Produces No Log Event:**
   * Protocol expiration prunes state at the consensus layer but does not emit an EVM log event (documented in `FR-017`). Front-ends cannot listen for an "onEntityExpired" event and must implement proactive client-side timer pruning (such as our 1-second ticker with 4s margin).
2. **Testnet Sequencer Centralization:**
   * Today, Arkiv Tiramisu runs a single sequencer node. Production mainnet deployment will require decentralized block validation to ensure high availability under network partitions.
3. **Public Unencrypted Metadata:**
   * All entity payloads on Tiramisu are publicly readable. While suitable for open capacity bazaars, confidential corporate booking contracts would require client-side zero-knowledge proofs or threshold encryption.
4. **No In-App Contact Channel:**
   * SlotBazaar does not provide an in-app messaging or contact channel. Buyers and sellers coordinate job details and physical handover out of band. No personal data (phone numbers, emails, addresses, GSTIN, Aadhaar) is permitted or stored on Arkiv.
