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

## Demo Data & In-App Seeding (Phase 5)

### Why Demo Seeding Exists
In SlotBazaar, time slots **expire by design**: when a slot's end time passes, Arkiv's decentralized protocol autonomously prunes the entity from the index. To ensure hackathon judges and evaluators always have rich, diverse industrial data to explore and book without waiting for real-world sellers, SlotBazaar provides two seamless ways to seed live demo slots:

1. **In-App "Seed demo data" Button (Navbar & Empty States)**:
   - Connect MetaMask and click **🌱 Seed demo data** in the header or in empty states.
   - Signs and broadcasts **6 synthetic demo slots in a single MetaMask batch transaction** using `wallet.executeBatch`.
   - Fee: ~0.00086 GLM (~0.000143 GLM per slot).
   - Confirms in ~4.9s and automatically fits map bounds to the newly created listings.
2. **CLI Seed Script**:
   - Run from terminal using your private key in `.env`:
     ```bash
     # Preview plan (dry run)
     npm run seed -- --dry-run
     
     # Seed 30 slots including long durations (up to 7 days)
     npm run seed -- --count 30 --long --yes
     ```

### Synthetic Data Transparency
All seeded entities are strictly labelled with `synthetic=true` and tagged with a verifiable batch identifier (`seed_batch="ui-seed-<timestamp>"` or `seed_batch="seed-YYYY-MM-DD"`). They use purely fictional SME trade names (e.g., *PrecisionWorks SME*, *FastMove Logistics*, *IndieDevIndia*) and real coordinates centered on Indian industrial manufacturing hubs.

---

## WebSocket Live Updates

SlotBazaar connects directly to Arkiv's native WebSocket RPC (`wss://rpc.tiramisu.db-chain.testnet.arkiv.network`) using `@arkiv-network/sdk`'s `watchEntityEvents`:
- **Push-based live streaming**: As soon as a transaction confirms on Tiramisu, the node emits an `EntityCreated` log event over the socket (~2550 ms average latency).
- **Debounced 3-query pipeline**: The frontend debounces incoming events by 500 ms and triggers a batch refetch, preserving the immutable 3-query architecture without N+1 query storms.
- **Pill indicator**: The header block pill displays **LIVE** (green pulse) when the WebSocket connection is healthy, and gracefully falls back to **POLLING** (30-second safety net) if disconnected.
- **Client-Side Immediate Expiry**: Because on-chain expiration is passive, the client runs an internal 1-second ticker that removes slots whose `ends_at` has passed (with a 4-second / 1-2 block safety margin) without waiting for server sweeps.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run seed -- --dry-run` | Preview a 40-slot seed plan (no transactions) |
| `npm run seed -- --count 30 --yes` | Seed 30 synthetic slots on-chain |
| `npm run seed -- --long --yes` | Seed slots including long durations (24h, 48h, 72h, up to 7 days / 168h) |
| `npx tsx scripts/test-batch.ts` | Test single-transaction batch creation via `wallet.executeBatch` |
| `npx tsx scripts/test-ws-latency.ts` | Benchmark WebSocket event latency (measures 5 live probes) |
| `npx tsx scripts/test-phase5-unit.ts` | Run Phase 5 pure unit tests (pagination mock, guards, visibility) |
| `npx tsx scripts/measure-cost.ts` | Measure exact GLM cost per createEntity (3h vs 24h) |
| `npx tsx scripts/test-report.ts` | Run automated T-01–T-06 test suite |
| `npm run scan:secrets` | Check for private key leakage across all files + git history |

---

## Friction log

Developer experience notes are in [`/arkiv/friction.md`](./arkiv/friction.md).  
17 friction entries (FR-001–FR-017), append-only, submitted to Arkiv as part of the hackathon.  
GitHub-ready issue reports: [`/arkiv/issues-to-file.md`](./arkiv/issues-to-file.md).

---

## License

MIT © 2026 SlotBazaar Contributors
