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
import {
  type SlotEntity,
  type BookingEntity,
  getEntityExplorerUrl,
  ARKIV_EXPLORER_HOME_URL,
} from "./lib/arkiv.js";
import { Header }                        from "./components/Header.js";
import { FilterBar, type FilterState }   from "./components/FilterBar.js";
import { MapView }                       from "./components/MapView.js";
import { SlotDrawer }                    from "./components/SlotDrawer.js";
import { PostSlotModal }                 from "./components/PostSlotModal.js";
import { BookSlotModal }                 from "./components/BookSlotModal.js";
import { ConfirmJobModal }               from "./components/ConfirmJobModal.js";
import { MyJobsModal }                   from "./components/MyJobsModal.js";
import { DemoGuideModal }                from "./components/DemoGuideModal.js";
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
  winningBookingsBySlot?: Map<string, BookingEntity>;
  onResetFilters?: () => void;
}

function SlideOverList({
  open,
  onClose,
  slots,
  onSelect,
  onFlyTo,
  userAddress,
  winningBookingsBySlot,
  onResetFilters,
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
            <div
              className="slideover-empty"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                padding: "36px 16px",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "0.95rem", color: "var(--c-text-muted)" }}>
                No slots match the current filters.
              </span>
              {onResetFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  style={{
                    cursor: "pointer",
                    background: "var(--c-amber)",
                    color: "#111",
                    fontWeight: 700,
                    padding: "7px 16px",
                    borderRadius: "6px",
                    border: "1px solid rgba(0,0,0,0.2)",
                    fontSize: "0.85rem",
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            sorted.map((s) => {
              const remaining = s.endsAt - now;
              const isCritical = remaining > 0 && remaining <= 15 * 60;
              const normUser = userAddress?.toLowerCase() ?? "";
              const isMine = Boolean(
                normUser &&
                (s.creator.toLowerCase() === normUser ||
                 s.owner.toLowerCase() === normUser)
              );
              const winner = winningBookingsBySlot?.get(s.key.toLowerCase());
              const isBooked = Boolean(winner);
              const isBookedByYou = Boolean(
                winner && normUser && winner.creator.toLowerCase() === normUser
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
                    {isBookedByYou ? (
                      <span
                        style={{
                          marginLeft: 6,
                          background: "var(--c-teal)",
                          color: "white",
                          padding: "1px 5px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          verticalAlign: "middle",
                        }}
                      >
                        ★ You Booked
                      </span>
                    ) : isMine ? (
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
                    ) : isBooked ? (
                      <span
                        style={{
                          marginLeft: 6,
                          background: "#9E9E9E",
                          color: "white",
                          padding: "1px 5px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          verticalAlign: "middle",
                        }}
                      >
                        🔒 Booked
                      </span>
                    ) : null}
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
  const {
    slots,
    bookings,
    completions,
    bookingsBySlot,
    winningBookingsBySlot,
    reputationByAddress,
    loading,
    error,
    lastFetched,
    refresh,
    addSlot,
  } = useLiveSlots();
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
  const [isBookOpen, setIsBookOpen]     = useState(false);
  const [slotToBook, setSlotToBook]     = useState<SlotEntity | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    slot: SlotEntity;
    booking: BookingEntity;
    role: "seller" | "buyer";
  } | null>(null);

  const [isMyJobsOpen, setIsMyJobsOpen]       = useState(false);
  const [isDemoGuideOpen, setIsDemoGuideOpen] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<SlotEntity | null>(null);
  const [flyTarget, setFlyTarget]       = useState<[number, number] | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    link?: { text: string; url: string };
  } | null>(null);

  // App-level user GPS location (prompted immediately on app load)
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
    accuracy?: number;
  } | null>(null);

  const flyRef = useRef<[number, number] | null>(null);

  const now = useNow();

  /**
   * Request browser location permission immediately on app startup.
   */
  const requestAppLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLon = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        setUserLocation({ lat: uLat, lon: uLon, accuracy });
      },
      () => {
        // User denied/dismissed — native browser permission is enough, no extra banner
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Request browser location permission as soon as the application opens
  useEffect(() => {
    requestAppLocation();
  }, [requestAppLocation]);

  const handleRecenterUser = useCallback(() => {
    if (userLocation) {
      setFlyTarget([userLocation.lat, userLocation.lon]);
    } else {
      requestAppLocation();
    }
  }, [userLocation, requestAppLocation]);

  const userReputation = useMemo(() => {
    return address ? reputationByAddress.get(address.toLowerCase()) : undefined;
  }, [address, reputationByAddress]);

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

  const handleOpenBook = useCallback((slot: SlotEntity) => {
    setSlotToBook(slot);
    setIsBookOpen(true);
  }, []);

  const handleOpenConfirmJob = useCallback(
    (slot: SlotEntity, booking: BookingEntity, role: "seller" | "buyer") => {
      setConfirmTarget({ slot, booking, role });
      setIsConfirmOpen(true);
    },
    []
  );

  const handleBookingComplete = useCallback(
    (booking: BookingEntity, isWinner: boolean) => {
      refresh();
      setToast({
        message: isWinner ? "You booked this slot!" : "Booking submitted on Arkiv.",
        type: isWinner ? "success" : "info",
        link: {
          text: `View Booking (${booking.key.slice(0, 8)}…) ↗`,
          url: getEntityExplorerUrl(booking.key),
        },
      });
    },
    [refresh]
  );

  const handleCompletionDone = useCallback(
    (completionKey: Hex) => {
      refresh();
      setToast({
        message: "Job confirmation recorded on Arkiv!",
        type: "success",
        link: {
          text: `View Receipt (${completionKey.slice(0, 8)}…) ↗`,
          url: getEntityExplorerUrl(completionKey),
        },
      });
    },
    [refresh]
  );

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
      addSlot(slot);
      // Reset all filters to 'all' so the newly created slot is immediately visible on screen
      setFilters({
        category: "all",
        cluster: "all",
        priceBand: "all",
        endingSoon: false,
        mySlots: false,
      });
      refresh();
      handleSelectAndFly(slot);
      setToast({
        message: "Slot successfully posted to Arkiv!",
        type: "success",
        link: {
          text: `View Entity (${key.slice(0, 8)}…) ↗`,
          url: getEntityExplorerUrl(key),
        },
      });
    },
    [addSlot, refresh, handleSelectAndFly]
  );

  return (
    <div className="app-viewport">
      {/* 1. NAVBAR */}
      <Header
        onPostSlot={() => setIsPostOpen(true)}
        verifiedJobsCount={userReputation?.verifiedJobsCount ?? 0}
        onOpenMyJobs={() => setIsMyJobsOpen(true)}
        onOpenDemoGuide={() => setIsDemoGuideOpen(true)}
      />

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
          winningBookingsBySlot={winningBookingsBySlot}
          reputationByAddress={reputationByAddress}
          userAddress={address}
          userLocation={userLocation}
          onRecenterUser={handleRecenterUser}
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
            href={ARKIV_EXPLORER_HOME_URL}
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
          winningBookingsBySlot={winningBookingsBySlot}
          onResetFilters={() =>
            setFilters({
              category: "all",
              cluster: "all",
              priceBand: "all",
              endingSoon: false,
              mySlots: false,
            })
          }
        />
      </main>

      {/* Slot Drawer modal for detailed booking / viewing */}
      <SlotDrawer
        slot={selectedSlot}
        onClose={handleClose}
        winningBooking={selectedSlot ? winningBookingsBySlot.get(selectedSlot.key.toLowerCase()) : undefined}
        userBookings={selectedSlot ? bookingsBySlot.get(selectedSlot.key.toLowerCase()) ?? [] : []}
        completions={selectedSlot ? completions : []}
        sellerReputation={selectedSlot ? reputationByAddress.get(selectedSlot.creator.toLowerCase()) : undefined}
        onOpenBook={handleOpenBook}
        onOpenConfirmJob={handleOpenConfirmJob}
      />

      {/* Post Slot Modal */}
      <PostSlotModal
        open={isPostOpen}
        onClose={() => setIsPostOpen(false)}
        onSlotCreated={handleSlotCreated}
        initialUserLocation={userLocation}
      />

      {/* Book Slot Modal */}
      <BookSlotModal
        open={isBookOpen}
        slot={slotToBook}
        onClose={() => {
          setIsBookOpen(false);
          setSlotToBook(null);
        }}
        onBookingComplete={handleBookingComplete}
      />

      {/* Confirm Job Modal */}
      {confirmTarget && (
        <ConfirmJobModal
          open={isConfirmOpen}
          slot={confirmTarget.slot}
          booking={confirmTarget.booking}
          role={confirmTarget.role}
          onClose={() => {
            setIsConfirmOpen(false);
            setConfirmTarget(null);
          }}
          onCompletionDone={handleCompletionDone}
        />
      )}

      {/* My Jobs Modal */}
      <MyJobsModal
        open={isMyJobsOpen}
        onClose={() => setIsMyJobsOpen(false)}
        userAddress={address}
        slots={slots}
        bookings={bookings}
        completions={completions}
        winningBookingsBySlot={winningBookingsBySlot}
        reputation={userReputation}
        onOpenConfirmJob={handleOpenConfirmJob}
      />

      {/* Two-Wallet Demo Guide Modal */}
      <DemoGuideModal
        open={isDemoGuideOpen}
        onClose={() => setIsDemoGuideOpen(false)}
        currentAddress={address}
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
