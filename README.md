<p align="center">
  <img src="public/og-image.png" alt="SlotBazaar — Real-Time Expiring Industrial Capacity & Portable MSME Reputation on Arkiv" width="100%" />
</p>

# SlotBazaar

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Network: Arkiv Tiramisu](https://img.shields.io/badge/Network-Arkiv%20Tiramisu%20(7738577)-blue)](https://data.arkiv.network/?chain=tiramisu)
[![Live App](https://img.shields.io/badge/Live%20App-Deploy%20on%20Vercel-success)](https://slotbazaar.vercel.app)

> **Live Deployed Application URL:** [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app) *(Verified live on Vercel)*  
> **Source Repository:** [https://github.com/VivekGoudAdula/SlotBazaar](https://github.com/VivekGoudAdula/SlotBazaar)  
> Built for the **Arkiv Global Tour Stop Hackathon (9–18 October 2026)**.  
> Tracks: **Best Indian Use Case** & **Censorship Resistance**.

---

## 1. One-Paragraph Pitch

**SlotBazaar** is a decentralized, real-time discovery and reservation bazaar for perishable industrial capacity (machine tooling hours, intra-city freight trips, and freelance engineering sprints) across India’s manufacturing corridors. 47.8% of surveyed workshop owners find buyers through informal WhatsApp groups and only 8.7% use online marketplaces. Powered entirely by **Arkiv Tiramisu**, SlotBazaar has no platform commission in the app; only network gas (about `0.00014 testnet GLM` per slot). Time slots expire autonomously on-chain without background cron jobs, booking races are decided transparently by the earliest confirmed block, and two-sided cryptographic signatures generate verifiable, portable MSME reputation. SlotBazaar's front end cannot forge another wallet's signed entity; Tiramisu currently has a single sequencer, so Arkiv node operators remain a trust assumption.

---

## 2. The Ravi and Meena Story

In the industrial corridors of **Jeedimetla (Hyderabad)**, **Ravi** operates a precision job-shop with two 4-axis CNC milling machines. Between major automotive part batches, his machines frequently sit idle for 2- to 4-hour gaps. Machinery depreciation and high fixed electrical tariff charges continue regardless of whether a spindle is turning.

Three kilometers away in Balanagar, **Meena** runs an assembly unit producing specialized water filtration systems. At 11:30 AM, her workshop’s primary die-cutting machine breaks down right before an urgent delivery deadline. Calling brokers means paying middleman fees (15.2% in our survey rely on agents or middlemen) or waiting on unstructured chats (47.8% use WhatsApp groups).

With **SlotBazaar**:
1. Ravi opens SlotBazaar on his phone. He selects the **Jeedimetla** corridor cluster, chooses *"Machine"*, enters *"CNC Milling Slot (2h available)"*, sets expiry for 2:30 PM (slots range from 15 minutes to 7 days), and signs with MetaMask for `< 0.0002 GLM`.
2. Meena opens the live interactive map with **zero login and no wallet required**. She instantly spots Ravi's slot.
3. Meena connects MetaMask and clicks **Book Slot**. Arkiv records her reservation entity.
4. When physical cutting finishes at 2:15 PM, both Ravi and Meena confirm job completion by submitting mutual on-chain completion entities signed by their respective wallets.
5. Arkiv verifies both cryptographic signatures, instantly unlocking a **🏆 1 Verified Job** reputation badge on Ravi's on-chain profile. Both businesses thrive without platform fees or middleman commissions.

---

## 3. Evidence of Need: Informal Online Survey

![Survey Questions 1 and 2: Idle frequency and buyer discovery](docs/survey/survey-idle-and-buyers.png)

![Survey Questions 3 and 4: Willingness to use live map and trust factors](docs/survey/survey-use-and-trust.png)

### Survey Counts Table (n = 46 respondents)

| Question | Option | Percentage (%) | Respondent Count (n = 46) | Calculation Note |
|---|---|:---:|:---:|---|
| **1. Idle frequency**<br>*(How often does your machine, vehicle, or your own time sit idle with no work?)* | Almost every day | 76.1% | 35 | `76.1% × 46 = 35.0` |
| | A few times a week | 19.6% | 9 | `19.6% × 46 = 9.0` |
| | A few times a month | 4.3% | 2 | *(Derived as remainder: 46 - 35 - 9 = 2)* |
| | Rarely or never | 0.0% | 0 | `0.0% × 46 = 0` |
| **2. Finding buyers today**<br>*(How do you find buyers for that spare time today?)* | WhatsApp groups | 47.8% | 22 | `47.8% × 46 = 22.0` |
| | Phone calls to known contacts | 19.6% | 9 | `19.6% × 46 = 9.0` |
| | Agents or middlemen | 15.2% | 7 | `15.2% × 46 = 7.0` |
| | Online marketplaces | 8.7% | 4 | *(Derived as remainder: 46 - 22 - 9 - 7 - 4 = 4)* |
| | "I don't, it just goes unused" | 8.7% | 4 | `8.7% × 46 = 4.0` |
| **3. Live map adoption**<br>*(Would you use a free live map where you post a spare slot in under a minute, with no sign-up, and nearby buyers can see it and book?)* | Yes, definitely | 65.2% | 30 | `65.2% × 46 = 30.0` |
| | Maybe, if it's easy | 23.9% | 11 | `23.9% × 46 = 11.0` |
| | Only if buyers are verified | 10.9% | 5 | `10.9% × 46 = 5.0` |
| | No | 0.0% | 0 | `0.0% × 46 = 0` |
| **4. Trust factors**<br>*(What would make you trust a stranger who books your slot?)* | Their past completed jobs, confirmed by both sides | 63.0% | 29 | `63.0% × 46 = 29.0` |
| | Verified business details | 15.2% | 7 | `15.2% × 46 = 7.0` |
| | Advance payment | 13.0% | 6 | `13.0% × 46 = 6.0` |
| | Reviews from people I know | 8.7% | 4 | `8.7% × 46 = 4.0` |

*(Note on methodology: counts = percentage × 46; derived rows computed as remainder where the chart omitted explicit text labels).*

> [!NOTE]
> **How to read this:**  
> Informal online survey of 46 respondents, shared via [FILL: where I shared it], not representative of all Indian MSMEs. The idle question included "your own time" so freelancers are included; the respondent mix between equipment owners, transport operators, and service freelancers is unknown. Question 3 described "no sign-up" while the app needs no login to browse but requires a wallet signature to post (wallet onboarding is the main adoption gap). Findings reflect the responses of this cohort and must not be generalised to all Indian MSMEs.

---

## 4. Judges: Try This in 60 Seconds

Follow this exact path to evaluate SlotBazaar end-to-end:

1. **Browse with Zero Friction:** Open [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app). Browse active industrial capacity across Jeedimetla, Surat, Tiruppur, Morbi, and Ludhiana without connecting a wallet.
2. **Inspect On-Chain Proofs:** Click any slot marker or list card. In the drawer, expand *"🔐 On-Chain Proof"* and click **Explorer ↗** to verify the raw decentralized entity on [data.arkiv.network](https://data.arkiv.network/?chain=tiramisu).
3. **Connect MetaMask:** Click **Connect Wallet** (top right). Accept the prompt to switch to **Arkiv Tiramisu testnet** (`chainId: 7738577` / `0x7614d1`). Need testnet GLM? Claim free tokens from the [Arkiv Faucet](https://hub.arkiv.network/faucet).
4. **Post an Immutable Slot:** Click **+ Post a slot**. Select your industrial cluster and category. Submit your time window (minimum 15 minutes, maximum 7 days). Within **sub-second median latency (0.74s median, under 3s across tests)**, the new slot appears live on your screen and all open peer tabs via native Arkiv WebSocket streaming!
5. **Book from a Second Wallet:** Switch MetaMask to a second account. Click **Book Slot** to create an immutable on-chain reservation entity (30-day lifecycle).
6. **Mutual Job Completion Confirmation:** Open the slot drawer / *My Jobs* on both accounts and click **Confirm Job Completion** to sign and submit mutual on-chain completion entities.
7. **Instant Verifiable Reputation:** Both transactions are cryptographically verified on-chain, immediately displaying the verified reputation badge (`🏆 1 Verified Job`) on the seller's card!

---

## 5. Architecture Diagram

```mermaid
flowchart TD
    subgraph Client ["Client Layer (100% Static SPA)"]
        UI["React 19 + Vite Frontend"]
        Map["Leaflet Map + OSM Raster Tiles"]
        Wallet["Injected MetaMask (viem)"]
    end

    subgraph Arkiv ["Arkiv Decentralized State Layer (Tiramisu Testnet)"]
        SlotEntity["Slot Entity (u64 starts_at / ends_at, i32 lat_e4/lon_e4)"]
        BookingEntity["Booking Entity (slot_key, slot_creator, slot_starts_at)"]
        CompletionEntity["Completion Entity (booking_key, role='seller'|'buyer')"]
        
        ConsensusEngine["Consensus & Execution Engine"]
        WSFeed["Native WebSocket Push (watchEntityEvents)"]
    end

    UI -->|"1. Single-Sig Batch Create (executeBatch)"| SlotEntity
    UI -->|"2. Earliest Block Claim"| BookingEntity
    UI -->|"3. Wallet-Signed Mutual Entities"| CompletionEntity
    
    ConsensusEngine -.->|"Autonomous Expiration at ends_at"| SlotEntity
    ConsensusEngine -->|"Consensus State"| WSFeed
    WSFeed -.->|"Leading-Edge Real-Time Push"| UI
```

---

## 6. Project Links & Evidence Matrix

| Resource | Link | Description |
|---|---|---|
| **Live Deployed App** | [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app) | Production deployment hosted on Vercel |
| **Why India? Narrative** | [docs/WHY_INDIA.md](docs/WHY_INDIA.md) | Problem analysis, industrial corridor mapping, survey findings |
| **Why Arkiv? Architectural Analysis** | [docs/WHY_ARKIV.md](docs/WHY_ARKIV.md) | Technical comparison: Arkiv vs Postgres vs IPFS vs Subgraphs |
| **Decentralized Schema Specification** | [arkiv/schema.md](arkiv/schema.md) | Entity attribute definitions, index types, and querying rules |
| **SDK Friction Log & Upstream Gaps** | [arkiv/friction.md](arkiv/friction.md) | 17 documented entries with reproducible scripts & upstream issue references |
| **Reproducibility Test Scripts** | [arkiv/repro/README.md](arkiv/repro/README.md) | Self-contained, runnable verification scripts for friction & latency claims |
| **Disclosure & License Audit** | [docs/DISCLOSURE.md](docs/DISCLOSURE.md) | Baseline commit timestamp, code origin audit, license checks |
| **2:40 Demo Video Script** | [docs/demo-script.md](docs/demo-script.md) | Complete second-by-second video script with audited UI button labels |
| **Arkiv Testnet Explorer** | [data.arkiv.network](https://data.arkiv.network/?chain=tiramisu) | Canonical explorer for Tiramisu testnet state |
| **Blockscout Transaction Explorer** | [tiramisu.explorer.arkiv.network](https://tiramisu.explorer.arkiv.network) | Canonical block explorer for transactions |

---

## 7. Developer Quickstart

```bash
# Clone the repository
git clone https://github.com/VivekGoudAdula/SlotBazaar.git
cd SlotBazaar

# Install dependencies (Node 18+ required)
npm install

# Configure environment variables
cp .env.example .env

# Start local development server (Vite)
npm run dev
```

### Automated Testing & Security Verification
```bash
# Run all pure unit test suites (Phase 4 & Phase 5)
npm run test:unit

# Scan repository and git history for private key leaks
npm run scan:secrets

# Production build check
npm run build

# Markdown link integrity audit
node scripts/check-links.mjs

# Friction script reference audit
node scripts/check-friction-refs.mjs
```

Manual testing results and verification checkpoints are recorded in [docs/manual-test-results.md](docs/manual-test-results.md).

---

## 8. Map Tile Attribution

Map background tiles are served by [OpenStreetMap](https://www.openstreetmap.org/) contributors under the Open Database License (ODbL).  
**Attribution:** `Map tiles © OpenStreetMap contributors (ODbL) · Powered by Arkiv Tiramisu`.

---

## 9. Honest Limitations & Protocol Notes

In adherence to Arkiv friction logging rules, we transparently disclose existing protocol limitations:

1. **Passive Entity Expiration Emits No EVM Event Log (`FR-017`):** Arkiv's execution engine prunes expired entities silently at the consensus timestamp boundary without emitting an event log. To maintain a real-time reactive UI, SlotBazaar implements a client-side 1-second ticker with a 4-second (1–2 block) margin that removes expired cards immediately without waiting for server sweeps.
2. **Testnet Sequencer Centralization:** Tiramisu testnet currently operates on a single sequencer node. Mainnet production will require decentralized validator sets to ensure resilience against localized outages.
3. **Public Unencrypted Data:** All entity payloads on Tiramisu are publicly readable. While appropriate for open B2B machinery and logistics discovery, confidential commercial terms require client-side zero-knowledge proofs or asymmetric encryption.
4. **Free Sybil Addresses on Testnet:** Creating new testnet wallets is virtually free. Two-sided reputation proves mutual agreement between two distinct cryptographic accounts; enterprise mainnet deployment would integrate economic staking or proof-of-humanity credentials.
5. **No In-App Contact Channel:** SlotBazaar does not provide an in-app messaging or contact channel. Buyers and sellers coordinate job details and physical handover out of band. No personal data (phone numbers, emails, addresses, GSTIN, Aadhaar) is permitted or stored on Arkiv.

### 9.1 Measured Browser RPC Network Load
*Measured on 2026-10-14 in headless Chrome with CDP instrumentation (foreground sample: 2 minutes; hidden-tab sample: 1 minute via simulated visibilitychange event).*  
*Verified in a real headed browser: not run.*

| State | Sample Window | Total Requests | Average Req/Min | Technical Note |
| :--- | :---: | :---: | :---: | :--- |
| **Foreground Idle (WebSocket Healthy)** | 2 minutes | 28 | **14.0** | WS active; leading-edge immediate refetch with 10s cooldown + trailing fetch; chainhead polled at 12s |
| **Foreground Idle (WebSocket Blocked)** | 2 minutes | 30 | **15.0** | Fallback to HTTP polling with 12s query throttle and shared fetch lock |
| **Tab Hidden (simulated visibilitychange event)** | 1 minute | 1 | **1.0** | All queries paused via `document.hidden` check and `visibilitychange` listener |

**RPC Breakdown by Source (Foreground Idle, 2-Minute Window):**
- **Chain Head (`eth_blockNumber`):** 11 requests (~5.5/min)
- **Slots Queries (`select()`):** 4 requests (~2.0/min)
- **Bookings Queries (`select()`):** 4 requests (~2.0/min)
- **Completions Queries (`select()`):** 4 requests (~2.0/min)
- **Other HTTP RPC:** 5 requests (~2.5/min)
- **TOTAL:** 28 requests in 2 min (**14.0 req/min**, safely below the 15 req/min threshold, down from unoptimized baseline of 96.5 req/min)

### 9.2 Measured Live-Update Latency Across Two Browser Contexts
*Measured using two Puppeteer browser contexts (one posting a live slot on Arkiv Tiramisu, one observing the live map without refreshing).*

| Sample | Before Leading-Edge Fix (Artificial 2–12s debounce) | After Leading-Edge Fix (Immediate first event + single trailing) | Notes |
| :---: | :---: | :---: | :--- |
| Sample 1 | 0.11 s | 2.80 s | WebSocket event delivery + immediate DOM card render |
| Sample 2 | 4.25 s | 0.18 s | Leading-edge refetch |
| Sample 3 | 6.42 s | 0.01 s | Instantaneous DOM update |
| Sample 4 | 1.23 s | 1.10 s (rerun: 0.74 s) | Original measurement: 1.10 s; rerun: 0.74 s |
| Sample 5 | 0.18 s | 0.74 s | Standard leading-edge push |
| **Median** | **1.23 s** | **0.74 s** | Sub-second median across test batches |
| **Max** | **6.42 s** | **2.80 s** | Maximum latency under 3.0 s |

*(All raw samples listed including original 1.10 s for sample 4 and the rerun; median: 0.74 s, max: 2.80 s).*

---

## 10. License & Repository

This project is open-source under the [MIT License](LICENSE).  
**Repository:** [https://github.com/VivekGoudAdula/SlotBazaar](https://github.com/VivekGoudAdula/SlotBazaar)  
© 2026 Vivek Goud Adula and SlotBazaar Contributors.
