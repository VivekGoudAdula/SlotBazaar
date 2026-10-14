# SlotBazaar — Devfolio Submission Form Answers (Draft)

> **Challenge:** Global Tour Stop: Pre-Devcon Hackathon (Arkiv Network)  
> **Repository:** [https://github.com/VivekGoudAdula/SlotBazaar](https://github.com/VivekGoudAdula/SlotBazaar)  
> **Tracks:** Best Indian Use Case · Censorship Resistance

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
* **Demo Video URL (≤ 3 minutes):** `[VIDEO_URL_PLACEHOLDER: e.g. https://youtu.be/... or Loom]`
* **Live App URL:** [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app)

---

## Part 2: Scored Criteria Written Responses

### Question 1: The Problem It Solves (Why India & MSME Crisis)
*Mapped to: Scoring Rubric Criterion 1 — "Why India?" (25 Points)*

Across India’s major industrial corridors (Jeedimetla in Hyderabad, Surat, Tiruppur, Morbi, Ludhiana, Peenya, Coimbatore), micro and small enterprises operate high-value capital equipment (CNC lathes, laser die-cutters, hydraulic presses, freight fleets) on thin margins. Production schedules inevitably leave 2- to 4-hour idle gaps between primary contract runs. 

Today, this capacity is totally unmonetized because traditional Web2 platforms (IndiaMART, JustDial, Urban Company) demand high upfront fees, extract 15–25% intermediary cuts, and offer zero real-time spatial discovery. Local WhatsApp groups are unstructured, unsearchable, and spam-ridden. Most critically, when a small machine shop completes a job on time, their verified track record stays trapped in private chats — their operational reputation cannot be ported or proven to new enterprise clients.

SlotBazaar solves this by providing a decentralized, real-time map where MSMEs broadcast perishable time slots for under `0.0002 GLM` per slot. Slots expire autonomously on-chain when the window closes, reservations race on earliest confirmed block, and two-sided cryptographic signatures produce permanent, portable on-chain verified job badges without platform rent.

### Question 2: Why Arkiv? (Alternatives & Architectural Rationale)
*Mapped to: Scoring Rubric Criterion 2 — "Why Arkiv?" (25 Points)*

* **Why PostgreSQL Fails:** A database operator monopolizes the capacity feed, can shadow-ban competing job-shops, manipulate seller rankings, or front-run attractive reservations. Centralized DBs also enable platform rent extraction (20–30% fees).
* **Why IPFS Fails:** IPFS stores static immutable content addressed by hash (CID). It cannot execute numeric range queries (e.g. *within cluster X where ends_at > now*) without a centralized off-chain indexing server. Furthermore, IPFS lacks native expiration, causing expired time slots to pollute storage permanently.
* **Why Subgraphs Fail:** The Graph is an event indexer for smart contract logs, not an application storage layer. Writing slots and bookings directly would require expensive EVM execution on L1/L2 ($0.20–$5.00/slot) for temporary data that expires in 3 hours.
* **Why Entity Expiration IS the Product:** Industrial time slots are inherently perishable. Arkiv's consensus-level `expires: ExpirationTime.atDate(...)` purges expired slots automatically from active state at the block boundary without cron bots or manual garbage collection.
* **Arkiv Features Used:** Cryptographic `$creator` for reputation verification, typed numeric attributes (`lat_e4`, `lon_e4`, `starts_at`, `ends_at`), `executeBatch` single-signature bulk broadcasting, and native WebSocket live updates.
*(Full architectural rubric analysis: see `docs/WHY_ARKIV.md`)*.

### Question 3: Challenges I Ran Into (Friction & Protocol Feedback)
*Mapped to: Scoring Rubric Criterion 4 — "Friction & Feedback" (25 Points)*

We documented 17 precise friction entries in `/arkiv/friction.md` with exact error text, minimal reproduction snippets, and working workarounds. Key technical hurdles included:
1. **Passive Entity Expiration Emits No EVM Event (`FR-017`):** While entity creation streams immediately over WebSockets (avg 2,550 ms latency), protocol expiration purges state quietly at consensus without emitting an EVM log. We engineered a client-side 1-second proactive ticker with a 4-second (1–2 block) margin to ensure expired slots disappear instantly.
2. **WebSocket Push vs HTTP Polling Fallback (`FR-017`):** Supplying `fromBlock` in `watchEntityEvents` forces viem to degrade silently to HTTP polling. Native WebSocket subscriptions strictly require `webSocket(...)` transport and omitting `fromBlock`.
3. **Explorer DNS NXDOMAIN (`FR-016`):** Legacy documentation referenced `explorer.tiramisu.arkiv.network` which returned NXDOMAIN. We identified and migrated all UI links to the canonical unified interface: `https://data.arkiv.network/?q=${key}&chain=tiramisu`.
4. **Reputation Rule Post-Expiration Persistence:** When a slot expires and drops from the live state layer, its `starts_at` attribute was inaccessible. We upgraded the schema to store `slot_starts_at` immutably on the `BookingEntity`, preserving two-sided reputation verification forever.

### Question 4: Does Any Team Member Hold Indian Nationality?
**Yes.** Team lead Vivek Goud Adula holds Indian citizenship and will complete KYC for the Best Indian Use Case track.

### Question 5: Payout Wallet (EVM Address)
`[PAYOUT_WALLET_PLACEHOLDER: e.g. 0x53491aA366E086C19da948669b340317eE6eA6e9]`

---

## Part 3: Submission Checklist & Gate Compliance Review

| Rubric Gate / Requirement | Status | Evidence in Repo / Chain |
|---|---|---|
| **It works (Public deployment)** | Verified Live | Deployed to [slotbazaar.vercel.app](https://slotbazaar.vercel.app); first pin visible at 1,670ms, 0 console errors, 0 failed requests |
| **Reproducible** | Verified | Automated tests `scripts/test-phase4-unit.ts` & `scripts/test-phase5-unit.ts` |
| **Public MIT License** | Satisfied | `LICENSE` file in repository root |
| **`/arkiv/schema.md` in repo** | Satisfied | Complete specification of entity types, attributes, and queries |
| **`/arkiv/friction.md` in repo** | Satisfied | 17 detailed entries with root causes, reproduction code, and upstream links |
| **On-chain evidence on Tiramisu** | Satisfied | Documented in `WALLETS.md` with sample tx hashes and entity keys |
| **Demo video ≤ 3 minutes** | Script Ready | `docs/demo-script.md` provides 3:00 timeline and recording checklist |
| **Every required form question answered** | Satisfied | Form responses mapped to all 4 rubric criteria above |
| **Track chosen** | Satisfied | Best Indian Use Case & Censorship Resistance |
| **Built between 9 and 18 October 2026** | Satisfied | First commit `8d07316` on 13 Oct 2026; documented in `docs/DISCLOSURE.md` |
| **Evidence that survives expiry** | Satisfied | Tx hashes recorded in `WALLETS.md`; booking/completion entities store 30-day proof |
| **Zero secrets in repo** | Satisfied | `npm run scan:secrets` passes with 0 matches outside `.env` |
