# Manual Test Protocol — Phase 4: Book, Confirm, Reputation

> **Protocol Version**: 1.0.0  
> **Target Network**: Arkiv Tiramisu Testnet (Chain ID `7738577`)  
> **Target Application**: SlotBazaar Phase 4 (Vite + React 19)  
> **Status**: Specification complete. All manual test scenarios are logged as `not run` until physically executed in the browser with two active MetaMask accounts.

---

## Prerequisites & Test Environment

1. **Browser**: Chrome, Brave, or Firefox with MetaMask extension.
2. **Two Separate Accounts in MetaMask**:
   - **Account 1 (Ravi - Seller)**: Funded with testnet GLM from `https://hub.arkiv.network/faucet`.
   - **Account 2 (Meena - Buyer)**: Funded with testnet GLM from `https://hub.arkiv.network/faucet`.
3. **Application URL**: `http://localhost:5173`
4. **Arkiv Explorer**: `https://explorer.tiramisu.arkiv.network`

---

## Test Scenario Matrix

| ID | Scenario | Preconditions | Steps | Expected Outcome | Result | Notes / Evidence |
|:---|:---------|:--------------|:------|:-----------------|:-------|:-----------------|
| **MT4-01** | **Seller Cannot Book Own Slot** | Account 1 (Ravi) connected on Tiramisu. A slot created by Account 1 exists on the map. | 1. Open the Slot Drawer for Ravi's own slot.<br>2. Inspect the "Book This Slot" button. | The "Book This Slot" button is disabled.<br>Tooltip / badge displays: "You cannot book your own slot". "★ Your Slot" badge is visible. | *not run* | Verified in `SlotDrawer.tsx` guard. |
| **MT4-02** | **Standard Booking Flow (Meena)** | Account 2 (Meena) connected on Tiramisu with > 0.01 GLM. Ravi's slot is live and unbooked. | 1. Click Ravi's slot pin on map.<br>2. Click "🤝 Book This Slot".<br>3. Inspect Confirmation modal (verifies zero-payment notice).<br>4. Click "Confirm Booking" and approve in MetaMask. | Stepper transitions: Preparing -> Waiting for wallet -> Submitted -> Confirmed -> Resolving winner.<br>Modal outcome displays: "🎉 You Booked This Slot!" with confirmed block number.<br>Drawer updates to show "★ Booked by You". Map marker displays "YOU" stamp. | *not run* | Verified in `BookSlotModal.tsx`. |
| **MT4-03** | **Duplicate Booking Blocked** | Account 2 (Meena) has already submitted a booking for Ravi's slot. | 1. Open the Slot Drawer for the same slot with Account 2.<br>2. Inspect the "Book This Slot" button. | The "Book This Slot" button is disabled with tooltip: "You have already placed a booking on this slot". | *not run* | Enforced via `hasUserBooking` guard. |
| **MT4-04** | **Booking Race Condition (Two Buyers)** | Two buyer accounts (Account 2 & Account 3) both open the same open slot simultaneously. | 1. Account 2 submits booking transaction in block $N$.<br>2. Account 3 submits booking transaction in block $N$ or $N+1$.<br>3. Both transactions confirm on Arkiv. | Earliest block wins. If both confirm in same block, smaller entity key wins.<br>Account 2 (winner) sees: "🎉 You Booked This Slot".<br>Account 3 (loser) sees: "⚠️ Missed: someone booked first (block N)". Outcome is clearly explained with winner rules. | *not run* | Winner resolution in `getWinningBooking`. |
| **MT4-05** | **Missed State Display** | Account 3 (loser of race) views the slot drawer. | 1. Open the slot drawer with Account 3. | Drawer displays banner: "⚠️ Missed: someone booked first (block N). Arkiv resolves races by earliest confirmed block (and key tie-break)." | *not run* | Banner rendered in `SlotDrawer.tsx`. |
| **MT4-06** | **Reject Booking in MetaMask** | Connected with Meena, click "Book This Slot". | 1. Click "Confirm Booking".<br>2. In MetaMask popup, click "Reject". | Modal returns to form state.<br>Banner displays: "Booking transaction was rejected in MetaMask."<br>Inputs preserved, no crash. | *not run* | Handled via error code 4001 mapping. |
| **MT4-07** | **Confirm Job Done — Seller Side** | Slot has started (`now >= startsAt`). Account 1 (Ravi - Seller) is connected. Slot is booked by Meena. | 1. Open the Slot Drawer.<br>2. Click "✅ Confirm Job Done (Seller)".<br>3. Optional: type completion note.<br>4. Approve in MetaMask. | Stepper transitions to Confirmed.<br>Drawer updates to: "✓ You confirmed as Seller (Awaiting Buyer)". | *not run* | Handled via `ConfirmJobModal.tsx` role "seller". |
| **MT4-08** | **Confirm Job Done — Buyer Side** | Slot has started. Account 2 (Meena - Buyer) is connected. Ravi has confirmed seller side. | 1. Open the Slot Drawer or "My Jobs" menu.<br>2. Click "✅ Confirm Job Done (Buyer)".<br>3. Approve in MetaMask. | Stepper transitions to Confirmed.<br>Drawer updates to: "✓ Job Verified on Arkiv (Both Sides Signed)".<br>Status in "My Jobs" switches to "✓ Verified". | *not run* | Handled via `ConfirmJobModal.tsx` role "buyer". |
| **MT4-09** | **Reputation Badge Increment & Proofs** | Both Ravi and Meena have confirmed on-chain. | 1. Switch to Account 1 (Ravi).<br>2. Inspect Ravi's profile in Wallet Menu, Slot Cards, and Slot Drawer. | Reputation badge shows "🏆 1 Verified Job".<br>Clicking "View Proofs" displays expandable list showing Slot Key, Booking Key, Seller Signature Entity Key, and Buyer Signature Entity Key with links to Arkiv Explorer. | *not run* | Derived via pure `getReputation` function. |
| **MT4-10** | **My Jobs Panel Navigation** | Account connected on Tiramisu with active bookings. | 1. Click Wallet Button in Navbar.<br>2. Click "📋 My Jobs & Proofs". | Modal opens listing all jobs where user is seller or buyer.<br>Shows current state (Awaiting Completion, Awaiting Other Side, or Verified).<br>Direct "Confirm Job Done" action button available for eligible jobs. | *not run* | Implemented in `MyJobsModal.tsx`. |
| **MT4-11** | **Two-Wallet Demo Guide** | User wanting to test end-to-end simulation. | 1. Click Wallet Button.<br>2. Click "💡 Two-Wallet Demo Guide". | Modal displays step-by-step Ravi & Meena instructions.<br>Active connected address is prominently displayed.<br>Direct faucet link provided. | *not run* | Implemented in `DemoGuideModal.tsx`. |
| **MT4-12** | **Account Switch Mid-Flow** | In booking or confirmation modal. | 1. Switch account in MetaMask while modal or drawer is open. | UI updates address and permissions immediately without reloading page.<br>Drawer updates between "Your Slot", "Booked by You", and visitor states reactively. | *not run* | Managed by reactive `accountsChanged` listener. |

---

## Verification Summary

- **Automated Unit Tests**: 17 / 17 passed (`scripts/test-phase4-unit.ts`)
- **Automated On-Chain Integration**: Executed via `scripts/test-phase4.ts`
- **Manual Protocol Status**: Specification complete; physical browser execution marked `not run`.
