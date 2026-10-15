# SlotBazaar — Live Deployed Site Manual Verification Results

> **Target Deployed URL:** [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app)<br>
> **Auditor / Tester:** Vivek Goud Adula (User Manual Two-Wallet Run)<br>
> **Audited By Agent:** Antigravity (Code and Evidence Integrity Audit)<br>
> **Network:** Arkiv Tiramisu Testnet (`chainId: 7738577` / `0x7614d1`)<br>
> **Date of Evaluation:** October 2026 (Global Tour Pre-Devcon Hackathon)<br>
> **Wallets Used:**<br>
> - **Seller (Ravi Demo):** `0x55513e667106CD4b259A6BE332FeE1D65E253fc8`<br>
> - **Buyer (Meena Demo):** `0xD87a9d5962430F06437EE8C126DbF42d11178c5D`<br>
> - **User Seed Wallet (Manual Run):** `0xf48E7802a97781cca58750a6e5F1f1ab93763225`

---

## 1. Summary of Verification Methodology

The user has executed an end-to-end live flow across two separate browser sessions with two distinct MetaMask wallets on Arkiv Tiramisu. Per strict integrity guidelines, this report:
1. Records observed behaviors and user-reported confirmations truthfully.
2. Distinguishes between code-verified / automated test proofs and manual user-reported actions.
3. Does **not** invent unprovided transaction hashes, timestamps, or personal reproduction claims.
4. Marks specific transaction hashes as **Pending User Entry** where the live browser transaction logs have not been committed to Git.

---

## 2. End-to-End Scenarios & Checkpoint Matrix

| Scenario # | Test Scenario | Expected Outcome | Verification Status | Source / Evidence |
| :---: | :--- | :--- | :---: | :--- |
| **S-01** | **Open deployed app in fresh browser (Unconnected Mode)** | App loads centered on India; cluster markers and slot cards render; no wallet popup or login required. | **PASS** *(Verified)* | Live site `https://slotbazaar.vercel.app` verified; zero-friction public read queries confirmed. |
| **S-02** | **Connect seller wallet and post slot titled "test slot"** | Connects `0x5551...3fc8` (Ravi); submits slot titled "test slot" via `createSlot`; prompts 1 MetaMask signature. | **PASS (User Reported)** | User reported successful submission. *Tx hash pending user entry.* |
| **S-03** | **Verify listing appears on map with correct wallet creator** | "test slot" appears in cluster pins and card list; drawer displays creator matching `0x5551...3fc8`. | **PASS (User Reported / Code Verified)** | User observed card in UI; unit test `isProductionSlot` confirms slots titled "test slot" are never filtered. |
| **S-04** | **Observe listing in second browser without manual refresh** | New slot streams into peer browser context via WebSocket subscription (`watchEntityEvents`). | **PASS (User Reported / Benchmark Backed)** | User observed live update in second window. Benchmark log (`latency-run2.txt`) shows 8/10 appeared with 2.60s median on localhost; 2 timed out at 35s (fallback polling is implemented, though recovery was not demonstrated in those two samples). |
| **S-05** | **Connect buyer wallet and book the listing** | Buyer connects `0xD87a...8c5D` (Meena); clicks "Book This Slot"; submits on-chain booking entity (`createBooking`). | **PASS (User Reported)** | User reported booking confirmed in MetaMask. *Tx hash pending user entry.* |
| **S-06** | **Verify booking record and visible booked state** | Slot transitions to `🔒 Booked`; drawer displays winning buyer; earliest confirmed block wins. | **PASS (User Reported / Unit Tested)** | User reported booked state visible across sessions; `getWinningBooking` block ordering verified by unit tests. |
| **S-07** | **Seller and buyer separately confirm completion** | Seller signs `createCompletion` (`role="seller"`); buyer signs `createCompletion` (`role="buyer"`); independent entities stored on Arkiv. | **PASS (User Reported)** | User executed both completion signatures. *Tx hashes pending user entry.* |
| **S-08** | **Verify reputation badge changes only after both confirmations** | Seller card unlocks `🏆 1 Verified Job` only when both mutual signatures exist; 1-sided signature gives 0 reputation. | **PASS (User Reported / Unit Tested)** | Verified mathematically in `test-phase4-unit.ts` (1-sided rejected, symmetric accepted); user observed badge appear. |
| **S-09** | **Check countdown timer and actual entity-expiration behavior** | UI countdown ticks to 0:00; client margin (4s) prunes card locally; Arkiv consensus drops entity at block timestamp. | **PASS (Verified)** | Unit tests confirm 4s client pruning (`test-phase5-unit.ts`); on-chain expiration proved by Phase 0 entity `0x40c9...3780` (expired block 484782). |
| **S-10** | **Verify relevant Arkiv explorer records** | Clicking "Explorer ↗" opens `data.arkiv.network/?q={key}&chain=tiramisu`; displays entity attributes and JSON payload. | **PASS (User Reported / Verified)** | URL generation verified in code; explorer inspection confirmed by user during testing. |

---

## 3. Pending Information Required from User

The following specific artifacts were generated during the user's manual MetaMask session and remain available for entry once copied from MetaMask transaction activity:

- [ ] **Seller Slot Creation Tx Hash:** `[PENDING: User to paste tx hash from 0x5551...3fc8 activity]`
- [ ] **Buyer Booking Tx Hash:** `[PENDING: User to paste tx hash from 0xD87a...8c5D activity]`
- [ ] **Seller Completion Tx Hash:** `[PENDING: User to paste tx hash from 0x5551...3fc8 activity]`
- [ ] **Buyer Completion Tx Hash:** `[PENDING: User to paste tx hash from 0xD87a...8c5D activity]`
- [ ] **Video Walkthrough URL:** `[PENDING: User to supply recorded unlisted URL]`

---

## 4. Auditor Conclusion

The manual verification conducted by the user demonstrates that the core user journey—from public zero-wallet discovery, through single-signature slot creation, live multi-client push streaming, fair block-ordered booking, to two-sided symmetric completion and verified reputation—is functionally sound on the live Arkiv Tiramisu testnet.
