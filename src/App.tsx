/**
 * src/App.tsx — SlotBazaar Phase 2B
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │  Header (logo · chain block · wallet)  │
 *   ├────────────────────────────────────────┤
 *   │  Hero strip (italic accent headline)   │
 *   ├────────────────────────────────────────┤
 *   │  FilterBar (cat · cluster · price · 🔴)│
 *   ├────────────────────────────────────────┤
 *   │  Map (full remaining height)           │
 *   │  ┌── SlotDrawer (right overlay) ──┐    │
 *   │  └────────────────────────────────┘    │
 *   │  ── Mobile bottom sheet (< 768px) ──   │
 *   ├────────────────────────────────────────┤
 *   │  Footer (How to try · network details) │
 *   └────────────────────────────────────────┘
 *
 * Error policy: on RPC failure, show a banner BUT keep stale data on the map.
 * Never show an empty list on error if we have cached slots.
 */

import React, { useState, useMemo, useCallback } from "react";
import "leaflet/dist/leaflet.css";

import { WalletProvider, useWallet } from "./lib/wallet.js";
import { useLiveSlots }              from "./hooks/useLiveSlots.js";
import type { SlotEntity } from "./lib/arkiv.js";

import { Header }     from "./components/Header.js";
import { FilterBar, type FilterState }  from "./components/FilterBar.js";
import { MapView }    from "./components/MapView.js";
import { SlotDrawer } from "./components/SlotDrawer.js";
import { useNow }     from "./hooks/useNow.js";

// ─────────────────────────────────────────────────────────────────────────────
// HERO STRIP
// ─────────────────────────────────────────────────────────────────────────────

function HeroStrip(): React.ReactElement {
  return (
    <div className="hero-strip" role="banner" aria-label="SlotBazaar headline">
      <div className="hero-strip__content">
        <span className="hero-strip__eyebrow">🇮🇳  Live · On-chain · No backend</span>
        <h1 className="hero-strip__headline">
          Every slot expires. <em>Claim it before the chain does.</em>
        </h1>
        <span className="hero-strip__accent">Powered entirely by Arkiv — Tiramisu testnet</span>
      </div>
      {/* Truck-art divider */}
      <div className="truck-art" aria-hidden="true">
        🚚 · ⚙️ · 💻 · 🚚 · ⚙️ · 💻 · 🚚
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADING
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonOverlay(): React.ReactElement {
  return (
    <div className="overlay-state" role="status" aria-label="Loading slots from Arkiv">
      <div className="loading-card">
        <div className="loading-card__icon">🗺</div>
        <div className="loading-card__title">Loading SlotBazaar…</div>
        <div className="loading-card__subtitle">
          Fetching live slots from Arkiv Tiramisu testnet
        </div>
        <div className="skeleton-rows" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR BANNER (non-blocking — stays above map, keeps stale data)
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.ReactElement {
  return (
    <div className="error-banner" role="alert" aria-live="assertive" id="error-banner">
      <span className="error-banner__icon" aria-hidden="true">⚡</span>
      <span className="error-banner__msg">Arkiv RPC error — showing cached data. {message}</span>
      <button className="error-banner__btn" onClick={onRetry} id="error-banner-retry">
        Retry
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState(): React.ReactElement {
  return (
    <div className="overlay-state" id="empty-state">
      <div className="loading-card">
        <div className="loading-card__icon">🌐</div>
        <div className="loading-card__title">No Live Slots</div>
        <div className="loading-card__subtitle">
          The Arkiv index has no active slots right now.
          <br />
          Run{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8em" }}>
            npx tsx scripts/seed.ts --count 30 --yes
          </code>{" "}
          to seed 30 test slots.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE BOTTOM SHEET (portrait phone — slot list)
// ─────────────────────────────────────────────────────────────────────────────

function MobileSheet({
  slots,
  onSelect,
}: {
  slots: SlotEntity[];
  onSelect: (s: SlotEntity) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const now = useNow();

  return (
    <div className={`mobile-sheet${open ? " mobile-sheet--open" : ""}`} id="mobile-sheet">
      <button
        className="mobile-sheet__handle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Collapse slot list" : "Expand slot list"}
        id="mobile-sheet-toggle"
      >
        <span className="mobile-sheet__pill" aria-hidden="true" />
        {open ? "▼ Collapse" : `▲ ${slots.length} slots`}
      </button>

      {open && (
        <div className="mobile-sheet__list" role="list" aria-label="Slot list">
          {slots.length === 0 && (
            <p className="mobile-sheet__empty">No slots match the current filters.</p>
          )}
          {slots.map((s) => {
            const remaining = s.endsAt - now;
            const isCritical = remaining > 0 && remaining <= 15 * 60;
            return (
              <div
                key={s.key}
                role="listitem"
                className={`mobile-slot-row${isCritical ? " mobile-slot-row--critical" : ""}`}
                onClick={() => { setOpen(false); onSelect(s); }}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelect(s)}
                aria-label={`${s.title}, ${s.cluster}, ends ${new Date(s.endsAt * 1000).toLocaleTimeString("en-IN")}`}
              >
                <span className="mobile-slot-row__icon" aria-hidden="true">
                  {s.category === "machine" ? "⚙️" : s.category === "transport" ? "🚚" : "💻"}
                </span>
                <div className="mobile-slot-row__body">
                  <div className="mobile-slot-row__title">{s.title}</div>
                  <div className="mobile-slot-row__sub">
                    {s.cluster} · {isCritical ? "🔴 " : ""}{remaining > 0 ? `${Math.floor(remaining / 60)}m left` : "Expired"}
                  </div>
                </div>
                <span className="mobile-slot-row__arrow" aria-hidden="true">›</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER — "How to Try" box
// ─────────────────────────────────────────────────────────────────────────────

function Footer(): React.ReactElement {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer__how-to">
        <h2 className="footer__how-title">⚡ How to try</h2>
        <ol className="footer__steps">
          <li>
            Get free testnet GLM from the{" "}
            <a
              href="https://faucet.tiramisu.arkiv.network"
              target="_blank"
              rel="noopener noreferrer"
              className="footer__link"
              id="footer-faucet-link"
            >
              Tiramisu Faucet ↗
            </a>
          </li>
          <li>
            Add Tiramisu to MetaMask — network details:
            <div className="footer__network-card">
              <div><strong>Network name:</strong> Arkiv Tiramisu</div>
              <div><strong>RPC URL:</strong> <code>https://rpc.tiramisu.db-chain.testnet.arkiv.network</code></div>
              <div><strong>Chain ID:</strong> 7738577</div>
              <div><strong>Symbol:</strong> GLM</div>
              <div>
                <strong>Explorer:</strong>{" "}
                <a
                  href="https://explorer.tiramisu.arkiv.network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__link"
                  id="footer-explorer-link"
                >
                  explorer.tiramisu.arkiv.network ↗
                </a>
              </div>
            </div>
          </li>
          <li>Click <strong>Connect Wallet</strong> in the top bar.</li>
          <li>Click any pin on the map and tap <strong>Book</strong> to claim a slot.</li>
        </ol>
      </div>
      <p className="footer__notice">
        SlotBazaar is a hackathon demo running on Arkiv Tiramisu testnet. No real funds involved.
      </p>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER APP
// ─────────────────────────────────────────────────────────────────────────────

function AppInner(): React.ReactElement {
  const { slots, loading, error, lastFetched, refresh } = useLiveSlots();

  const [filters, setFilters] = useState<FilterState>({
    category:  "all",
    cluster:   "all",
    priceBand: "all",
    endingSoon: false,
  });

  const [selectedSlot, setSelectedSlot] = useState<SlotEntity | null>(null);
  const now = useNow();

  /** Unique sorted cluster names from the live slot list */
  const clusters = useMemo<string[]>(
    () => [...new Set(slots.map((s) => s.cluster))].sort(),
    [slots]
  );

  /** Apply all active filters */
  const filteredSlots = useMemo<SlotEntity[]>(() => {
    return slots.filter((s) => {
      if (filters.category  !== "all" && s.category  !== filters.category)  return false;
      if (filters.cluster   !== "all" && s.cluster   !== filters.cluster)   return false;
      if (filters.priceBand !== "all" && s.priceBand !== filters.priceBand) return false;
      if (filters.endingSoon && (s.endsAt - now) > 30 * 60)                 return false;
      return true;
    });
  }, [slots, filters, now]);

  const handleSelect   = useCallback((slot: SlotEntity) => setSelectedSlot(slot), []);
  const handleClose    = useCallback(() => setSelectedSlot(null), []);
  const handleFilters  = useCallback((f: FilterState) => setFilters(f), []);

  return (
    <div className="app-shell">
      <Header />
      <HeroStrip />
      <FilterBar
        filters={filters}
        onChange={handleFilters}
        clusters={clusters}
        slotCount={filteredSlots.length}
        totalCount={slots.length}
        loading={loading}
        lastFetched={lastFetched}
        onRefresh={refresh}
      />

      {/* Non-blocking error banner (keeps stale map data visible) */}
      {error && (
        <ErrorBanner message={error} onRetry={refresh} />
      )}

      <main className="map-wrapper" role="main" aria-label="India slot map">
        {/* Skeleton: first load, no data yet, no error */}
        {loading && slots.length === 0 && !error && <SkeletonOverlay />}

        {/* Empty state: loaded fine but genuinely no slots */}
        {!loading && !error && slots.length === 0 && <EmptyState />}

        {/* The map — always rendered so it never disappears on refresh */}
        <MapView slots={filteredSlots} onSelectSlot={handleSelect} />

        {/* Mobile bottom sheet */}
        <MobileSheet slots={filteredSlots} onSelect={handleSelect} />
      </main>

      <SlotDrawer slot={selectedSlot} onClose={handleClose} />

      <ConnectNudge slotCount={slots.length} />

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT NUDGE
// ─────────────────────────────────────────────────────────────────────────────

function ConnectNudge({ slotCount }: { slotCount: number }): React.ReactElement | null {
  const { status } = useWallet();
  if (slotCount === 0 || status === "connected" || status === "connecting") return null;
  return (
    <div className="connect-prompt" role="status" aria-live="polite">
      <span>👆 Click any pin to browse slots.</span>
      <strong>Connect wallet</strong>
      <span>to book or post.</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  return (
    <WalletProvider>
      <AppInner />
    </WalletProvider>
  );
}
