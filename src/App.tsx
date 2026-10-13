/**
 * src/App.tsx — SlotBazaar Phase 2C UI Fix
 *
 * Full-screen viewport layout (100dvh, no page scroll on desktop):
 *  ┌────────────────────────────────────────────────────────────┐
 *  │ 1. NAVBAR (Sticky paper bg · ink border · block pill)      │
 *  ├────────────────────────────────────────────────────────────┤
 *  │ 2. FILTER BAR (Compact row: chips, city, price, toggles)   │
 *  ├────────────────────────────────────────────────────────────┤
 *  │ 3. FULL-WIDTH MAP (Rest of viewport 100dvh)                │
 *  │    Optional slide-over slot list panel (default closed)    │
 *  │    Slim one-line OpenStreetMap attribution bar             │
 *  └────────────────────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import "leaflet/dist/leaflet.css";

import type { Hex } from "viem";
import { WalletProvider, useWallet } from "./lib/wallet.js";
import { useLiveSlots }              from "./hooks/useLiveSlots.js";
import type { SlotEntity }           from "./lib/arkiv.js";

import { Header }                        from "./components/Header.js";
import { FilterBar, type FilterState }   from "./components/FilterBar.js";
import { MapView }                       from "./components/MapView.js";
import { SlotDrawer }                    from "./components/SlotDrawer.js";
import { PostSlotModal }                 from "./components/PostSlotModal.js";
import { useNow }                        from "./hooks/useNow.js";
import { formatTimeLeft }                from "./lib/time.js";

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE-OVER SLOT LIST PANEL
// ─────────────────────────────────────────────────────────────────────────────

interface SlideOverListProps {
  open: boolean;
  onClose: () => void;
  slots: SlotEntity[];
  onSelect: (s: SlotEntity) => void;
  onFlyTo: (s: SlotEntity) => void;
  userAddress?: string | null;
}

function SlideOverList({
  open,
  onClose,
  slots,
  onSelect,
  onFlyTo,
  userAddress,
}: SlideOverListProps): React.ReactElement | null {
  const now = useNow();

  if (!open) return null;

  const sorted = [...slots].sort((a, b) => a.endsAt - b.endsAt);

  return (
    <>
      {/* Backdrop */}
      <div
        className="slideover-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="slideover-panel"
        role="dialog"
        aria-label="Available slots list"
        id="slideover-slot-list"
      >
        <div className="slideover-header">
          <div className="slideover-title">
            <span aria-hidden="true">📋</span>
            <span>Available Slots ({slots.length})</span>
          </div>
          <button
            className="slideover-close-btn"
            onClick={onClose}
            aria-label="Close slot list"
            id="slideover-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="slideover-body" role="list">
          {slots.length === 0 ? (
            <div className="slideover-empty">
              <span>No slots match the current filters.</span>
            </div>
          ) : (
            sorted.map((s) => {
              const remaining = s.endsAt - now;
              const isCritical = remaining > 0 && remaining <= 15 * 60;
              const isMine = Boolean(
                userAddress &&
                (s.creator.toLowerCase() === userAddress.toLowerCase() ||
                 s.owner.toLowerCase() === userAddress.toLowerCase())
              );
              return (
                <div
                  key={s.key}
                  role="listitem"
                  className={`slideover-card${isCritical ? " slideover-card--critical" : ""}`}
                  onClick={() => {
                    onSelect(s);
                    onFlyTo(s);
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && (onSelect(s), onFlyTo(s))}
                  aria-label={`${s.title}, ${s.cluster}, ${formatTimeLeft(s.endsAt, now)} remaining`}
                >
                  <div className="slideover-card__top">
                    <span
                      className={`slideover-card__category slideover-card__category--${s.category}`}
                    >
                      {s.category === "machine" ? "⚙️ Machine" : s.category === "transport" ? "🚚 Transport" : "💻 Freelance"}
                    </span>
                    <span className={`slideover-card__time${isCritical ? " slideover-card__time--critical" : ""}`}>
                      {formatTimeLeft(s.endsAt, now)}
                    </span>
                  </div>

                  <div className="slideover-card__title">
                    {s.title}
                    {isMine && (
                      <span
                        className="my-slot-badge"
                        style={{
                          marginLeft: 6,
                          background: "var(--c-marigold)",
                          color: "var(--c-ink)",
                          border: "var(--border)",
                          padding: "1px 5px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          verticalAlign: "middle",
                        }}
                      >
                        ★ You
                      </span>
                    )}
                  </div>

                  <div className="slideover-card__footer">
                    <span className="slideover-card__cluster">📍 {s.cluster}</span>
                    <span className="slideover-card__price">₹ {s.priceBand.toUpperCase()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NON-BLOCKING ERROR BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  return (
    <div className="error-banner" role="alert" aria-live="assertive" id="error-banner">
      <span className="error-banner__icon" aria-hidden="true">⚡</span>
      <span className="error-banner__msg">
        Arkiv RPC issue — displaying cached data.{" "}
        <span style={{ opacity: 0.8, fontSize: "0.8em" }}>{message}</span>
      </span>
      <button className="error-banner__btn" onClick={onRetry} id="error-banner-retry">
        Retry
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INNER APP
// ─────────────────────────────────────────────────────────────────────────────

function AppInner(): React.ReactElement {
  const { slots, loading, error, lastFetched, refresh } = useLiveSlots();
  const { address, status } = useWallet();

  const isConnected = status === "connected" && Boolean(address);

  const [filters, setFilters] = useState<FilterState>({
    category:   "all",
    cluster:    "all",
    priceBand:  "all",
    endingSoon: false,
    mySlots:    false,
  });

  const [isListOpen, setIsListOpen]     = useState(false);
  const [isPostOpen, setIsPostOpen]     = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotEntity | null>(null);
  const [flyTarget, setFlyTarget]       = useState<[number, number] | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    link?: { text: string; url: string };
  } | null>(null);

  const flyRef = useRef<[number, number] | null>(null);

  const now = useNow();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Unique sorted cluster names */
  const clusters = useMemo<string[]>(
    () => [...new Set(slots.map((s) => s.cluster))].sort(),
    [slots]
  );

  /** Filter slots by active criteria */
  const filteredSlots = useMemo<SlotEntity[]>(() => {
    return slots.filter((s) => {
      if (filters.category  !== "all" && s.category  !== filters.category)  return false;
      if (filters.cluster   !== "all" && s.cluster   !== filters.cluster)   return false;
      if (filters.priceBand !== "all" && s.priceBand !== filters.priceBand) return false;
      if (filters.endingSoon && (s.endsAt - now) > 15 * 60)                 return false;
      if (filters.mySlots && address) {
        const userAddr = address.toLowerCase();
        if (s.creator.toLowerCase() !== userAddr && s.owner.toLowerCase() !== userAddr) {
          return false;
        }
      }
      return true;
    });
  }, [slots, filters, now, address]);

  const handleSelect  = useCallback((slot: SlotEntity) => setSelectedSlot(slot), []);
  const handleClose   = useCallback(() => setSelectedSlot(null), []);
  const handleFilters = useCallback((f: FilterState) => setFilters(f), []);

  const handleFlyTo = useCallback((slot: SlotEntity) => {
    const target: [number, number] = [slot.lat, slot.lon];
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

  const handleSlotCreated = useCallback(
    ({
      key,
      slot,
    }: {
      key: Hex;
      lat: number;
      lon: number;
      slot: SlotEntity;
    }) => {
      refresh();
      handleSelectAndFly(slot);
      setToast({
        message: "Slot successfully posted to Arkiv!",
        type: "success",
        link: {
          text: `View Entity (${key.slice(0, 8)}…) ↗`,
          url: `https://tiramisu.explorer.arkiv.network/entity/${key}`,
        },
      });
    },
    [refresh, handleSelectAndFly]
  );

  return (
    <div className="app-viewport">
      {/* 1. NAVBAR */}
      <Header onPostSlot={() => setIsPostOpen(true)} />

      {/* Optional non-blocking error banner */}
      {error && <ErrorBanner message={error} onRetry={refresh} />}

      {/* 2. FILTER BAR */}
      <FilterBar
        filters={filters}
        onChange={handleFilters}
        clusters={clusters}
        slotCount={filteredSlots.length}
        totalCount={slots.length}
        loading={loading}
        lastFetched={lastFetched}
        onRefresh={refresh}
        isListOpen={isListOpen}
        onToggleList={() => setIsListOpen((v) => !v)}
        isConnected={isConnected}
      />

      {/* 3. MAP (MAIN SCREEN - FILLS REST OF 100dvh VIEWPORT) */}
      <main className="main-map-area" role="main" aria-label="India slot map">
        <MapView
          slots={filteredSlots}
          onSelectSlot={handleSelectAndFly}
          flyTarget={flyTarget}
        />

        {/* 4. SLIM ONE-LINE FOOTER ATTRIBUTION BAR OVERLAY */}
        <div className="map-attribution-bar">
          Map tiles ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenStreetMap contributors
          </a>{" "}
          (ODbL) · Powered by{" "}
          <a
            href="https://tiramisu.explorer.arkiv.network"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arkiv Tiramisu
          </a>
        </div>

        {/* Slide-over slot list panel (desktop slide-over & mobile bottom sheet) */}
        <SlideOverList
          open={isListOpen}
          onClose={() => setIsListOpen(false)}
          slots={filteredSlots}
          onSelect={handleSelect}
          onFlyTo={handleFlyTo}
          userAddress={address}
        />
      </main>

      {/* Slot Drawer modal for detailed booking / viewing */}
      <SlotDrawer slot={selectedSlot} onClose={handleClose} />

      {/* Post Slot Modal */}
      <PostSlotModal
        open={isPostOpen}
        onClose={() => setIsPostOpen(false)}
        onSlotCreated={handleSlotCreated}
      />

      {/* Toast Notification Container */}
      {toast && (
        <div className="toast-container" role="status" aria-live="polite">
          <div className={`toast toast--${toast.type}`}>
            <div style={{ flex: 1 }}>
              <div>{toast.message}</div>
              {toast.link && (
                <div style={{ marginTop: 4 }}>
                  <a
                    href={toast.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--c-paper)", textDecoration: "underline", fontSize: "0.75rem" }}
                  >
                    {toast.link.text}
                  </a>
                </div>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              style={{
                background: "none",
                border: "none",
                color: "var(--c-paper)",
                cursor: "pointer",
                padding: 0,
                fontSize: "1rem",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
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
