# SlotBazaar — 3-Minute Video Demo Script

> **Challenge:** Global Tour Stop: Pre-Devcon Hackathon (Arkiv Network)  
> **Target Video Duration:** 2 minutes 50 seconds (Max limit: 3 minutes 00 seconds)  
> **Resolution:** 1080p (1920 × 1080) at 60 fps  
> **Audio:** Clear voiceover with crisp background-noise suppression

---

## 1. Pre-Recording Preparation Checklist

Before hitting record, ensure the following setup is configured:

- [ ] **Tab 1 (Browser Profile A - Seller):**
  - MetaMask connected to `Account 1 (Seller)` (`0x5349…a6e9`) on Arkiv Tiramisu (`chainId: 60138`).
  - Balance has at least `0.05 GLM` for transaction broadcast.
  - SlotBazaar deployed web app loaded at full screen.
- [ ] **Tab 2 / Window 2 (Browser Profile B - Buyer):**
  - Separate browser window or Incognito with MetaMask connected to `Account 2 (Buyer)`.
  - Positioned side-by-side or prepared for smooth `Alt+Tab`.
- [ ] **Pre-Seeded Network State:**
  - Seeded with ~10–15 active slots across Jeedimetla, Surat, Tiruppur so the map is vibrant on first frame.
- [ ] **Audio & System Checks:**
  - Microphone gain set, test recording verified.
  - Windows notification banners and Slack/Telegram muted.
  - Browser bookmarks bar hidden (`Ctrl+Shift+B`).

---

## 2. Minute-by-Minute Video Timeline (0:00 – 3:00)

### [0:00 – 0:35] Problem & The Idle Capacity Crisis (Slide & Map Intro)
* **Visual:**
  * Quick title screen / problem slide, transitioning to the live SlotBazaar full-width map showing cluster markers across India (Jeedimetla, Surat, Tiruppur, Morbi, Ludhiana).
* **Narration:**
  * *"Across India’s industrial clusters, MSMEs operate high-value capital machinery with 2- to 4-hour idle gaps between batch orders. `[INSERT_SURVEY_FIGURE: e.g. Over XX% of machine shops]` lose thousands of rupees daily because there is no low-cost, decentralized coordination layer. Traditional aggregators demand 20% commissions, while WhatsApp chats are chaotic and unsearchable.*
  * *Welcome to **SlotBazaar** — a decentralized, real-time bazaar for expiring industrial capacity and verifiable MSME reputation, powered entirely by Arkiv Tiramisu."*

---

### [0:35 – 1:10] Live Post with MetaMask & Instant WebSocket Push
* **Visual:**
  * Click **+ Post a slot**.
  * The modal auto-detects GPS (e.g., Jeedimetla, Hyderabad).
  * Select "Machine", title: "CNC Milling Slot (2h)", set expiry to 2 hours from now.
  * Click "Broadcast to Arkiv". MetaMask pops up. Confirm transaction.
  * Switch to Tab 2 (Buyer window side-by-side). Within ~2.5 seconds, the new slot pops up live on Tab 2 via native Arkiv WebSocket without any manual page refresh!
* **Narration:**
  * *"Let's post a slot as Ravi, a workshop owner in Jeedimetla. GPS verifies his cluster. He enters his available 2-hour window and signs with MetaMask. The transaction confirms in one block, costing less than 0.0002 GLM.*
  * *On the right, a buyer's browser receives the event immediately via native Arkiv WebSocket push in under 3 seconds. No polling lag, no middleman."*

---

### [1:10 – 1:45] Booking & Autonomous Expiration
* **Visual:**
  * On Buyer's tab, click the newly posted slot marker.
  * Click **Book Slot**. MetaMask pops up. Confirm booking reservation.
  * Show the card updating to **🔒 Booked** state across both windows.
  * Briefly explain the countdown timer: explain that if left unbooked, the slot drops off the map automatically at consensus expiration time.
* **Narration:**
  * *"Meena, a nearby assembly contractor, spots the slot and clicks 'Book Slot'. This creates an on-chain booking reservation referencing the slot. If multiple buyers race, the earliest confirmed block wins.*
  * *Notice the countdown ticker: if a slot reaches its deadline, Arkiv’s native Entity Expiration autonomously purges it at the consensus layer. No server-side garbage collection is needed."*

---

### [1:45 – 2:20] Two-Sided Completion & Instant Verified Reputation
* **Visual:**
  * Open the slot drawer / **My Jobs** panel on both Seller and Buyer tabs.
  * Seller clicks **Confirm Job Completion** and signs the EIP-712 statement.
  * Buyer clicks **Confirm Job Completion** and signs the symmetric buyer statement.
  * The receipt updates instantly, unlocking the **🏆 1 Verified Job** reputation badge on the seller's card and wallet profile.
  * Click **Hide Proofs ▲** to reveal the linked cryptographic signatures.
* **Narration:**
  * *"Once the physical work is finished, both parties sign an EIP-712 job completion statement. Arkiv records both cryptographic receipts.*
  * *Because both signatures match the on-chain slot creator and winning buyer, SlotBazaar's pure reputation engine instantly increments Ravi’s verified jobs score. It's tamper-proof, portable reputation owned by the SME, not locked inside a proprietary database."*

---

### [2:20 – 2:45] On-Chain Explorer Proof & Architecture
* **Visual:**
  * Click **Explorer ↗** from the proof drawer, opening `data.arkiv.network/?q=0x...&chain=tiramisu`.
  * Highlight the raw immutable entity, attributes (`cluster`, `starts_at`, `ends_at`), and block expiration height.
  * Quick transition to the Architecture diagram in `docs/WHY_ARKIV.md`.
* **Narration:**
  * *"Clicking 'Explorer' verifies the raw on-chain entity directly on Arkiv Tiramisu. The booking entity has a 30-day lifetime preserving the proof even after the temporary slot expires.*
  * *Postgres allows platform operators to rewrite history; IPFS cannot execute attribute range queries; Subgraphs are only event indexers. Arkiv is the only data layer built for perishable, verifiable real-world capacity."*

---

### [2:45 – 3:00] Friction Log & Conclusion
* **Visual:**
  * Open `/arkiv/friction.md` showing the summary table with 17 documented friction entries and upstream issue links.
  * Return to map view with footer attribution and github link.
* **Narration:**
  * *"We documented 17 detailed protocol friction points and latency benchmarks in our friction log to help Arkiv grow.*
  * *SlotBazaar proves that decentralized, autonomous entity expiration unlocks real economic coordination for millions of Indian MSMEs. Try it live at our deployed URL. Thank you!"*

---

## 3. Post-Recording Quality Checklist
- [ ] Video duration is under 3 minutes (e.g. 2:50).
- [ ] Resolution is sharp 1080p without blurry text.
- [ ] Sound volume is balanced and audible without clipping.
- [ ] Uploaded as unlisted or public on YouTube or Loom with link added to `docs/submission-answers.md`.
