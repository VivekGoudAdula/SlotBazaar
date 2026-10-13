# SlotBazaar

> A live India map where SMEs and freelancers post expiring time slots — powered entirely by [Arkiv](https://arkiv.network), the Web3 database.

Built for the **Arkiv Global Tour Stop Hackathon** (9–18 Oct 2026).

---

## What it does

SlotBazaar lets machine owners, transport operators, and freelancers post expiring time slots on an interactive India map. Buyers browse with **no login and no wallet**. To post, book, or confirm a job, users connect MetaMask and sign a real Arkiv transaction on the Tiramisu testnet. Every entity's immutable `$creator` is the wallet address, which powers on-chain reputation.

A slot's Entity Expiration equals its `ends_at` timestamp — so Arkiv removes it automatically. **Without Arkiv the app shows an empty map: Arkiv is the only data layer** — no conventional database, no backend, no localStorage as source of truth.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React 19 + TypeScript |
| Web3 database | `@arkiv-network/sdk` 0.8.1 |
| Wallet / signing | viem + MetaMask (injected provider) |
| Network | Tiramisu testnet (chain ID `7738577`) |
| Map | Leaflet + **OpenStreetMap** raster tiles + marker clustering |

---

## Map tile source

Map tiles are served by [OpenStreetMap](https://www.openstreetmap.org/) contributors.

- **Tile URL:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Attribution:** © OpenStreetMap contributors (required — visible in the map corner)
- **Licence:** [ODbL](https://www.openstreetmap.org/copyright)
- **Usage policy:** https://operations.osmfoundation.org/policies/tiles/
- **No API key required.** SlotBazaar uses OSM tiles for low-volume development/hackathon use, consistent with the [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).

> For production use, switch to a hosted tile provider (e.g. Stadia Maps, MapTiler, or self-hosted OSM tiles via Protomaps).

---

## Network details (add to MetaMask)

| Setting | Value |
|---------|-------|
| Network name | Arkiv Tiramisu |
| RPC URL | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| WebSocket | `wss://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| Chain ID | `7738577` |
| Symbol | GLM |
| Block explorer | https://data.arkiv.network/?chain=tiramisu |

---

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- MetaMask browser extension
- A Tiramisu testnet wallet with test GLM ([faucet](https://faucet.tiramisu.arkiv.network))

### Install

```bash
git clone https://github.com/VivekGoudAdula/SlotBazaar.git
cd SlotBazaar/APP
npm install
```

### Environment

```bash
cp .env.example .env
# Edit .env and paste your private key (for scripts only — browser uses MetaMask)
# PRIVATE_KEY=0x<your-tiramisu-test-key>
```

> ⚠️ **NEVER** commit `.env`. It is in `.gitignore`. Run `npm run scan:secrets` to verify.

### Run dev server

```bash
npm run dev
# Opens at http://localhost:5173
```

### Production build

```bash
npm run build
# Output: dist/
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npx tsx scripts/seed.ts --dry-run` | Preview a 40-slot seed plan (no transactions) |
| `npx tsx scripts/seed.ts --count 30 --yes` | Seed 30 synthetic slots on-chain |
| `npx tsx scripts/seed.ts --count 30 --long --yes` | Include 48h/72h/168h duration slots |
| `npx tsx scripts/measure-cost.ts` | Measure GLM cost per createEntity (3h vs 24h) |
| `npx tsx scripts/test-report.ts` | Run automated T-01–T-06 test suite |
| `npx tsx scripts/fr005-expiry-retest.ts` | 1s-poll expiry boundary retest |
| `npm run scan:secrets` | Check for private key leakage across all files + git history |
| `npx tsx scripts/test-reputation.ts` | Unit-test on-chain reputation logic (no gas) |

---

## Project structure

```
/
├── src/                   # React app (Vite + TypeScript)
│   ├── App.tsx            # Root layout: hero, filters, map, drawer, footer
│   ├── components/
│   │   ├── Header.tsx     # Logo + chain block + wallet button
│   │   ├── FilterBar.tsx  # Category / cluster / price / ending-soon chips
│   │   ├── MapView.tsx    # Leaflet map with marker clustering + pulse animation
│   │   ├── SlotCard.tsx   # Mini popup card (in map popups)
│   │   └── SlotDrawer.tsx # Full detail drawer with on-chain proof panel
│   ├── hooks/
│   │   ├── useLiveSlots.ts  # Polls Arkiv index every 8 s
│   │   ├── useChainHead.ts  # Polls block number every 4 s
│   │   └── useNow.ts        # Ticks every 1 s for countdown accuracy
│   └── lib/
│       ├── arkiv.ts       # All Arkiv read/write + entity type definitions
│       ├── time.ts        # Countdown / urgency / date formatting helpers
│       └── wallet.ts      # MetaMask connection + WalletContext
├── scripts/               # Node/tsx scripts for Arkiv entity ops
├── arkiv/                 # SDK notes, schema v1, friction log (FR-001–FR-011)
│   ├── notes-sdk.md
│   ├── schema.md
│   ├── friction.md        # Append-only friction log (11 entries)
│   └── issues-to-file.md  # GitHub-ready issue reports for Arkiv SDK
├── .env.example           # Copy to .env — never commit .env
├── WALLETS.md             # All wallet addresses and tx hashes (no keys)
└── LICENSE                # MIT 2026
```

---

## UI features (Phase 2)

- **Live India map** with CARTO Positron tiles and marker clustering
- **Teardrop markers** color-coded by category and urgency
- **Vermilion pulse animation** on markers with < 15 minutes remaining
- **FilterBar**: category chips, city dropdown, price band, "Ending soon" toggle
- **SlotDrawer**: full proof panel with entity key (copyable), `$creator`, Entity Expiration block, explorer link
- **Hero strip** with italic accent headline and truck-art divider
- **Mobile bottom sheet** (swipe-up list of slots on < 768px)
- **Non-blocking error banner** — stale data stays on map during RPC failures
- **Footer How-to-try** box with full network details and faucet link
- **Skeleton loading** + friendly empty state

---

## Friction log

Developer experience notes are in [`/arkiv/friction.md`](./arkiv/friction.md).  
11 friction entries (FR-001–FR-011), append-only, submitted to Arkiv as part of the hackathon.  
GitHub-ready issue reports: [`/arkiv/issues-to-file.md`](./arkiv/issues-to-file.md).

---

## License

MIT © 2026 SlotBazaar Contributors
