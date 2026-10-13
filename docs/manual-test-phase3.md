# Manual Test Protocol — Phase 3: Post a Slot via MetaMask

> **Protocol Version**: 1.0.0  
> **Target Network**: Arkiv Tiramisu Testnet (Chain ID `7738577`)  
> **Target Application**: SlotBazaar Phase 3 (Vite + React 19)  
> **Status**: Ready for manual execution. Results below are documented as `not run` until physically tested in browser with an injected wallet.

---

## Environment Setup Requirements

- Browser: Chrome, Brave, or Firefox with MetaMask extension installed.
- Network RPC: `https://rpc.tiramisu.db-chain.testnet.arkiv.network`
- Faucet: `https://hub.arkiv.network/faucet`
- Local Dev Server: `http://localhost:5173`

---

## 12-Point Test Scenario Matrix

| ID | Scenario | Preconditions | Action Steps | Expected Outcome | Result | Notes / Evidence |
|:---|:---------|:--------------|:-------------|:-----------------|:-------|:-----------------|
| **MT-01** | **Install Check (No Provider Fallback)** | Browser with no MetaMask or Web3 wallet extension installed (e.g. clean profile). | 1. Open app at `http://localhost:5173`.<br>2. Inspect Navbar wallet button and "Post a slot" button.<br>3. Click the Wallet button. | - "Post a slot" button is disabled with tooltip "Install MetaMask to post a slot".<br>- Wallet button displays "Install MetaMask" linking to `https://metamask.io/download/`. | *not run* | Verified code fallback in `src/lib/wallet.ts`. |
| **MT-02** | **Connect Wallet** | MetaMask installed; account unlocked; user disconnected in app. | 1. Click "Connect Wallet" in Navbar.<br>2. Select account in MetaMask popup and approve connection. | - Address pill displays truncated address (`0x1234…abcd`) and GLM balance.<br>- "Post a slot" button enables if on Tiramisu.<br>- UI updates immediately without page reload. | *not run* | Handled via EIP-6963 + `window.ethereum.request({ method: 'eth_requestAccounts' })`. |
| **MT-03** | **Wrong Network Prompt** | Wallet connected to Sepolia, Ethereum Mainnet, or Polygon (non-Tiramisu chain). | 1. Observe Navbar block indicator and Post button.<br>2. Click the wallet button to open menu. | - Post button remains disabled with tooltip "Switch to Arkiv Tiramisu to post a slot".<br>- Red warning banner / pill indicates "Wrong Network".<br>- Option to "Switch to Tiramisu" appears. | *not run* | Governed by `isWrongNetwork` state. |
| **MT-04** | **Add / Switch Network** | Wallet connected on non-Tiramisu chain. | 1. Click "Switch to Tiramisu" in wallet menu or modal.<br>2. If chain 7738577 is not yet in MetaMask, observe `wallet_addEthereumChain` prompt.<br>3. Approve chain addition & switch. | - MetaMask prompts user to add or switch to Arkiv Tiramisu.<br>- On confirmation, chain ID updates in UI without page reload.<br>- "Post a slot" button becomes active. | *not run* | Error 4902 triggers `wallet_addEthereumChain` fallback. |
| **MT-05** | **Reject in MetaMask Popup** | Connected on Tiramisu with > 0.001 GLM. | 1. Click "+ Post a slot" to open modal.<br>2. Fill in valid slot details.<br>3. Click "Post to Arkiv".<br>4. In MetaMask transaction popup, click "Reject". | - Modal moves to `waiting_wallet` then returns to form.<br>- Friendly error banner displays: "Transaction was rejected in MetaMask. You can adjust your slot details and try again."<br>- Form inputs remain preserved; button re-enabled. | *not run* | Error code 4001 mapped to `WALLET_REJECTED`. |
| **MT-06** | **0 GLM Balance / Insufficient Gas** | Connected on Tiramisu with an account having 0 GLM balance. | 1. Open "Post a slot" modal.<br>2. Fill valid form and submit.<br>3. Observe pre-flight balance or wallet rejection. | - Friendly error appears: "Insufficient GLM balance to pay for transaction gas on Arkiv Tiramisu. Current balance: 0.0000 GLM."<br>- Direct link to Faucet (`https://hub.arkiv.network/faucet`) is presented. | *not run* | Mapped to `INSUFFICIENT_GLM`. |
| **MT-07** | **Successful Post** | Connected on Tiramisu with >= 0.001 GLM. | 1. Open "Post a slot" modal.<br>2. Select Category (e.g. Machine).<br>3. Enter Title (e.g. "CNC 4hr Sprint") & Description.<br>4. Pick Cluster (e.g. Jaipur).<br>5. Confirm PII checkbox.<br>6. Click "Post to Arkiv" and approve in MetaMask. | - Transaction is signed and submitted.<br>- Stepper moves through: preparing -> waiting_wallet -> submitted -> confirmed -> indexing -> success.<br>- On completion, modal displays success message and button to "View on Map". | *not run* | End-to-end write layer using `createSlot`. |
| **MT-08** | **Stepper Timing & Transitions** | Connected on Tiramisu, post valid slot. | 1. Track stage transitions and UI indicators during post. | - Progress displays sequential stages with pulse animation.<br>- Tx hash is displayed with link to Arkiv Explorer as soon as mempool accepts it.<br>- Confirmed block number is displayed once mined. | *not run* | Verified reactive stage state machine. |
| **MT-09** | **Visibility Delay (Polling / 30s Timeout)** | Post valid slot, simulate indexing delay (>30s). | 1. Broadcast tx.<br>2. Observe polling mechanism querying `fetchLiveSlots`.<br>3. If entity takes > 30s to appear in query index: | - Polling queries every 2 seconds.<br>- If 30s elapses, displays: "Confirmed on chain, still indexing. Your slot will appear on the map shortly."<br>- Tx hash and entity key link to Explorer remain accessible. | *not run* | Timeout guard prevents infinite hanging. |
| **MT-10** | **Account Switch While Open** | "Post a slot" modal is open in form state. | 1. Switch active account in MetaMask popup from Account 1 to Account 2. | - `accountsChanged` event fires.<br>- Address updates in UI without page reload.<br>- Modal updates creator preview / seller label without losing typed form fields. | *not run* | Subscribed in `useEffect` in `src/lib/wallet.ts`. |
| **MT-11** | **Disconnect While Open** | "Post a slot" modal is open in form state. | 1. In MetaMask, disconnect connected site. | - `accountsChanged` fires with empty array.<br>- Wallet status switches to `disconnected`.<br>- "Post a slot" button in modal disables or displays reconnect notice. | *not run* | Graceful disconnection handler in `wallet.ts`. |
| **MT-12** | **Reload Resilience** | Slot posted on chain. | 1. Refresh page (`Ctrl+F5`).<br>2. Observe map and filters. | - Live query `fetchLiveSlots` retrieves active slots from Arkiv.<br>- Newly posted slot renders on the map at the chosen coordinates.<br>- Clicking pin opens Drawer with "★ Your Slot" badge if current account is the creator. | *not run* | State persistence driven by Arkiv on-chain queries. |

---

## Sign-off & Verification

- **Automated Validation Tests**: 35/35 PASSED (`npx tsx scripts/test-phase3-validation.ts`)
- **Manual Protocol Status**: Specification complete; physical browser execution marked `not run`.
