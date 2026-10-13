/**
 * src/App.tsx
 *
 * SlotBazaar — Phase 2: Live India Map
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │ Header (logo, chain, wallet)    │
 *   ├─────────────────────────────────┤
 *   │ FilterBar (category chips)      │
 *   ├─────────────────────────────────┤
 *   │                                 │
 *   │         MapView                 │
 *   │   (Leaflet + slot markers)      │
 *   │                                 │
 *   └─────────────────────────────────┘
 *   SlotDrawer (right overlay, on click)
 *
 * Data flows only from Arkiv — no backend, no localStorage as source of truth.
 */

import React, { useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";

import { WalletProvider } from "./lib/wallet.js";
import { useLiveSlots } from "./hooks/useLiveSlots.js";
import type { SlotCategory, SlotEntity } from "./lib/arkiv.js";

import { Header }     from "./components/Header.js";
import { FilterBar }  from "./components/FilterBar.js";
import { MapView }    from "./components/MapView.js";
import { SlotDrawer } from "./components/SlotDrawer.js";

// ─────────────────────────────────────────────────────────────────────────────
// INNER APP (has access to WalletContext)
// ─────────────────────────────────────────────────────────────────────────────

function AppInner(): React.ReactElement {
  const { slots, loading, error, lastFetched, refresh } = useLiveSlots();

  /** Currently active category filter */
  const [activeFilter, setActiveFilter] = useState<SlotCategory | "all">("all");

  /** Slot selected via map marker click — opens the drawer */
  const [selectedSlot, setSelectedSlot] = useState<SlotEntity | null>(null);

  /** Filter slots client-side by category */
  const filteredSlots = useMemo<SlotEntity[]>(() => {
    if (activeFilter === "all") return slots;
    return slots.filter((s) => s.category === activeFilter);
  }, [slots, activeFilter]);

  function handleSelectSlot(slot: SlotEntity): void {
    setSelectedSlot(slot);
  }

  function handleCloseDrawer(): void {
    setSelectedSlot(null);
  }

  return (
    <div className="app-shell">
      {/* Top navigation */}
      <Header />

      {/* Category filter bar */}
      <FilterBar
        active={activeFilter}
        onChange={setActiveFilter}
        slotCount={filteredSlots.length}
        loading={loading}
        lastFetched={lastFetched}
        onRefresh={refresh}
      />

      {/* Map area */}
      <main className="map-wrapper" role="main" aria-label="India slot map">
        {/* Error state */}
        {error && !loading && (
          <div className="overlay-state">
            <div className="error-card" role="alert">
              <div className="error-card__icon">⚡</div>
              <div className="error-card__title">Arkiv Unreachable</div>
              <div className="error-card__msg">{error}</div>
              <button className="error-card__btn" onClick={refresh}>
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading state (first load only — map shows existing data during refresh) */}
        {loading && slots.length === 0 && (
          <div className="overlay-state">
            <div className="loading-card">
              <div className="loading-card__icon">🗺</div>
              <div className="loading-card__title">Loading SlotBazaar…</div>
              <div className="loading-card__subtitle">
                Fetching live slots from Arkiv Tiramisu testnet
              </div>
            </div>
          </div>
        )}

        {/* Empty state (loaded but no slots) */}
        {!loading && !error && slots.length === 0 && (
          <div className="overlay-state">
            <div className="loading-card">
              <div className="loading-card__icon">🌐</div>
              <div className="loading-card__title">No Live Slots</div>
              <div className="loading-card__subtitle">
                The Arkiv index has no active slots right now.
                <br />
                Run <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}>npx tsx scripts/seed.ts</code> to seed test data.
              </div>
            </div>
          </div>
        )}

        {/* The actual map — rendered even during refresh to avoid flicker */}
        <MapView slots={filteredSlots} onSelectSlot={handleSelectSlot} />
      </main>

      {/* Slot detail drawer */}
      <SlotDrawer slot={selectedSlot} onClose={handleCloseDrawer} />

      {/* Bottom connect prompt — only shown when map has slots but wallet is not connected */}
      {slots.length > 0 && <ConnectNudge />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT NUDGE (read wallet state from context)
// ─────────────────────────────────────────────────────────────────────────────

import { useWallet } from "./lib/wallet.js";

function ConnectNudge(): React.ReactElement | null {
  const { status } = useWallet();
  if (status === "connected" || status === "connecting") return null;

  return (
    <div className="connect-prompt" role="status" aria-live="polite">
      <span>👆 Click any pin to browse slots.</span>
      <strong>Connect wallet</strong>
      <span>to book or post a slot.</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP — wraps WalletProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  return (
    <WalletProvider>
      <AppInner />
    </WalletProvider>
  );
}
