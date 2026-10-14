# SlotBazaar — Devfolio Submission Form Answers

> **Challenge:** Global Tour Stop: Pre-Devcon Hackathon (Arkiv Network)  
> **Repository:** [https://github.com/VivekGoudAdula/SlotBazaar](https://github.com/VivekGoudAdula/SlotBazaar)  
> **Tracks:** Best Indian Use Case · Censorship Resistance (CROPS Pillar)  
> **Target Network:** Arkiv Tiramisu (`chainId: 7738577` / `0x7614d1`)

---

## Part 1: Standard Devfolio Project Fields

### 1. Project Name
**SlotBazaar**

### 2. Tagline
*Live decentralized India map for expiring industrial capacity and verifiable MSME reputation on Arkiv Tiramisu.*

### 3. Track Selection
* **Primary:** Best Indian Use Case
* **Secondary:** Censorship Resistance (CROPS Pillar)

### 4. Builders
* Vivek Goud Adula (`[DEVFOLIO_USERNAME_PLACEHOLDER]`)

### 5. Project Links
* **GitHub Repository:** [https://github.com/VivekGoudAdula/SlotBazaar](https://github.com/VivekGoudAdula/SlotBazaar)
* **Demo Video URL (≤ 3 minutes):** `[VIDEO_URL_PLACEHOLDER: e.g. https://youtu.be/... or Loom]` (Script in [docs/demo-script.md](demo-script.md))
* **Live App URL:** [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app)

---

## Part 2: Scored Criteria Written Responses (4 × 25 Points)

### Criterion 1A: Why India? · 25 Points (Best Indian Use Case Track)
*Target: Names who in India uses it, what changes for them from day one, and the app works today.*

Across India’s major industrial manufacturing corridors (such as Jeedimetla in Hyderabad, Surat, Tiruppur, Morbi, Ludhiana, Peenya in Bengaluru, and Coimbatore), India has about 63.4 million (633.88 lakh) non-agricultural MSMEs, NSS 73rd round, July 2015 to June 2016, reported in the Lok Sabha ([AU908, answered on 21.07.2022](https://eparlib.nic.in/bitstream/123456789/1058442/1/AU908.pdf)). Only a subset of these enterprises operate capital equipment (such as CNC milling machines, lathe tooling blocks, laser cutters, hydraulic presses, or intra-city freight vehicles), but those that do operate on thin operating margins where rigid production schedules inevitably create 2- to 4-hour idle gaps between primary contract runs.

Today, this operational capacity is lost because online marketplace penetration is minimal — in our 46-respondent informal survey, only 8.7% find buyers through online marketplaces, while 47.8% rely on informal WhatsApp groups, 19.6% on direct phone calls, 15.2% on agents or middlemen who extract fees, and 8.7% report their spare capacity goes completely unused. Furthermore, 76.1% report their machine or time sits idle almost every day. Most critically, when a small machine shop completes a job on time, their verified performance record stays trapped in private chats — yet 63.0% of respondents stated that past completed jobs confirmed by both sides is what would make them trust a stranger.

SlotBazaar solves this by providing a decentralized, real-time map where MSMEs broadcast perishable time slots for about `0.00014 testnet GLM` per slot (testnet GLM has no market value, with no platform commission in the app). Slots expire autonomously on-chain when the window closes (ranging from 15 minutes to 7 days), reservations race fairly on earliest confirmed block, and two-sided cryptographic signatures produce portable on-chain verified job badges that persist for as long as their entities exist (30 days today) without platform rent. The app is live and fully interactive today at [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app). *(Full analysis: see [docs/WHY_INDIA.md](WHY_INDIA.md))*.

---

### Criterion 1B: Why this pillar? (Censorship Resistance) · 25 Points (CROPS Track)
*Target: Names who is censored, exposed or misled today, and what changes for them from day one.*

In traditional Web2 capacity directories, a centralized platform operator controls the discoverability feed. The operator can shadow-ban competing job-shops, manipulate search rankings to favor paying enterprise sponsors, front-run attractive time-slot reservations, or fabricate artificial 5-star seller reviews. If an MSME refuses predatory fee hikes or platform terms, their business can be delisted overnight, destroying years of accrued client goodwill.

On SlotBazaar, **censorship resistance is enforced by consensus**:
1. Anyone outside the team can read and query the data directly from Arkiv without our backend via public RPCs.
2. If our front-end is taken down, any developer can fork our MIT-licensed repository and query the exact same on-chain state.
3. Two-sided reputation proofs are sealed by the cryptographic transactions of both the seller and winning buyer: SlotBazaar's front end cannot forge another wallet's signed entity; Tiramisu currently has a single sequencer, so Arkiv node operators remain a trust assumption.

---

### Criterion 2: Why Arkiv? · 25 Points
*Target: The solution side. What breaks on Postgres, IPFS, a subgraph, or custom REST APIs; why entity expiration IS the product; what stays off Arkiv.*

* **Why PostgreSQL Fails:** Centralized database administrators control listing visibility and can alter historical transaction records. Centralized platforms extract intermediary fees and introduce single points of failure.
* **Why IPFS & Arweave Fail:** IPFS stores static immutable blobs addressed by CID. It cannot execute structured range queries (`where(and(eq("cluster", "jeedimetla"), gt("ends_at", nowSec)))`) without maintaining a centralized off-chain indexing server. Crucially, IPFS has zero native entity expiration — expired time slots pollute storage indefinitely.
* **Why Subgraphs Fail:** The Graph is an event indexer for contract event logs, not an application storage layer. Writing slots and reservations directly would require smart contract execution on an L1/L2 and subsequent indexing pipelines for temporary data that expires in a few hours.
* **Why Entity Expiration IS the Product:** Industrial time slots are fundamentally perishable. An idle machine slot from 10:00 AM to 2:00 PM has zero residual value at 2:01 PM. Arkiv's consensus-level `expires: ExpirationTime.atDate(slot.endsAt)` purges expired slots automatically from active state at the block boundary without cron bots or manual garbage collection.
* **What We Deliberately Kept Off Arkiv:** PII (phone numbers, emails, Aadhaar, GSTINs are strictly filtered in `src/lib/slotValidation.ts`), map raster tiles (served via CDN from OpenStreetMap), and ephemeral UI state (zoom levels and filter toggles stay in React memory).
* **Plain Platform Limitation:** SlotBazaar does not provide an in-app messaging or contact channel. Buyers and sellers coordinate job details and physical handover out of band. No personal data (phone numbers, emails, addresses, GSTIN, Aadhaar) is permitted or stored on Arkiv. *(Full analysis: see [docs/WHY_ARKIV.md](WHY_ARKIV.md))*.

---

### Criterion 3: How You Use Arkiv · 25 Points
*Target: Features used, tied to the product, changing what the user sees, and verified in code.*

| Arkiv Feature | Where Used in SlotBazaar Code | Product Impact & UI Manifestation |
|---|---|---|
| **Attributes vs Payload** | `src/lib/arkiv.ts:1099`, `schema.md` | Searchable fields (`category`, `cluster`, `starts_at`, `ends_at`, `lat_e4`, `lon_e4`) are stored as typed attributes for zero-middleware querying; display text (`title`, `description`) resides in payload. |
| **Compound Predicates & Ranges** | `src/lib/arkiv.ts:380-450` | Queries use `and()`, `eq()`, `gt("ends_at", u64(nowSec))` for live cluster and category filtering directly over RPC. |
| **Autonomous Entity Expiration** | `src/lib/arkiv.ts:1099`, `schema.md` | Slots expire at `ends_at` (15m to 7d); bookings and completions persist for as long as their entities exist (30 days today) to enable post-slot completion and dispute settlement. |
| **`$creator` Verification** | `src/lib/arkiv.ts:890`, `src/hooks/useLiveSlots.ts` | The reputation engine matches on-chain `$creator` against the slot owner and winning buyer; prevents impersonation and fake self-reviews. |
| **WebSocket Entity Events** | `src/hooks/useLiveSlots.ts:413-480` | Subscribes via `watchEntityEvents` over `webSocket` transport (omitting `fromBlock` to avoid HTTP polling fallback). Pushes newly posted slots to all peer tabs with sub-second median latency (measured 0.74s median, under 3s across tests) on the leading edge. |
| **Single-Signature Batch Writes** | `src/components/SeedModal.tsx:38`, `executeBatch` | Bundles up to 20 slots per transaction (`execute(Operation[])`). Prompts MetaMask only once, saving gas and eliminating signature fatigue. |
| **Client-Side Expiry Guard** | `src/hooks/useLiveSlots.ts:491-505` | 1-second proactive ticker with 4-second client margin exists strictly for browser/chain clock skew, not an Arkiv asymmetry. |

---

### Criterion 4: Friction Report · 25 Points
*Target: `/arkiv/friction.md` with expected vs actual, versions, minimal reproduction code, and upstream issue pointers.*

We documented 17 total tracked entries in [arkiv/friction.md](../arkiv/friction.md) on Arkiv Tiramisu (`chainId: 7738577`): 6 small SDK and DX findings (FR-001, FR-003, FR-004, FR-010, FR-012, FR-017), of which FR-012 reproduced once and FR-004 is documented behaviour; 1 documentation typo (FR-006); and 10 notes, architectural insights, and withdrawn items (FR-002, FR-005, FR-007, FR-008, FR-009, FR-011, FR-013, FR-014, FR-015, FR-016). Every entry includes exact error messages, versions, reproduction code, and tested workarounds:
1. **6 Small Arkiv & SDK Findings:**
   - `FR-001`: `InvalidPredicateError` not exported from root `@arkiv-network/sdk` (workaround: import from `/query`; filed issue).
   - `FR-003`: Node-side simulation reverts with `Ident32InvalidByte(0, 0x50)` during `eth_estimateGas` when an attribute name holds uppercase; surfaces as generic `EntityMutationError` rather than `InvalidAttributeNameError`; SDK does not pre-validate; 0 gas spent (never reached `eth_sendRawTransaction`).
   - `FR-004`: Range query with mismatched numeric type tag returns 0 rows silently without diagnostic warning (documented behaviour).
   - `FR-010`: `getBlockNumber()` missing on exported `PublicArkivClient` TypeScript interface (runtime works with cast).
   - `FR-012`: Tiramisu RPC intermittently stalled on consecutive queries (reproduced once; solved via 8s timeout wrapper).
   - `FR-017`: Protocol passive entity expiration emits no EVM event log (solved via 1s client ticker with 4s margin).
2. **1 Documentation Item:**
   - `FR-006`: Mismatched quotes in `InvalidPredicateError` message string.
3. **10 Notes, Ecosystem & Withdrawn Items:**
   - `FR-002`: `BigInt` attribute serialization in `JSON.stringify` (JavaScript language behavior; custom replacer used).
   - `FR-005`: Query index expiration boundary condition (withdrawn as friction; early drop was caused by client `ends_at > now` predicate; drops at exact expiry block with 0 block asymmetry).
   - `FR-007`: `erasableSyntaxOnly` compiler flag rejects constructor parameter properties (TS 6 / Vite template interaction).
   - `FR-008`: Native token transfers require standard viem client rather than Arkiv wallet client (standard EVM tooling).
   - `FR-009`: `getReputation` cannot recover slot creator after slot expires in Schema v1 (solved in Schema v2 by storing creator in booking).
   - `FR-011`: `getEntity({ key })` threw `Invalid key value` (withdrawn: our own call-shape error; positional call `getEntity(entityKey)` succeeds cleanly).
   - `FR-013`: Storage rent between 14-day and 30-day entity expiry has zero marginal cost impact on testnet (pricing observation).
   - `FR-014`: Same-block racing creations lack execution index (handled via deterministic lexicographical key tie-breaker).
   - `FR-015`: Schema v1 post-expiry reputation failure solved by Schema v2 decoupling (architectural design note).
   - `FR-016`: `explorer.tiramisu.arkiv.network` NXDOMAIN (withdrawn as friction: our wrong guessed hostname; `tiramisu.explorer.arkiv.network` resolves and Blockscout works).

---

## Part 3: Gates Compliance Matrix (Pass or Fail)

Every submission must pass all 11 gates to be eligible for scoring:

| # | Gate | Requirement | Status | Evidence in Repository / Network |
|---|---|---|---|---|
| **G-01** | **It works** | Public deployment judges can open without asking for access | **PASS** | Live at [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app); verified 0 console errors, 0 failed network requests. |
| **G-02** | **Reproducible** | Clean clone, build, and tests succeed exactly as documented | **Verified locally; reverify from GitHub after push** | Verified via clean clone in temporary directory; `npm install`, `npm run build`, and `npm run test:unit` all pass. |
| **G-03** | **Open Source** | Public repo under the MIT licence | **PASS** | [LICENSE](../LICENSE) file in repository root (MIT License). |
| **G-04** | **Schema Doc** | `/arkiv/schema.md` in repo specifying entity types, attributes, expiration, and queries | **PASS** | [arkiv/schema.md](../arkiv/schema.md) specifies `slot`, `booking`, `completion` attributes, expiration rules, and standard UI queries. |
| **G-05** | **On-Chain Evidence** | Wallet addresses on Tiramisu that create project entities | **Seed wallet listed; demo wallets pending from user** | [WALLETS.md](../WALLETS.md) lists seller (`0x5349...a6e9`), buyer, and sample on-chain entity keys/transactions on Tiramisu. |
| **G-06** | **Friction Report** | `/arkiv/friction.md` in repo | **PASS** | [arkiv/friction.md](../arkiv/friction.md) contains 17 detailed entries (5 genuine SDK findings, 3 doc gaps, 9 notes/withdrawn) with exact error text and minimal repros. |
| **G-07** | **Demo Video** | Demo video 3 minutes or less | **SCRIPT READY** | [docs/demo-script.md](demo-script.md) specifies exact 2:50 minute-by-minute timeline and checklist. |
| **G-08** | **Form Complete** | Every required question on Devfolio project form answered | **Drafted, to be submitted by the user** | All required form fields drafted in Parts 1 and 2 of this document. |
| **G-09** | **Track Chosen** | At least one track chosen on Devfolio | **PASS** | Best Indian Use Case (Primary) & Censorship Resistance (Secondary). |
| **G-10** | **Hackathon Window** | Built between 9 and 18 October 2026; pre-existing work disclosed | **PASS** | [docs/DISCLOSURE.md](DISCLOSURE.md); initial commit `8d073160bf920f4967199eddcb03f712c87b0877` created 2026-10-12 21:07:20 +0530 (Phase 0 scaffold & first on-chain slot entity). |
| **G-11** | **Survives Expiry** | Evidence that survives entity expiration | **PASS** | Transaction hashes documented in `WALLETS.md`; booking & completion entities have 30-day lifespans outliving slots. |
| **E-01** | **Eligibility** | SDK installed and actively queried; no Postgres proxy; zero secrets or PII | **PASS** | `@arkiv-network/sdk` queried on every page; no centralized DB; `npm run scan:secrets` clean (0 leaks); PII guard regexes in `slotValidation.ts`. |

---

## Part 4: Scored Criteria Compliance Matrix

| Criterion | Max Points | Evidence & Implementation Details |
|---|:---:|---|
| **1. Why India? (Best Indian Use Case)** | 25 | Names real MSME users (precision job shops in Jeedimetla, Surat, Tiruppur) losing idle machine hours. Solves high broker cuts and lack of portable reputation. Works live today. Documented in [docs/WHY_INDIA.md](WHY_INDIA.md). |
| **1 (Alt). Why Censorship Resistance?** | 25 | Proves data is queryable by anyone via public Arkiv RPCs without our backend. Platform operators cannot alter transaction records or manipulate ratings. Documented in [docs/WHY_ARKIV.md](WHY_ARKIV.md). |
| **2. Why Arkiv?** | 25 | Thoroughly analyzes why PostgreSQL, IPFS/Arweave, Subgraphs, and custom APIs fail. Explains why autonomous entity expiration IS the product. Discloses what deliberately stays off Arkiv (PII, map tiles, transient UI state). Documented in [docs/WHY_ARKIV.md](WHY_ARKIV.md). |
| **3. How You Use Arkiv** | 25 | Every feature tied to core UX: typed attributes vs payload, compound range predicates, autonomous expiration (15m to 7d slots, 30d bookings/completions), `$creator` reputation verification, `watchEntityEvents` WebSocket live updates, single-sig `executeBatch` writes (up to 20 slots/tx). 44 unit tests verify behavior. |
| **4. Friction Report** | 25 | 17 comprehensive friction entries (5 genuine SDK findings, 3 doc gaps, 9 notes/withdrawn) in [arkiv/friction.md](../arkiv/friction.md). Includes exact error text, SDK/viem versions, minimal reproduction code, and upstream issue pointers. |

---

## Part 5: Ground Truth Parameters & Code Constants

| Ground Truth Constant | Value | Source of Truth File |
|---|---|---|
| **Tiramisu Decimal Chain ID** | `7738577` | `src/lib/wallet.ts:24` (`tiramisu.id`) |
| **Tiramisu Hex Chain ID** | `0x7614d1` | `src/lib/wallet.ts:25` (`0x${tiramisu.id.toString(16)}`) |
| **Minimum Slot Duration** | 15 minutes (`900s`) | `src/lib/slotValidation.ts:39` (`MIN_DURATION_SEC`) |
| **Maximum Slot Duration** | 7 days (`604800s`) | `src/lib/slotValidation.ts:40` (`MAX_DURATION_SEC`) |
| **Slot Expiry Setting** | `ends_at` timestamp | `src/lib/arkiv.ts:1099` |
| **Booking Entity Expiry** | 30 days (`30 * 86400 * 1000ms`) | `src/lib/arkiv.ts:1157` |
| **Completion Entity Expiry** | 30 days (`30 * 86400 * 1000ms`) | `src/lib/arkiv.ts:1222` |
| **Real Batch Write Limit** | 20 slots per tx | `src/components/SeedModal.tsx:38` (`REAL_BATCH_LIMIT`) |
| **Max Live Synthetic Cap** | 40 slots | `src/components/SeedModal.tsx:37` (`MAX_LIVE_SYNTHETIC_CAP`) |
| **Pure Unit Test Count** | 44 tests (21 Phase 4 + 23 Phase 5) | `npm run test:unit` |
| **Foreground RPC Load** | 14.0 req/min (14 per min, CDP measured) | `README.md:196`, `friction.md` |
| **Hidden Tab RPC Load** | 1.0 req/min (CDP measured) | `README.md:196`, `friction.md` |
