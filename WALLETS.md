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
| Expires at block | `484782` |
| Created | 2026-10-12 IST (~20:55 IST) |
| Type | `project=slotbazaar, entity_type=expiry_test, synthetic=true` |

---

> Keys live only in `.env` (git-ignored).  
> All transactions are on the **Tiramisu testnet** (chain ID `7738577`).  
> Explorer: https://tiramisu.explorer.arkiv.network
