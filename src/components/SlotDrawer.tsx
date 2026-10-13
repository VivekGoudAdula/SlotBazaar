/**
 * src/components/SlotDrawer.tsx
 *
 * Right-side detail drawer opened when a map marker is clicked.
 *
 * Sections:
 *  - Live countdown (vermilion <15 min)
 *  - Description
 *  - Metadata grid (category, cluster, price band, seller, start/end)
 *  - Proof panel: entity key (copyable), $creator, Entity Expiration block,
 *                 created-at block, explorer link
 *  - Action buttons (Book / Confirm Seller) — disabled with tooltip when
 *    wallet is not connected
 *
 * Phase 2 read-only: write stubs present but commented.
 */

import React, { useState, useCallback } from "react";
import {
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
  type ReputationResult,
  getEntityExplorerUrl,
} from "../lib/arkiv.js";
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

// ─────────────────────────────────────────────────────────────────────────────
// COPY BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [value]);

  return (
    <button
      className="copy-btn"
      onClick={handleCopy}
      aria-label={copied ? "Copied!" : `Copy ${label}`}
      title={copied ? "Copied!" : `Copy ${label}`}
    >
      {copied ? "✓ Copied" : "⎘ Copy"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotDrawerProps {
  slot: SlotEntity | null;
  onClose: () => void;
  winningBooking?: BookingEntity;
  userBookings?: BookingEntity[];
  completions?: CompletionEntity[];
  sellerReputation?: ReputationResult;
  onOpenBook?: (slot: SlotEntity) => void;
  onOpenConfirmJob?: (slot: SlotEntity, booking: BookingEntity, role: "seller" | "buyer") => void;
}

export function SlotDrawer({
  slot,
  onClose,
  winningBooking,
  userBookings = [],
  completions = [],
  sellerReputation,
  onOpenBook,
  onOpenConfirmJob,
}: SlotDrawerProps): React.ReactElement | null {
  const now    = useNow();
  const wallet = useWallet();
  const [showProofs, setShowProofs] = useState(false);

  if (!slot) return null;

  const urgency   = getUrgency(slot.endsAt, now);
  const timeLeft  = formatTimeLeft(slot.endsAt, now);
  const remaining = slot.endsAt - now;
  const expired   = remaining <= 0;
  const isCritical = remaining > 0 && remaining <= 15 * 60;
  const hasStarted = now >= slot.startsAt;

  const walletConnected = wallet.status === "connected" && Boolean(wallet.address);
  const isWrongNetwork = wallet.isWrongNetwork;
  const userAddr = wallet.address?.toLowerCase();

  const isMySlot = Boolean(
    userAddr &&
    (slot.creator.toLowerCase() === userAddr || slot.owner.toLowerCase() === userAddr)
  );

  const hasUserBooking = Boolean(
    userAddr &&
    userBookings.some((b) => b.creator.toLowerCase() === userAddr)
  );

  const userIsWinner = Boolean(
    winningBooking &&
    userAddr &&
    winningBooking.creator.toLowerCase() === userAddr
  );

  const isSellerOfWinning = Boolean(
    winningBooking &&
    userAddr &&
    (winningBooking.slotCreator || slot.creator).toLowerCase() === userAddr
  );

  const isBuyerOfWinning = userIsWinner;

  // Check completions for this winning booking
  const matchingCompletions = completions.filter((c) => {
    if (!winningBooking) return false;
    const bKey = (c.bookingKey || "").toLowerCase();
    const sKey = (c.slotKey || "").toLowerCase();
    return bKey === winningBooking.key.toLowerCase() || sKey === winningBooking.slotKey.toLowerCase();
  });

  const sellerCompletion = matchingCompletions.find(
    (c) => c.role === "seller" && c.creator.toLowerCase() === (winningBooking?.slotCreator || slot.creator).toLowerCase()
  );
  const buyerCompletion = matchingCompletions.find(
    (c) => c.role === "buyer" && c.creator.toLowerCase() === winningBooking?.creator.toLowerCase()
  );

  const hasSellerConfirmed = Boolean(sellerCompletion);
  const hasBuyerConfirmed = Boolean(buyerCompletion);
  const isJobVerified = hasSellerConfirmed && hasBuyerConfirmed;

  // Determine booking button disabled state & message
  let canBook = true;
  let bookDisabledReason = "";

  if (!walletConnected) {
    canBook = false;
    bookDisabledReason = "Connect MetaMask to book this slot";
  } else if (isWrongNetwork) {
    canBook = false;
    bookDisabledReason = "Switch wallet to Arkiv Tiramisu";
  } else if (expired) {
    canBook = false;
    bookDisabledReason = "This slot has expired on Arkiv";
  } else if (isMySlot) {
    canBook = false;
    bookDisabledReason = "You cannot book your own slot";
  } else if (hasUserBooking) {
    canBook = false;
    bookDisabledReason = "You have already placed a booking on this slot";
  }

  const verifiedCount = sellerReputation?.verifiedJobsCount ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-overlay"
        id="drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="drawer"
        role="complementary"
        aria-label={`Slot details: ${slot.title}`}
        id="slot-drawer"
      >
        {/* Header */}
        <div className={`drawer__header${isCritical ? " drawer__header--critical" : ""}`}>
          <button
            className="drawer__close"
            onClick={onClose}
            aria-label="Close slot details"
            id="drawer-close-btn"
          >
            ✕
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="drawer__title">{slot.title}</h2>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
              {slot.synthetic && (
                <span className="synthetic-badge">⚗ Synthetic demo data</span>
              )}
              {isMySlot && (
                <span
                  className="my-slot-badge"
                  style={{
                    background: "var(--c-marigold)",
                    color: "var(--c-ink)",
                    border: "var(--border)",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  ★ Your Slot
                </span>
              )}
              {userIsWinner && (
                <span
                  style={{
                    background: "var(--c-teal)",
                    color: "white",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  ★ Booked by You
                </span>
              )}
              {winningBooking && !userIsWinner && !isMySlot && (
                <span
                  style={{
                    background: "#9E9E9E",
                    color: "white",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  🔒 Booked
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="drawer__body">
          {/* ── Race / Booking Outcome Banner ── */}
          {winningBooking && (
            <div
              style={{
                padding: "10px 12px",
                border: "var(--border)",
                background: userIsWinner
                  ? "rgba(15, 139, 141, 0.12)"
                  : hasUserBooking
                  ? "rgba(232, 69, 44, 0.12)"
                  : "var(--c-paper-dark)",
                fontSize: "0.82rem",
                lineHeight: 1.4,
              }}
            >
              {userIsWinner ? (
                <div>
                  <strong>🎉 You booked this slot!</strong> Mined in block #{winningBooking.createdAtBlock?.toString() || "..."}.
                </div>
              ) : hasUserBooking ? (
                <div>
                  <strong>⚠️ Missed: someone booked first</strong> (block #{winningBooking.createdAtBlock?.toString() || "..."}).
                  <div style={{ fontSize: "0.75rem", opacity: 0.85, marginTop: 4 }}>
                    Arkiv resolves races by earliest confirmed block (and key tie-break).
                  </div>
                </div>
              ) : (
                <div>
                  <strong>🔒 Slot Booked</strong> by{" "}
                  <code>{winningBooking.creator.slice(0, 8)}…{winningBooking.creator.slice(-6)}</code> (block #{winningBooking.createdAtBlock?.toString() || "..."}).
                </div>
              )}
            </div>
          )}

          {/* ── Countdown ── */}
          <div
            className={`slot-card__countdown slot-card__countdown--${urgency}`}
            style={{ fontSize: "1rem", fontWeight: 700 }}
            aria-label={`Time remaining: ${timeLeft}`}
            aria-live="polite"
          >
            <span aria-hidden="true">
              {urgency === "critical" ? "🔴" : urgency === "urgent" ? "🟡" : "🟢"}
            </span>
            {timeLeft}
            {expired && " — Expired on Arkiv"}
          </div>

          {/* ── Seller Reputation Badge ── */}
          <section
            style={{
              background: "var(--c-paper-dark)",
              border: "var(--border)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                title="A job counts toward reputation only when distinct buyer and seller both confirm on-chain after slot start. Self-bookings and losing bookings are excluded."
                style={{ cursor: "help" }}
              >
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, opacity: 0.8 }}>
                  Seller Reputation:
                </span>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--c-teal)", marginTop: 2 }}>
                  🏆 {verifiedCount} Verified {verifiedCount === 1 ? "Job" : "Jobs"}
                </div>
              </div>

              {verifiedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowProofs((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    textDecoration: "underline",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    color: "var(--c-ink)",
                  }}
                  id="drawer-toggle-proofs-btn"
                >
                  {showProofs ? "Hide Proofs ▲" : `View Proofs (${verifiedCount}) ▼`}
                </button>
              )}
            </div>

            {/* Expandable proof list */}
            {showProofs && sellerReputation && (
              <div
                style={{
                  background: "var(--c-paper)",
                  border: "1px solid var(--c-ink)",
                  padding: "8px",
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-mono)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {sellerReputation.proofs.map((p, idx) => (
                  <div key={p.bookingKey} style={{ borderBottom: idx < sellerReputation.proofs.length - 1 ? "1px dashed #ccc" : "none", paddingBottom: 4 }}>
                    <div>
                      <strong>Booking:</strong>{" "}
                      <a href={getEntityExplorerUrl(p.bookingKey)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--c-ink)" }}>
                        {p.bookingKey.slice(0, 10)}…{p.bookingKey.slice(-6)} ↗
                      </a>
                    </div>
                    <div>
                      <strong>Seller Signature:</strong>{" "}
                      <a href={getEntityExplorerUrl(p.sellerCompletionKey)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--c-ink)" }}>
                        {p.sellerCompletionKey.slice(0, 10)}…{p.sellerCompletionKey.slice(-6)} ↗
                      </a>
                    </div>
                    <div>
                      <strong>Buyer Signature:</strong>{" "}
                      <a href={getEntityExplorerUrl(p.buyerCompletionKey)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--c-ink)" }}>
                        {p.buyerCompletionKey.slice(0, 10)}…{p.buyerCompletionKey.slice(-6)} ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Description ── */}
          <section aria-labelledby="desc-label">
            <p className="drawer__section-label" id="desc-label">Description</p>
            <p className="drawer__description">
              {slot.description || "No description provided."}
            </p>
          </section>

          {/* ── Metadata grid ── */}
          <section aria-labelledby="meta-label">
            <p className="drawer__section-label" id="meta-label">Details</p>
            <div className="drawer__meta-grid">
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Category</div>
                <div className="drawer__meta-value">{CATEGORY_LABELS[slot.category] ?? slot.category}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Cluster</div>
                <div className="drawer__meta-value" style={{ textTransform: "capitalize" }}>{slot.cluster}</div>
              </div>
              <div className="drawer__meta-item">
                <div className="drawer__meta-key">Price Band</div>
                <div className="drawer__meta-value">{PRICE_BAND_LABELS[slot.priceBand] ?? slot.priceBand}</div>
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
                <div className="drawer__meta-key">Lat / Lon</div>
                <div className="drawer__meta-value" style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>
                  {slot.lat.toFixed(4)}, {slot.lon.toFixed(4)}
                </div>
              </div>
              {slot.synthetic && (
                <div className="drawer__meta-item">
                  <div className="drawer__meta-key">Data</div>
                  <div className="drawer__meta-value" style={{ color: "var(--c-sage)" }}>⚗ Synthetic</div>
                </div>
              )}
            </div>
          </section>

          {/* ── PROOF PANEL ── */}
          <section aria-labelledby="proof-label" className="proof-panel">
            <p className="drawer__section-label" id="proof-label">🔐 On-Chain Proof</p>

            {/* Entity Key */}
            <div className="proof-row">
              <div className="proof-key">Slot Entity Key</div>
              <div className="proof-val-wrap">
                <div className="drawer__key-box" aria-label={`Entity key: ${slot.key}`}>
                  {slot.key}
                </div>
                <div className="proof-actions">
                  <CopyButton value={slot.key} label="entity key" />
                  <a
                    href={getEntityExplorerUrl(slot.key)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="explorer-link"
                    id="drawer-explorer-link"
                    aria-label="View on Arkiv Explorer (opens new tab)"
                  >
                    Explorer ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Creator */}
            <div className="proof-row">
              <div className="proof-key">$creator (seller)</div>
              <div className="proof-val-wrap">
                <div className="drawer__key-box" style={{ fontSize: "0.65rem" }} aria-label={`Creator: ${slot.creator}`}>
                  {slot.creator}
                  {isMySlot && (
                    <span style={{ marginLeft: 6, color: "var(--c-teal)", fontWeight: 700 }}>
                      (You)
                    </span>
                  )}
                </div>
                <CopyButton value={slot.creator} label="creator address" />
              </div>
            </div>

            {/* Entity Expiration Block */}
            {slot.expiresAtBlock !== undefined && (
              <div className="proof-row">
                <div className="proof-key">Entity Expiration Block</div>
                <div className="proof-val">#{slot.expiresAtBlock.toLocaleString()}</div>
              </div>
            )}

            {/* Created-at Block */}
            {slot.createdAtBlock !== undefined && (
              <div className="proof-row">
                <div className="proof-key">Created-at Block</div>
                <div className="proof-val">#{slot.createdAtBlock.toLocaleString()}</div>
              </div>
            )}
          </section>

          {/* ── ACTIONS ── */}
          <div className="drawer__actions">
            {/* 1. Confirm Job Done (appears for seller and winning buyer once slot started) */}
            {winningBooking && (isSellerOfWinning || isBuyerOfWinning) && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                {isJobVerified ? (
                  <div
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      border: "1px solid #22c55e",
                      padding: "8px 12px",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "#15803d",
                      textAlign: "center",
                    }}
                  >
                    ✓ Job Verified on Arkiv (Both Sides Signed)
                  </div>
                ) : isSellerOfWinning ? (
                  hasSellerConfirmed ? (
                    <div
                      style={{
                        background: "rgba(234, 179, 8, 0.15)",
                        border: "1px solid #eab308",
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#a16207",
                        textAlign: "center",
                      }}
                    >
                      ✓ You confirmed as Seller (Awaiting Buyer)
                    </div>
                  ) : hasStarted ? (
                    <button
                      id="drawer-confirm-seller-btn"
                      className="btn-primary"
                      onClick={() => onOpenConfirmJob?.(slot, winningBooking, "seller")}
                      style={{ width: "100%", background: "var(--c-teal)" }}
                    >
                      ✅ Confirm Job Done (Seller)
                    </button>
                  ) : (
                    <div style={{ fontSize: "0.78rem", opacity: 0.8, textAlign: "center" }}>
                      ⏳ Seller confirmation opens after slot start ({formatDateTime(slot.startsAt)})
                    </div>
                  )
                ) : isBuyerOfWinning ? (
                  hasBuyerConfirmed ? (
                    <div
                      style={{
                        background: "rgba(234, 179, 8, 0.15)",
                        border: "1px solid #eab308",
                        padding: "8px 12px",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#a16207",
                        textAlign: "center",
                      }}
                    >
                      ✓ You confirmed as Buyer (Awaiting Seller)
                    </div>
                  ) : hasStarted ? (
                    <button
                      id="drawer-confirm-buyer-btn"
                      className="btn-primary"
                      onClick={() => onOpenConfirmJob?.(slot, winningBooking, "buyer")}
                      style={{ width: "100%", background: "var(--c-teal)" }}
                    >
                      ✅ Confirm Job Done (Buyer)
                    </button>
                  ) : (
                    <div style={{ fontSize: "0.78rem", opacity: 0.8, textAlign: "center" }}>
                      ⏳ Buyer confirmation opens after slot start ({formatDateTime(slot.startsAt)})
                    </div>
                  )
                ) : null}
              </div>
            )}

            {/* 2. Book button */}
            {!expired && (
              <div
                title={canBook ? "Book this slot on-chain" : bookDisabledReason}
                style={{ width: "100%" }}
              >
                <button
                  id="drawer-book-btn"
                  className="btn-primary"
                  disabled={!canBook}
                  onClick={() => onOpenBook?.(slot)}
                  aria-label={canBook ? "Book this slot (on-chain)" : bookDisabledReason}
                  aria-disabled={!canBook}
                  style={{ width: "100%" }}
                >
                  🤝 Book This Slot
                  {!canBook && (
                    <span className="btn-tooltip">{bookDisabledReason}</span>
                  )}
                </button>
              </div>
            )}

            {/* 3. Wallet connect prompt */}
            {!walletConnected && (
              <button
                id="drawer-connect-wallet-btn"
                className="btn-primary"
                onClick={() => void wallet.connect()}
                style={{ width: "100%", background: "var(--c-teal)" }}
                aria-label="Connect MetaMask"
              >
                🦊 Connect Wallet
              </button>
            )}

            <p className="drawer__footnote">
              All actions are Arkiv transactions on Tiramisu testnet (chain 7738577).
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
