# SlotBazaar

> A live India map where SMEs and freelancers post expiring time slots — powered entirely by [Arkiv](https://arkiv.network), the Web3 database.

Built for the **Arkiv Global Tour Stop Hackathon** (9–18 Oct 2026).

---

## What it does

SlotBazaar lets machine owners, transport operators, and freelancers post expiring time slots on an interactive India map. Buyers browse with no login and no wallet. To post, book, or confirm a job, users connect MetaMask and sign a real Arkiv transaction on the Tiramisu testnet. Every entity's immutable `$creator` is the wallet address, which powers reputation.

Arkiv is the **only** data layer — no conventional database, no backend, no localStorage as source of truth.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + TypeScript |
| Web3 database | `@arkiv-network/sdk` 0.8.x |
| Wallet / signing | viem + MetaMask (injected) |
| Network | Tiramisu testnet (chain ID `7738577`) |
| Map | Leaflet + CARTO Positron tiles |

---

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- MetaMask browser extension
- A Tiramisu testnet wallet with test GLM (faucet: [tiramisu.explorer.arkiv.network](https://tiramisu.explorer.arkiv.network))

### Install

```bash
git clone <repo-url>
cd slotbazaar
npm install
```

### Environment

```bash
cp .env.example .env
# Edit .env and add your PRIVATE_KEY (for scripts only — browser uses MetaMask)
```

> ⚠️ **NEVER** commit `.env`. It is in `.gitignore`.

### Run dev server

```bash
npm run dev
```

### Run scripts (Phase 0 / seed data)

```bash
# Create a hello-slot entity on Tiramisu
npx tsx scripts/hello-slot.ts

# Query slots
npx tsx scripts/query-slots.ts

# Test entity expiry
npx tsx scripts/expiry-test.ts
```

---

## Project structure

```
/
├── src/               # React app (Vite)
├── scripts/           # Node/tsx scripts for Arkiv entity ops
├── arkiv/             # SDK notes, schema, friction log
│   ├── notes-sdk.md
│   ├── schema.md
│   └── friction.md
├── .env.example       # Copy to .env — never commit .env
├── WALLETS.md         # Wallet addresses and tx hashes (no keys)
└── LICENSE            # MIT 2026
```

---

## Friction log

Developer experience notes are in [`/arkiv/friction.md`](./arkiv/friction.md).  
This is an append-only log submitted to Arkiv as part of the hackathon.

---

## License

MIT © 2026 SlotBazaar Contributors
