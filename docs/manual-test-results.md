# SlotBazaar — Live Deployed Site Manual Verification Results

> **Target Deployed URL:** [https://slotbazaar.vercel.app](https://slotbazaar.vercel.app)  
> **Auditor:** Vivek Goud Adula (or Hackathon Evaluator)  
> **Network:** Arkiv Tiramisu (`chainId: 7738577`)  
> **Date of Evaluation:** `[DATE]`

---

## 1. Zero-Wallet Discovery Checkpoints (Unconnected Mode)

| Test ID | Test Scenario | Expected Behavior | Actual Result | Status | Notes |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **M-01** | Initial Page Load | Map renders centered on India with cluster markers across 5+ industrial corridors | | | |
| **M-02** | Zero-Wallet Browsing | All live slots load and render in list & map without MetaMask popup | | | |
| **M-03** | Cluster Filtering | Clicking cluster buttons filters visible pins and list items without error | | | |
| **M-04** | Category Filtering | Filtering by Machine / Transport / Freelance updates map view | | | |
| **M-05** | Slot Drawer Details | Clicking a slot opens drawer showing duration, cluster, price, and creator | | | |
| **M-06** | On-Chain Proof Inspection | Expanding *"🔐 On-Chain Proof"* displays entity key and links to Arkiv explorer | | | |

---

## 2. Connected Wallet Interactions (Seller & Buyer Flow)

| Test ID | Test Scenario | Expected Behavior | Actual Result | Status | Notes |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **M-07** | Network Switch | Clicking Connect Wallet triggers switch to Arkiv Tiramisu (`0x7614d1`) | | | |
| **M-08** | Post Slot Broadcast | Submitting new slot signs 1 transaction; slot appears in DOM within <3s | | | |
| **M-09** | Multi-Context Streaming | In a second browser window, new slot appears live via WebSocket push | | | |
| **M-10** | Reservation Booking | Buyer clicks "Book This Slot"; booking entity is confirmed on-chain | | | |
| **M-11** | Lock State Rendering | Slot card and drawer reflect locked / booked status across both sessions | | | |
| **M-12** | Mutual Completion | Both seller and buyer sign completion entities on-chain | | | |
| **M-13** | Reputation Badge | Verified job badge (`🏆 1 Verified Job`) updates dynamically on profile | | | |
| **M-14** | Passive Expiration Ticker | Countdown reaches 0:00; expired card drops off without refresh | | | |

---

## 3. Evaluator Sign-Off

- [ ] All checkpoints tested against production deployment `https://slotbazaar.vercel.app`.
- [ ] No unhandled exceptions or critical console errors.
- **Signed:** `___________________________`  
- **Date:** `___________________________`
