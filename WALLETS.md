# SlotBazaar — Wallet Registry

This file tracks every wallet address used in SlotBazaar development.
**NEVER record private keys here or anywhere in the repo.**

| Address | Role | Purpose | Notable Tx Hash |
|---------|------|---------|-----------------|
| `0x53491aA366E086C19da948669b340317eE6eA6e9` | seed-wallet / phase-0 | Creates synthetic slot entities for Phase 0 testing | `0xe8bca88098bb0525dd4c865f28d757e383f04a44b2ff01fbbb2a1025cd069ed2` |

---

## Phase 0 Entities

### 1. Hello-Slot Entity (Primary Slot)

| Field | Value |
|-------|-------|
| Entity key | `0xae9bcc84c5060776a107ccc0aedeb6b496ee5608e8f3e7cd51cd87001638918d` |
| Tx hash | `0xe8bca88098bb0525dd4c865f28d757e383f04a44b2ff01fbbb2a1025cd069ed2` |
| Explorer | https://tiramisu.explorer.arkiv.network/tx/0xe8bca88098bb0525dd4c865f28d757e383f04a44b2ff01fbbb2a1025cd069ed2 |
| Expires at block | `489834` |
| Created | 2026-10-12 IST |
| Type | `project=slotbazaar, entity_type=slot, category=machine, cluster=surat` |

### 2. Expiry-Test Entity (Short-lived 10 min)

| Field | Value |
|-------|-------|
| Entity key | `0x40c9380d0ec3a4f3273544209436833fc1005bd7e61f5a37d755cabb8a0d3780` |
| Tx hash | `0x6ba82dbc4c391f9c202b307a57ae21547f53b791814ba6e081ea55939a3bd5fb` |
| Explorer | https://tiramisu.explorer.arkiv.network/tx/0x6ba82dbc4c391f9c202b307a57ae21547f53b791814ba6e081ea55939a3bd5fb |
| Expires at block | `484782` (CONFIRMED EXPIRED) |
| Created | 2026-10-12 IST (~20:55 IST) |
| Type | `project=slotbazaar, entity_type=expiry_test, synthetic=true` |

---

## Phase 1 Entities & Wallets

### Wallets

| Address | Role | Purpose | Notable Tx Hash |
|---------|------|---------|-----------------|
| `0x53491aA366E086C19da948669b340317eE6eA6e9` | Primary Seller Wallet | Creates slots and seller completions | `0xcabe8699e565c9bcec217c8d9b78a637764f22e0309c2f98227d0c4a239ff94d` |
| `0x2fEA91303BB18B3Cb91742b834bd6672e22bD19b` | Ephemeral Buyer Wallet | Books slot and creates buyer completion | `0xb82617d5e8637983c33920a8784e97125f926391fea40023f972f82e5118e665` |

### Entities

| Entity | Key | Tx Hash | Role / Type |
|--------|-----|---------|-------------|
| Slot A | `0xb88001059d23f8b1c42b653fb8df229038ce78cbca70e3ec592330e9e71021d3` | `0xcabe8699e565c9bcec217c8d9b78a637764f22e0309c2f98227d0c4a239ff94d` | `category=machine, cluster=surat` |
| Slot B | `0x979336bfb2aeda98fa12034fce0637eeb86bbd40a9713192db4c06f85f73d236` | `0x74efc4847d8fa2c9b6eb1f73301ad2f7c3d4ce1c304948d475af73b65aeca28d` | `category=transport, cluster=mumbai` |
| Slot C | `0xc7afe2e8309c58b51ef8af189d39ecf362e72cf1294cc02d39cde79745a4a28d` | `0x43a0a4ef66259f6cf8f838619d0dd962464fc6e94802efb293f92d53c18046d9` | `category=freelance, cluster=bengaluru` |
| Booking A | `0x35f7c0cb6b97e1e0e0b0e8d4d6919ee16a3cce096dbbe1db745e3fb0e153a0dc` | `0xb82617d5e8637983c33920a8784e97125f926391fea40023f972f82e5118e665` | Booked by Ephemeral Buyer |
| Completion (Seller) | `0xe28b740c41fdedf29c2737b6cc160845e0e03a623d215c86837cee0aa107ffe6` | `0x0b98c1d92ceb2683f8a4c5f02a2b77f15e675250bd0badf3e1fc9fcf13d0d2df` | `role=seller` |
| Completion (Buyer) | `0x084a5da908bd64c4b93ef1f1012edb7976caecba35a0b272939ddc16509f1f88` | `0x506eecd36162d2ad4f04c6c1ff785b092f43eed3d37dd362810292123b5c0b61` | `role=buyer` |

---

> Keys live only in `.env` (git-ignored).  
> All transactions are on the **Tiramisu testnet** (chain ID `7738577`).  
> Explorer: https://tiramisu.explorer.arkiv.network
