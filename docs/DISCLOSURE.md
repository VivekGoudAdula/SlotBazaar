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

* **Baseline Commit SHA:** `8d073160bf920f4967199eddcb03f712c87b0877`
* **Commit Message:** `phase 0: scaffold repository, arkiv sdk integration notes, and first on-chain slot entity on tiramisu`
* **Date:** 12 October 2026 (21:07 IST, commit `8d07316`)
* **Initial State:** Standard Vite + React + TypeScript template initialization with the initial installation of `@arkiv-network/sdk@0.8.1` and `viem@2.57.4`.

---

## 3. Third-Party Libraries & Boilerplate Components

All third-party dependencies utilized in SlotBazaar are standard open-source libraries licensed under permissive MIT / Apache 2.0 / BSD licenses:

| Library / Tool | Version | License | Purpose in SlotBazaar |
|---|---|---|---|
| `@arkiv-network/sdk` | `^0.8.1` | Apache-2.0 | Core decentralized state read/write, payload encoding, entity expiration, and event streaming |
| `viem` | `^2.57.4` | MIT | EVM account management, hex utilities, and transaction primitives |
| `react` & `react-dom` | `^19.2.8` | MIT | Core reactive UI runtime |
| `vite` | `^8.3.0` | MIT | Front-end bundler and development server |
| `typescript` | `~6.0.2` | Apache-2.0 | Static typing and interface contracts |
| `leaflet` | `^1.9.4` | BSD-2-Clause | Interactive open-source web mapping library |
| `react-leaflet` | `^5.0.0` | Hippocratic-2.1 | React bindings for Leaflet container and tile layers |
| `leaflet.markercluster` | `^1.5.3` | MIT | Spatial marker clustering for high-density industrial hubs |
| `dotenv` | `^18.0.7` | BSD-2-Clause | Environment variable management for test scripts |
| `tsx` | `^4.23.15` | MIT | TypeScript node execution for automated test suites |
| `oxlint` | `^1.81.0` | MIT | Fast linter for code hygiene |

---

## 4. Map Attribution & Tile Data

Map background tiles are provided by **OpenStreetMap** contributors under the Open Database License (ODbL).
Tile attribution: `Map tiles © OpenStreetMap contributors (ODbL)`.
