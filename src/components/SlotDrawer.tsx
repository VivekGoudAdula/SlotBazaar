/**
 * src/components/SlotDrawer.tsx
 *
 * Right-side drawer that shows full slot details when a map marker is clicked.
 * Shows: description, time grid, entity key, and action buttons (connect wallet to use).
 *
 * Read-only in Phase 2. Booking / completion write actions will be wired in Phase 3.
 */

import React from "react";
import type { SlotEntity } from "../lib/arkiv.js";
import { formatTimeLeft, getUrgency, formatDateTime } from "../lib/time.js";
import { useNow } from "../hooks/useNow.js";
import { useWallet } from "../lib/wallet.js";

const CATEGORY_LABELS: Record<string, string> = {
  machine:   "⚙️ Machine Hours",
  transport: "🚚 Transport",
  freelance: "💻 Freelance",
};

const PRICE_BAND_LABELS: Record<string, string> = {
  low:  "₹ Low",
  mid:  "₹₹ Mid",
  high: "₹₹₹ High",
};

export interface SlotDrawerProps {
  slot: SlotEntity | null;
  onClose: () => void;
}

export function SlotDrawer({ slot, onClose }: SlotDrawerProps): React.ReactElement | null {
  const now    = useNow();
  const wallet = useWallet();

  if (!slot) return null;

  const urgency  = getUrgency(slot.endsAt, now);
  const timeLeft = formatTimeLeft(slot.endsAt, now);
  const expired  = slot.endsAt <= now;

  const explorerBase = "https://explorer.tiramisu.arkiv.network";

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function handleBookClick() {
    if (wallet.status !== "connected") {
      void wallet.connect();
    }
    // Phase 3: wire up actual createBooking call here
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="drawer-overlay"
        onClick={handleOverlayClick}
        aria-hidden="true"
        id="drawer-overlay"
      />

      {/* Drawer panel */}
      <aside
        className="drawer"
        role="complementary"
        aria-label={`Slot details: ${slot.title}`}
        id="slot-drawer"
      >
        {/* Sticky header */}
        <div className="drawer__header">
          <button
            className="drawer__close"
            onClick={onClose}
            aria-label="Close slot details"
            id="drawer-close-btn"
          >
            ✕
          </button>
          <h2 className="drawer__title">{slot.title}</h2>
        </div>

        <div className="drawer__body">
          {/* Live countdown */}
          <div
            className={`slot-card__countdown slot-card__countdown--${urgency}`}
            style={{ fontSize: "1rem" }}
            aria-label={`Time remaining: ${timeLeft}`}
            aria-live="polite"
          >
            <span aria-hidden="true">
              {urgency === "critical" ? "🔴" : urgency === "urgent" ? "🟡" : "🟢"}
            </span>
            <strong>{timeLeft}</strong>
            {expired && " — Expired on Arkiv"}
          </div>

          {/* Description */}
          <section aria-labelledby="drawer-desc-label">
            <p className="drawer__section-label" id="drawer-desc-label">Description</p>
            <p className="drawer__description">
              {slot.description || "No description provided."}
            </p>
          </section>

          {/* Metadata grid */}
          <section aria-labelledby="drawer-meta-label">
            <p className="drawer__section-label" id="drawer-meta-label">Details</p>
            <div className="drawer__meta-grid">
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Category</div>
                <div className="drawer__meta-value">
                  {CATEGORY_LABELS[slot.category] ?? slot.category}
                </div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Cluster</div>
                <div className="drawer__meta-value" style={{ textTransform: "capitalize" }}>
                  {slot.cluster}
                </div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Price Band</div>
                <div className="drawer__meta-value">
                  {PRICE_BAND_LABELS[slot.priceBand] ?? slot.priceBand}
                </div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Seller</div>
                <div className="drawer__meta-value">{slot.sellerLabel}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Starts At</div>
                <div className="drawer__meta-value">{formatDateTime(slot.startsAt)}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Ends At</div>
                <div className="drawer__meta-value">{formatDateTime(slot.endsAt)}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Coordinates</div>
                <div className="drawer__meta-value" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
                  {slot.lat.toFixed(4)}, {slot.lon.toFixed(4)}
                </div>
              </div>
              {slot.createdAtBlock && (
                <div className="drawer__meta-item">
                  <div className="drawer__meta-key">Created Block</div>
                  <div className="drawer__meta-value">
                    #{slot.createdAtBlock.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Entity key + explorer link */}
          <section aria-labelledby="drawer-key-label">
            <p className="drawer__section-label" id="drawer-key-label">Arkiv Entity Key</p>
            <div className="drawer__key-box" aria-label={`Entity key: ${slot.key}`}>
              {slot.key}
            </div>
            <a
              href={`${explorerBase}/entity/${slot.key}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: "0.5rem",
                fontSize: "0.72rem",
                fontFamily: "var(--font-mono)",
                color: "var(--c-teal)",
                textDecoration: "underline",
              }}
              id="drawer-explorer-link"
              aria-label="View entity on Arkiv Explorer (opens new tab)"
            >
              View on Explorer ↗
            </a>
          </section>

          {/* Creator address */}
          <section aria-labelledby="drawer-creator-label">
            <p className="drawer__section-label" id="drawer-creator-label">Slot Creator (immutable $creator)</p>
            <div
              className="drawer__key-box"
              style={{ fontSize: "0.7rem" }}
              aria-label={`Creator wallet: ${slot.creator}`}
            >
              {slot.creator}
            </div>
          </section>

          {/* Action buttons */}
          <div className="drawer__actions" aria-label="Slot actions">
            {expired ? (
              <p
                style={{
                  fontSize: "0.82rem",
                  color: "var(--c-vermilion)",
                  fontWeight: 600,
                  textAlign: "center",
                  padding: "var(--sp-3)",
                  border: "2px solid var(--c-vermilion)",
                  background: "#FEE2DC",
                }}
              >
                🔴 This slot has expired and been removed from Arkiv.
              </p>
            ) : (
              <>
                <button
                  id="drawer-book-btn"
                  className="btn-primary"
                  onClick={handleBookClick}
                  aria-label={
                    wallet.status === "connected"
                      ? "Book this slot (sign Arkiv transaction)"
                      : "Connect wallet to book this slot"
                  }
                >
                  {wallet.status === "connected" ? (
                    <>🤝 Book This Slot</>
                  ) : (
                    <>🦊 Connect Wallet to Book</>
                  )}
                </button>

                {wallet.status === "connected" && (
                  <button
                    id="drawer-complete-seller-btn"
                    className="btn-secondary"
                    onClick={() => {
                      /* Phase 3: createCompletion("seller") */
                    }}
                    aria-label="Confirm slot as seller"
                  >
                    ✅ Confirm as Seller
                  </button>
                )}

                <p
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--c-ink-light)",
                    textAlign: "center",
                  }}
                >
                  All actions are on-chain Arkiv transactions (Tiramisu testnet, chain 7738577).
                  {wallet.status !== "connected" && " Connect MetaMask to proceed."}
                </p>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
