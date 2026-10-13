/**
 * src/App.tsx — SlotBazaar Phase 2C
 *
 * Layout (desktop ≥768px):
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  Header (paper bg · ink border · hard shadow)             │
 *   ├─────────────────────────┬──────────────────────────────────┤
 *   │  Hero strip             │                                  │
 *   ├─────────────────────────┤    Map 60%                       │
 *   │  FilterBar              │                                  │
 *   ├─────────────────────────┤                                  │
 *   │  Slot list (scrollable) │                                  │
 *   │  40%                    │                                  │
 *   └─────────────────────────┴──────────────────────────────────┘
 *   Footer (full width below)
 *
 * Layout (mobile <768px):
 *   ┌──────────────────────────┐
 *   │  Header                  │
 *   ├──────────────────────────┤
 *   │  Map (top, fixed height) │
 *   ├──────────────────────────┤
 *   │  FilterBar               │
 *   ├──────────────────────────┤
 *   │  Draggable bottom sheet  │
 *   │  (slot list)             │
 *   └──────────────────────────┘
 *
 * Error policy: on RPC failure show a banner AND keep stale markers.
 * Never clear the slot list on error if we have cached data.
 */

import React, { useState, useMemo, useCallback, useRef } from "react";
import "leaflet/dist/leaflet.css";

import { WalletProvider, useWallet } from "./lib/wallet.js";
import { useLiveSlots }              from "./hooks/useLiveSlots.js";
import type { SlotEntity }           from "./lib/arkiv.js";

import { Header }                        from "./components/Header.js";
import { FilterBar, type FilterState }   from "./components/FilterBar.js";
import { MapView }                       from "./components/MapView.js";
import { SlotDrawer }                    from "./components/SlotDrawer.js";
import { useNow }                        from "./hooks/useNow.js";
import { formatTimeLeft }                from "./lib/time.js";

// ─────────────────────────────────────────────────────────────────────────────
// HERO STRIP
// ─────────────────────────────────────────────────────────────────────────────

function HeroStrip(): React.ReactElement {
  return (
    <div className="hero-strip" role="banner" aria-label="SlotBazaar headline">
      <div className="hero-strip__content">
        <span className="hero-strip__eyebrow">🇮🇳&nbsp; Live · On-chain · No backend</span>
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
// ERROR BANNER (non-blocking)
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
      <span className="error-banner__msg">
        Arkiv RPC error — showing cached data.{" "}
        <span style={{ opacity: 0.8, fontSize: "0.8em" }}>{message}</span>
      </span>
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
// DESKTOP SLOT LIST (right sidebar scroll)
// ─────────────────────────────────────────────────────────────────────────────

function SlotList({
  slots,
  onSelect,
  onFlyTo,
}: {
  slots:    SlotEntity[];
  onSelect: (s: SlotEntity) => void;
  onFlyTo:  (s: SlotEntity) => void;
}): React.ReactElement {
  const now = useNow();

  if (slots.length === 0) {
    return (
      <div className="slot-list__empty" id="slot-list-empty">
        <span>No slots match the filters.</span>
      </div>
    );
  }

  // Sort soonest-expiring first
  const sorted = [...slots].sort((a, b) => a.endsAt - b.endsAt);

  return (
    <div className="slot-list" role="list" aria-label="Slot list" id="slot-list">
      {sorted.map((s) => {
        const remaining = s.endsAt - now;
        const isCritical = remaining > 0 && remaining <= 15 * 60;
        return (
          <div
            key={s.key}
            role="listitem"
            className={`slot-list-row${isCritical ? " slot-list-row--critical" : ""}`}
            onClick={() => { onSelect(s); onFlyTo(s); }}
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && (onSelect(s), onFlyTo(s))}
            aria-label={`${s.title}, ${s.cluster}, ${formatTimeLeft(s.endsAt, now)} remaining`}
          >
            <span className={`slot-list-row__dot slot-list-row__dot--${s.category}`} aria-hidden="true" />
            <div className="slot-list-row__body">
              <div className="slot-list-row__title">{s.title}</div>
              <div className="slot-list-row__sub">
                {s.cluster} · {s.category}
                {s.synthetic && (
                  <span className="slot-list-row__synthetic">DEMO</span>
                )}
              </div>
            </div>
            <div className={`slot-list-row__time${isCritical ? " slot-list-row__time--critical" : ""}`}>
              {formatTimeLeft(s.endsAt, now)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

function MobileSheet({
  slots,
  onSelect,
  onFlyTo,
}: {
  slots:    SlotEntity[];
  onSelect: (s: SlotEntity) => void;
  onFlyTo:  (s: SlotEntity) => void;
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
          {[...slots].sort((a, b) => a.endsAt - b.endsAt).map((s) => {
            const remaining = s.endsAt - now;
            const isCritical = remaining > 0 && remaining <= 15 * 60;
            return (
              <div
                key={s.key}
                role="listitem"
                className={`mobile-slot-row${isCritical ? " mobile-slot-row--critical" : ""}`}
                onClick={() => { setOpen(false); onSelect(s); onFlyTo(s); }}
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
                    {s.cluster} · {isCritical ? "🔴 " : ""}
                    {remaining > 0 ? `${Math.floor(remaining / 60)}m left` : "Expired"}
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
// FOOTER
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
              href="https://hub.arkiv.network/faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="footer__link"
              id="footer-faucet-link"
            >
              Arkiv Faucet ↗
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
                  href="https://tiramisu.explorer.arkiv.network"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__link"
                  id="footer-explorer-link"
                >
                  tiramisu.explorer.arkiv.network ↗
                </a>
              </div>
            </div>
          </li>
          <li>Click <strong>Connect Wallet</strong> in the top bar.</li>
          <li>Click any pin on the map and tap <strong>Book</strong> to claim a slot.</li>
        </ol>
      </div>
      <p className="footer__notice">
        SlotBazaar is a hackathon demo on Arkiv Tiramisu testnet. No real funds involved.{" "}
        Map tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="footer__link">OpenStreetMap contributors</a> (ODbL).
      </p>
    </footer>
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
// INNER APP
// ─────────────────────────────────────────────────────────────────────────────

function AppInner(): React.ReactElement {
  const { slots, loading, error, lastFetched, refresh } = useLiveSlots();

  const [filters, setFilters] = useState<FilterState>({
    category:   "all",
    cluster:    "all",
    priceBand:  "all",
    endingSoon: false,
  });

  const [selectedSlot, setSelectedSlot] = useState<SlotEntity | null>(null);
  const [flyTarget, setFlyTarget]       = useState<[number, number] | null>(null);
  const flyRef = useRef<[number, number] | null>(null);

  const now = useNow();

  /** Unique sorted cluster names */
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
      if (filters.endingSoon && (s.endsAt - now) > 15 * 60)                 return false;
      return true;
    });
  }, [slots, filters, now]);

  const handleSelect  = useCallback((slot: SlotEntity) => setSelectedSlot(slot), []);
  const handleClose   = useCallback(() => setSelectedSlot(null), []);
  const handleFilters = useCallback((f: FilterState) => setFilters(f), []);

  const handleFlyTo = useCallback((slot: SlotEntity) => {
    const target: [number, number] = [slot.lat, slot.lon];
    // Toggle off then back on to re-trigger the effect even for the same slot
    if (flyRef.current?.[0] === target[0] && flyRef.current?.[1] === target[1]) {
      setFlyTarget(null);
      requestAnimationFrame(() => { setFlyTarget(target); flyRef.current = target; });
    } else {
      setFlyTarget(target);
      flyRef.current = target;
    }
  }, []);

  const handleSelectAndFly = useCallback((slot: SlotEntity) => {
    handleSelect(slot);
    handleFlyTo(slot);
  }, [handleSelect, handleFlyTo]);

  return (
    <div className="app-shell">
      <Header />

      {error && (
        <ErrorBanner message={error} onRetry={refresh} />
      )}

      {/* Two-column body on desktop, stacked on mobile */}
      <div className="app-body">

        {/* ── LEFT PANEL: hero + filters + slot list (desktop 40%) ── */}
        <div className="app-sidebar">
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

          {/* Skeleton while loading first time */}
          {loading && slots.length === 0 && !error && (
            <SkeletonOverlay />
          )}

          {/* Empty state when no slots at all */}
          {!loading && !error && slots.length === 0 && <EmptyState />}

          {/* Slot list — hidden on mobile (bottom sheet is used instead) */}
          {slots.length > 0 && (
            <div className="slot-list-wrapper" id="slot-list-container">
              <SlotList
                slots={filteredSlots}
                onSelect={handleSelect}
                onFlyTo={handleFlyTo}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: map (desktop 60%) ── */}
        <main className="map-wrapper" role="main" aria-label="India slot map">
          <MapView
            slots={filteredSlots}
            onSelectSlot={handleSelectAndFly}
            flyTarget={flyTarget}
          />

          {/* Mobile bottom sheet — shown only on small screens via CSS */}
          <MobileSheet
            slots={filteredSlots}
            onSelect={handleSelect}
            onFlyTo={handleFlyTo}
          />
        </main>
      </div>

      <SlotDrawer slot={selectedSlot} onClose={handleClose} />

      <ConnectNudge slotCount={slots.length} />

      <Footer />
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
