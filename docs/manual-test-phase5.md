# Manual Test Protocol — Phase 5: In-App Seed Demo Data & WebSocket Live Updates

> **Protocol Version**: 1.0.0  
> **Target Network**: Arkiv Tiramisu Testnet (Chain ID `7738577`)  
> **Target Application**: SlotBazaar Phase 5 (Vite + React 19 + Viem WebSocket)  
> **Status**: Specification complete. All manual test scenarios are logged as `not run` until physically executed in the browser. Do not claim these passed.

---

## Prerequisites & Test Environment

1. **Browser**: Chrome, Brave, or Firefox with MetaMask extension.
2. **Two Browser Windows or Profiles**:
   - **Browser A**: Connected wallet (Account 1).
   - **Browser B**: Incognito or secondary profile (Account 2 or guest observer).
3. **Funded Account**: Account with at least 0.05 GLM from faucet (`https://hub.arkiv.network/faucet`).
4. **Unfunded Account**: Account with exactly 0 GLM (0 balance).
5. **Application URL**: `http://localhost:5173`
6. **WebSocket URL**: `wss://rpc.tiramisu.db-chain.testnet.arkiv.network`
7. **Arkiv Explorer**: `https://data.arkiv.network/?chain=tiramisu`

---

## Test Scenario Matrix

| ID | Scenario | Preconditions | Steps | Expected Outcome | Result | Notes / Evidence |
|:---|:---------|:--------------|:------|:-----------------|:-------|:-----------------|
| **MT5-01** | **Seed from Funded Wallet (Single Signature Batch)** | Connected with funded wallet (> 0.001 GLM) on Tiramisu. | 1. Click "🌱 Seed demo data" in navbar.<br>2. Inspect SeedModal (explains 6 slots, ~0.00086 GLM cost, balance, 30m-7d durations, synthetic=true).<br>3. Click "Broadcast 6 Demo Slots".<br>4. Inspect MetaMask popup. Approve single signature request. | Single MetaMask transaction popup appears (no sequential multi-popups).<br>Transaction confirms in ~3-5s.<br>Success screen displays transaction hash link and 6 entity links.<br>Map auto-fits bounds to the newly seeded slots.<br>Toast notification confirms seeded count and elapsed time. | *not run* | |
| **MT5-02** | **Seed with 0 GLM (Faucet Guard)** | Connected with account having 0 GLM balance. | 1. Click "🌱 Seed demo data" in navbar.<br>2. Observe balance and modal footer. | Button is disabled with warning: "Insufficient GLM: You need at least ~0.001 GLM".<br>Clicking faucet link opens `https://hub.arkiv.network/faucet` in a new tab.<br>No MetaMask popup is triggered. | *not run* | |
| **MT5-03** | **Double Click Pending Guard** | Connected with funded wallet. | 1. Open SeedModal.<br>2. Rapidly double-click or multi-click "Broadcast 6 Demo Slots". | Button immediately enters disabled "Broadcasting Batch…" state on first click.<br>Second click is blocked; exactly one Ethereum transaction is submitted to MetaMask. | *not run* | |
| **MT5-04** | **Two Browsers Seeing Posts Live (WebSocket Push)** | Browser A and Browser B open side-by-side to `http://localhost:5173`. Both show "LIVE" in block pill. | 1. In Browser A, submit a new slot via "Post a slot" or "Seed demo data".<br>2. Without refreshing Browser B, observe Browser B's map and slot list. | Within ~2-3 seconds of tx confirmation, Browser B receives the WebSocket event and automatically refetches via debounced 3-query batch.<br>New slot appears in Browser B without manual page reload. | *not run* | |
| **MT5-05** | **Socket Drop (Toggle Network) and Recovery** | Browser open with "LIVE" badge displayed in block pill. | 1. In DevTools Network tab, toggle offline (or disconnect Wi-Fi) for 10 seconds.<br>2. Observe block pill badge.<br>3. Toggle network back online. | When disconnected, pill switches from "LIVE" to "POLLING". Existing slot list is preserved (never wiped to empty).<br>Console logs warning and initiates exponential backoff reconnect.<br>When network restores, socket re-establishes, block pill returns to "LIVE", and background polling resumes smoothly. | *not run* | |
| **MT5-06** | **Slot Expiring While Page is Open (Client-Side Immediate Pruning)** | A slot exists with 1-2 minutes remaining (e.g. short seed slot). Map and slot drawer open. | 1. Observe slot card countdown timer.<br>2. Wait until `ends_at` passes. | At exactly `ends_at` (with 4s / 1-2 block margin), the slot is immediately pruned from the map and list without waiting for the next server poll cycle.<br>UI remains smooth with no flickering. | *not run* | |
| **MT5-07** | **60-Second Cooldown Enforcement** | Successfully executed MT5-01 within the last 60 seconds. | 1. Immediately click "🌱 Seed demo data" again.<br>2. Inspect button and cooldown banner. | Banner displays: "⏳ Cooldown Active: Please wait Xs".<br>Button is disabled until countdown reaches 0s. | *not run* | |
| **MT5-08** | **40-Slot Live Limit Enforcement** | Total active synthetic slots on network is >= 40. | 1. Open SeedModal when synthetic count >= 40. | Warning displays: "⚠️ Network Limit Reached: 40 or more live synthetic slots already exist on Arkiv Tiramisu".<br>Broadcast button is disabled. | *not run* | |
| **MT5-09** | **Empty-State CTA (< 5 Slots)** | Filters or network state has fewer than 5 slots. | 1. Open Available Slots slide-over list when total slots < 5. | Green "🌱 Seed demo data" button appears inside the empty/low-slots panel.<br>Clicking button opens SeedModal directly. | *not run* | |

---

## Verification Summary

- **Automated Unit Tests**: 23 / 23 passed (`scripts/test-phase5-unit.ts`)
- **WebSocket Latency Benchmark**: 5 / 5 samples captured on Tiramisu (`scripts/test-ws-latency.ts`)
- **MetaMask Batch Execution Test**: Verified 6 entities in 1 tx (`scripts/test-batch.ts`)
- **Manual Protocol Status**: Specification complete; physical browser execution marked `not run`.
