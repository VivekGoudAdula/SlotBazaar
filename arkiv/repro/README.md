# Arkiv Friction & Performance Reproducibility Register

This directory contains standalone, reproducible test scripts verifying every protocol friction entry, latency benchmark, and economic cost claim documented across SlotBazaar.

## Prerequisites

1. Node.js v18+ (tested on Node v22)
2. Dependencies installed: `npm install`
3. A funded Arkiv Tiramisu testnet account in `.env`:
   ```bash
   PRIVATE_KEY=0x... # Must hold >= 0.05 testnet GLM
   VITE_ARKIV_RPC_URL=https://rpc.tiramisu.db-chain.testnet.arkiv.network
   ```
   *(Claim free testnet GLM from the [Arkiv Faucet](https://hub.arkiv.network/faucet))*

---

## Reproducibility Index

| Script | Relevant Topic / Friction ID | How to Run | Expected Result |
| :--- | :---: | :--- | :--- |
| [`fr003-uppercase-attribute.ts`](fr003-uppercase-attribute.ts) | **FR-003** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/fr003-uppercase-attribute.ts` | Fails with `EntityMutationError` before broadcast; 0 gas spent on-chain (computed programmatically). |
| [`fr005-expiry-boundary.ts`](fr005-expiry-boundary.ts) | **FR-005** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/fr005-expiry-boundary.ts` | Polls block-by-block; both query and `getEntity` drop at consensus `expiresAt` block (computed programmatically). |
| [`fr011-getentity-call-shape.ts`](fr011-getentity-call-shape.ts) | **FR-011** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/fr011-getentity-call-shape.ts` | Object call fails with `InvalidValueError`; positional `getEntity(key)` succeeds; prints `expiresAt` block number. |
| [`measure-booking-cost.ts`](measure-booking-cost.ts) | **Reputation Economics** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/measure-booking-cost.ts` | Measures 30d, 90d, 365d booking entity GLM costs (~0.000121 GLM each, marginal delta 16 nano-GLM). |
| [`measure-live-latency.ts`](measure-live-latency.ts) | **Live Latency** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/measure-live-latency.ts` | Puppeteer multi-context test measuring block confirmation to DOM render latency (median <1s). |
| [`measure-rpc-load-2min.ts`](measure-rpc-load-2min.ts) | **RPC Load** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/measure-rpc-load-2min.ts` | Measures 2-minute foreground idle RPC request count (14.0 req/min, <15 req/min target). |
| [`test-explorer-urls.ts`](test-explorer-urls.ts) | **FR-016** | `node ./node_modules/tsx/dist/cli.mjs arkiv/repro/test-explorer-urls.ts` | Puppeteer test confirming HTTP 200 on Blockscout (`tiramisu.explorer`) and Data Explorer (`data.arkiv.network`). |
