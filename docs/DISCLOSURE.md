# Disclosure of Pre-Existing Work & Project Lineage

> **Arkiv Pre-Devcon Hackathon Requirement**  
> **Repository:** [SlotBazaar (GitHub)](https://github.com/VivekGoudAdula/SlotBazaar)  
> **Author:** Vivek Goud Adula

---

## 1. Statement of Originality

I certify that **SlotBazaar was designed, scaffolded, and built entirely from scratch during the hackathon window (9–18 October 2026)**. 

No pre-existing application code, proprietary internal libraries, or prior projects were reused. The entire codebase — from the Arkiv schema definition and viem/Arkiv client wrapper to the interactive Leaflet clustering UI, reputation engine, and WebSocket live subscription pipeline — was authored specifically for this hackathon.

---

## 2. Baseline First Commit Information

* **Baseline Commit SHA:** `8d073160bf920f4967199eddcb03f712c87b0877` (`8d07316`)
* **Commit Message:** `phase 0: scaffold repository, arkiv sdk integration notes, and first on-chain slot entity on tiramisu`
* **Exact Timestamp (IST):** `2026-10-12 21:07:20 +0530` (from `git log --reverse --format="%h %ci %s"`)
* **Initial State & Contents:** Standard Vite + React 19 + TypeScript template scaffold with oxlint, `@arkiv-network/sdk@0.8.1` and `viem@2.57.4`. It included initial project documentation, Arkiv SDK integration notes (`arkiv/notes-sdk.md`), Schema v1 specifications (`arkiv/schema.md`), the friction register (`arkiv/friction.md`), foundational exploratory scripts (`scripts/hello-slot.ts`, `scripts/query-slots.ts`, `scripts/expiry-test.ts`, `scripts/edge-probes.ts`), and the broadcast of the first on-chain slot entity on the Tiramisu testnet.

---

## 3. Third-Party Libraries & Dependency Licenses

Third-party dependencies were audited directly via `npm view <pkg> license` and in-tree license files. Note: while most packages use standard permissive licenses (MIT, Apache-2.0, BSD-2-Clause), `react-leaflet` is licensed under Hippocratic-2.1 (an Ethical Source license with non-harm clauses, distinct from traditional permissive open-source licenses).

```text
npm view outputs:
@arkiv-network/sdk    : (empty in package.json; LICENSE.md is MIT)
leaflet               : BSD-2-Clause
leaflet.markercluster : MIT
react                 : MIT
react-dom             : MIT
react-leaflet         : Hippocratic-2.1
viem                  : MIT
dotenv                : BSD-2-Clause
oxlint                : MIT
puppeteer-core        : Apache-2.0
tsx                   : MIT
typescript            : Apache-2.0
vite                  : MIT
```

| Library / Tool | Version | License | License Category | Purpose in SlotBazaar |
|---|---|---|---|---|
| `@arkiv-network/sdk` | `^0.8.1` | MIT (`LICENSE.md`) | Permissive | Core decentralized state read/write, payload encoding, entity expiration, and event streaming |
| `viem` | `^2.57.4` | MIT | Permissive | EVM account management, hex utilities, and transaction primitives |
| `react` & `react-dom` | `^19.2.8` | MIT | Permissive | Core reactive UI runtime |
| `vite` | `^8.3.0` | MIT | Permissive | Front-end bundler and development server |
| `typescript` | `~6.0.2` | Apache-2.0 | Permissive | Static typing and interface contracts |
| `leaflet` | `^1.9.4` | BSD-2-Clause | Permissive | Interactive open-source web mapping library |
| `react-leaflet` | `^5.0.0` | Hippocratic-2.1 | Ethical Source (not permissive) | React bindings for Leaflet container and tile layers |
| `leaflet.markercluster` | `^1.5.3` | MIT | Permissive | Spatial marker clustering for high-density industrial hubs |
| `dotenv` | `^18.0.7` | BSD-2-Clause | Permissive | Environment variable management for test scripts |
| `tsx` | `^4.23.15` | MIT | Permissive | TypeScript execution for automated test suites |
| `oxlint` | `^1.81.0` | MIT | Permissive | Fast linter for code hygiene |
| `puppeteer-core` | `^25.13.0` | Apache-2.0 | Permissive | Browser automation for latency & origin benchmarks |

---

## 4. Map Attribution & Tile Data

Map background tiles are provided by **OpenStreetMap** contributors under the Open Database License (ODbL).  
Tile attribution: `Map tiles © OpenStreetMap contributors (ODbL) · Powered by Arkiv Tiramisu`.
