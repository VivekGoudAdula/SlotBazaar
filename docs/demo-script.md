# SlotBazaar — 2-Minute 40-Second Video Demo Script

> **Challenge:** Global Tour Stop: Pre-Devcon Hackathon (Arkiv Network)  
> **Target Video Duration:** Exactly 2 minutes 40 seconds (160 seconds total, ~385 words at ~2.4 words/second)  
> **Resolution:** 1080p (1920 × 1080) at 60 fps  
> **Audio:** Clear voiceover with crisp background-noise suppression  

---

## 1. Pre-Recording Setup & Demo Accounts

| Role | Persona | Demo Account | Initial Balance | Window Setup |
| :--- | :--- | :--- | :--- | :--- |
| **Seller** | Ravi (Precision CNC Workshop, Jeedimetla) | `0x5551…3fc8` (`0x55513e667106CD4b259A6BE332FeE1D65E253fc8`) | >= 0.05 testnet GLM | Left half-screen / Primary Window |
| **Buyer** | Meena (Contract Assembler, Balanagar) | `0xD87a…8c5D` (`0xD87a9d5962430F06437EE8C126DbF42d11178c5D`) | >= 0.05 testnet GLM | Right half-screen / Incognito Window |

> [!NOTE]
> Demo accounts `0x5551…3fc8` (Ravi) and `0xD87a…8c5D` (Meena) are registered in [`WALLETS.md`](../WALLETS.md). Real private keys are never committed or broadcast.

---

## 2. UI Label & Button Verification Table

Every UI label, button text, and modal heading used in this script has been audited directly against the application source code:

| Script Label / Action | Exact UI Source Label | Source Code Location | Verification Status |
| :--- | :--- | :--- | :---: |
| Header post button | `+ Post a slot` | [`src/components/Header.tsx`](../src/components/Header.tsx#L189) | Verified Match |
| Post modal broadcast | `Post to Arkiv` | [`src/components/PostSlotModal.tsx`](../src/components/PostSlotModal.tsx#L1024) | Verified Match |
| Drawer book button | `🤝 Book This Slot` | [`src/components/SlotDrawer.tsx`](../src/components/SlotDrawer.tsx#L594) | Verified Match |
| Booking modal confirmation | `Confirm Booking` | [`src/components/BookSlotModal.tsx`](../src/components/BookSlotModal.tsx#L378) | Verified Match |
| Seller completion button | `✅ Confirm Job Completion (Seller)` | [`src/components/SlotDrawer.tsx`](../src/components/SlotDrawer.tsx#L533) | Verified Match |
| Buyer completion button | `✅ Confirm Job Done (Buyer)` | [`src/components/SlotDrawer.tsx`](../src/components/SlotDrawer.tsx#L568) | Verified Match |
| Mutual sign action | `Sign as Seller` / `Sign as Buyer` | [`src/components/ConfirmJobModal.tsx`](../src/components/ConfirmJobModal.tsx#L347) | Verified Match |
| Proofs disclosure toggle | `Hide Proofs ▲` / `View Proofs ({count}) ▼` | [`src/components/SlotDrawer.tsx`](../src/components/SlotDrawer.tsx#L342) | Verified Match |
| On-chain explorer link | `Explorer ↗` | [`src/components/SlotDrawer.tsx`](../src/components/SlotDrawer.tsx#L459) | Verified Match |
| Wallet dropdown menu | `💼 My Jobs & Proofs` | [`src/components/WalletButton.tsx`](../src/components/WalletButton.tsx#L291) | Verified Match |
| Reputation badge | `🏆 1 Verified Job` | [`src/components/SlotDrawer.tsx`](../src/components/SlotDrawer.tsx#L274) | Verified Match |

---

## 3. Second-by-Second Video Timeline (Total: 2:40 / 160s / 385 words)

### [0:00 – 0:25] Segment 1: Problem & Why India (25 seconds, 62 words)
* **Visual:** Full-screen live SlotBazaar map centered on India, showing active industrial cluster pins in Jeedimetla, Surat, Tiruppur, Morbi, and Ludhiana.
* **Narration:**
  > *"Across industrial manufacturing clusters in India, machine shops face uncoordinated idle gaps between batch orders. 76% of our 46 survey respondents say their machine or time sits idle almost every day, and 63% said what would make them trust a stranger is past jobs confirmed by both sides, which is exactly the reputation SlotBazaar records on-chain without broker fees or platform commissions."*

---

### [0:25 – 0:45] Segment 2: The Four Scoring Pillars (20 seconds, 51 words)
* **Visual:** Brief overlay or popover showing the four hackathon evaluation pillars with checkmarks: 1. Why India, 2. Why Arkiv, 3. How We Use Arkiv, 4. Friction Log.
* **Narration:**
  > *"Here is how SlotBazaar addresses each hackathon criterion: Why India, tackling cluster machine under-utilization; Why Arkiv, leveraging native cryptographic expiration; How we use Arkiv, storing slots, reservations, and two-sided completion proofs on Tiramisu; and Friction, documenting 6 SDK and DX findings, 1 cosmetic error message typo, and 10 detailed protocol notes."*

---

### [0:45 – 1:15] Segment 3: Seller Posts a Slot & Instant Push (30 seconds, 69 words)
* **Visual:** In Profile A (Ravi, `0x5551…3fc8`), click **+ Post a slot**. Select Jeedimetla cluster, CNC category, 2-hour duration. Click **Post to Arkiv**. Confirm MetaMask. In Profile B (Meena, `0xD87a…8c5D`) side-by-side, the slot pin appears live without page refresh.
* **Narration:**
  > *"Ravi, a precision workshop owner in Jeedimetla, clicks '+ Post a slot'. He selects a two-hour window for his CNC mill and clicks 'Post to Arkiv'. MetaMask confirms the transaction in one block, costing about 0.00014 testnet GLM. Instantly, Meena’s browser receives the slot via native Arkiv WebSocket streaming. Our measured latency has a 0.74-second median from block confirmation to DOM update, with no polling delay."*

---

### [1:15 – 1:40] Segment 4: Buyer Books & Autonomous Expiration (25 seconds, 55 words)
* **Visual:** On Meena's window (`0xD87a…8c5D`), click the new slot pin. Drawer opens. Click **🤝 Book This Slot**. Modal opens, click **Confirm Booking**. MetaMask confirms. Status turns to `🔒 Booked`. Zoom in on countdown timer ticking down.
* **Narration:**
  > *"Meena needs precision milling nearby. She clicks '🤝 Book This Slot' and confirms the transaction. Arkiv records her reservation entity on-chain; the earliest block wins. Look at the countdown timer: if a slot goes unbooked, Arkiv’s native expiration autonomously removes it at consensus timestamp. No server-side cleanup cron or backend database is ever required."*

---

### [1:40 – 2:05] Segment 5: Two-Sided Completion & Verified Reputation (25 seconds, 60 words)
* **Visual:** Physical work is done. On Ravi's drawer, click **✅ Confirm Job Completion (Seller)** -> **Sign as Seller**. On Meena's drawer, click **✅ Confirm Job Done (Buyer)** -> **Sign as Buyer**. Drawer updates instantly showing the `🏆 1 Verified Job` reputation badge.
* **Narration:**
  > *"After the physical milling completes, both parties sign mutual completion entities on Arkiv Tiramisu. Ravi clicks 'Confirm Job Completion' as seller, and Meena signs as buyer. Arkiv verifies both wallet signatures, immediately unlocking the '🏆 1 Verified Job' badge on Ravi's card. This portable reputation is verifiable on-chain and persists for 30 days without centralized platform lock-in."*

---

### [2:05 – 2:25] Segment 6: On-Chain Explorer Proof & Architecture (20 seconds, 49 words)
* **Visual:** In the drawer, expand **View Proofs (2) ▼** and click **Explorer ↗**. Opens Blockscout (`tiramisu.explorer.arkiv.network/tx/...`) and Data Explorer (`data.arkiv.network/?q=0x...&chain=tiramisu`). Highlight raw entity attributes (`starts_at`, `ends_at`, `cluster`).
* **Narration:**
  > *"Clicking 'Explorer' opens the decentralized entity directly on the Arkiv data explorer. Notice the raw attributes, block timestamp, and cryptographic proof. Each booking entity costs about 0.00012 testnet GLM. While Postgres can be manipulated and IPFS cannot filter queries, Arkiv provides native range indexing and verifiable decentralized expiration."*

---

### [2:25 – 2:40] Segment 7: Friction Log Highlights & Conclusion (15 seconds, 40 words)
* **Visual:** Open `/arkiv/friction.md`, showing the auto-generated summary table with reproducible scripts and upstream issue links. Pan back to live map with header links.
* **Narration:**
  > *"We documented 6 SDK and developer-experience findings, 1 cosmetic error message typo, and 10 protocol notes with reproducible scripts in our friction report. SlotBazaar demonstrates real-world decentralized coordination for Indian manufacturing. Try the live demo at slotbazaar.vercel.app. Thank you!"*

---

## 4. Post-Recording Quality Checklist

- [ ] Video duration is exactly 2:40 (or within 2:35–2:45).
- [ ] Crisp 1080p resolution with legible UI text.
- [ ] No audio clipping or harsh background noise.
- [ ] Uploaded to YouTube (Unlisted) or Loom, with link added to `docs/submission-answers.md`.
