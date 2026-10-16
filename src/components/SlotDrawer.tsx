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

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { Hex, Address } from "viem";
import {
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
  type ReputationResult,
  type SlotBookingStatus,
  getSlotBookingStatus,
  getEntityExplorerUrl,
  getTxExplorerUrl,
  getMetaMaskWalletClient,
  transferEntityOwnership,
  extendProofEntity,
  fetchAuthoritativeEntityOwner,
  getKnownTransferredOwner,
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
  onOwnerUpdated?: (key: Hex, newOwner: Address) => void;
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
  onOwnerUpdated,
}: SlotDrawerProps): React.ReactElement | null {
  const now    = useNow();
  const wallet = useWallet();
  const [showProofs, setShowProofs] = useState(false);

  // Ownership transfer state
  const [currentOwner, setCurrentOwner] = useState<string>(() => {
    if (!slot) return "";
    const known = getKnownTransferredOwner(slot.key);
    return known || slot.owner || "";
  });
  const [isVerifyingOwner, setIsVerifyingOwner] = useState(false);
  const [ownerVerificationError, setOwnerVerificationError] = useState<string | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccessTx, setTransferSuccessTx] = useState<string | null>(null);

  // Proof extension state
  const [extendingKey, setExtendingKey] = useState<string | null>(null);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendSuccess, setExtendSuccess] = useState<{ key: string; txHash: string; expiresAt: bigint } | null>(null);

  // Keep onOwnerUpdated ref up to date to prevent effect re-triggers on parent renders
  const onOwnerUpdatedRef = useRef(onOwnerUpdated);
  useEffect(() => {
    onOwnerUpdatedRef.current = onOwnerUpdated;
  }, [onOwnerUpdated]);

  const slotKey = slot?.key;
  const slotOwner = slot?.owner;
  const slotOwnerRef = useRef(slotOwner);
  useEffect(() => {
    slotOwnerRef.current = slotOwner;
  }, [slotOwner]);

  // Keep currentOwner in sync with known local storage or slot prop updates
  useEffect(() => {
    if (!slotKey) return;
    const known = getKnownTransferredOwner(slotKey);
    if (known) {
      setCurrentOwner(known);
    } else if (slotOwner) {
      setCurrentOwner(slotOwner);
    }
  }, [slotKey, slotOwner]);

  // Reset transient drawer interaction state ONLY when selected slot key or wallet account changes
  useEffect(() => {
    setIsTransferOpen(false);
    setTransferTarget("");
    setTransferError(null);
    setTransferSuccessTx(null);
    setExtendingKey(null);
    setExtendError(null);
    setExtendSuccess(null);
    setOwnerVerificationError(null);
  }, [slotKey, wallet.address]);

  // Authoritatively verify entity state on Arkiv when slot changes
  useEffect(() => {
    if (!slotKey) return;

    let active = true;
    setIsVerifyingOwner(true);

    fetchAuthoritativeEntityOwner(slotKey)
      .then((auth) => {
        if (!active) return;
        if (auth.owner) {
          setCurrentOwner(auth.owner);
          if (slotOwnerRef.current && auth.owner.toLowerCase() !== slotOwnerRef.current.toLowerCase()) {
            onOwnerUpdatedRef.current?.(slotKey, auth.owner);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        console.warn("Authoritative owner lookup failed:", err);
        setOwnerVerificationError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setIsVerifyingOwner(false);
      });

    return () => {
      active = false;
    };
  }, [slotKey]);

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

  const isOwner = Boolean(userAddr && currentOwner.toLowerCase() === userAddr);
  const isMySlot = Boolean(
    userAddr &&
    (slot.creator.toLowerCase() === userAddr || currentOwner.toLowerCase() === userAddr)
  );

  const handleTransferOwnership = async () => {
    if (!walletConnected || !slot) return;
    const target = transferTarget.trim();
    if (!target.startsWith("0x") || target.length !== 42) {
      setTransferError("Recipient must be a valid 42-character 0x EVM address.");
      return;
    }
    if (target.toLowerCase() === currentOwner.toLowerCase()) {
      setTransferError("Recipient is already the current owner.");
      return;
    }

    setIsTransferring(true);
    setTransferError(null);
    setTransferSuccessTx(null);

    try {
      const walletClient = await getMetaMaskWalletClient();
      const res = await transferEntityOwnership(walletClient, slot.key, target as Address);
      const verifiedTarget = res.newOwner;
      setCurrentOwner(verifiedTarget);
      setTransferSuccessTx(res.txHash);
      setIsTransferOpen(false);
      if (onOwnerUpdatedRef.current) {
        onOwnerUpdatedRef.current(slot.key, verifiedTarget);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTransferError(msg);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleExtendProof = async (proofKey: Hex) => {
    if (!walletConnected) {
      setExtendError("Connect MetaMask to extend proof lifetime.");
      return;
    }

    setExtendingKey(proofKey);
    setExtendError(null);
    setExtendSuccess(null);

    try {
      const walletClient = await getMetaMaskWalletClient();
      const res = await extendProofEntity(walletClient, proofKey, 60);
      setExtendSuccess({
        key: proofKey,
        txHash: res.txHash,
        expiresAt: res.expiresAt,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExtendError(msg);
    } finally {
      setExtendingKey(null);
    }
  };

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

  // Authoritative derived booking status from Arkiv entities
  const slotStatus: SlotBookingStatus = getSlotBookingStatus(
    slot,
    winningBooking,
    completions,
    now
  );

  // Determine booking button disabled state & message
  let canBook = true;
  let bookDisabledReason = "";

  if (slotStatus === "COMPLETED") {
    canBook = false;
    bookDisabledReason = "Job completed and verified on Arkiv. Capacity is permanently closed.";
  } else if (slotStatus === "BOOKED") {
    canBook = false;
    if (userIsWinner) {
      bookDisabledReason = "You hold the confirmed booking on Arkiv for this slot.";
    } else if (hasUserBooking) {
      bookDisabledReason = "You have already placed a booking on this slot.";
    } else {
      bookDisabledReason = "This capacity is already booked by another wallet on Arkiv.";
    }
  } else if (slotStatus === "EXPIRED" || expired) {
    canBook = false;
    bookDisabledReason = "This slot window has expired on Arkiv.";
  } else if (isMySlot) {
    canBook = false;
    bookDisabledReason = "You cannot book your own slot.";
  } else if (!walletConnected) {
    canBook = false;
    bookDisabledReason = "Connect MetaMask to book this slot.";
  } else if (isWrongNetwork) {
    canBook = false;
    bookDisabledReason = "Switch wallet to Arkiv Tiramisu.";
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
                <span
                  className="synthetic-badge"
                  style={{
                    background: "#ecfdf5",
                    color: "#047857",
                    border: "1px solid #a7f3d0",
                    fontWeight: 800,
                  }}
                >
                  ⚗️ SYNTHETIC DEMO
                </span>
              )}
              {slotStatus === "COMPLETED" ? (
                <span
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#15803d",
                    border: "1px solid #22c55e",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                  id="drawer-status-badge-completed"
                >
                  ✅ Completed
                </span>
              ) : slotStatus === "BOOKED" ? (
                <span
                  style={{
                    background: "#4b5563",
                    color: "white",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                  id="drawer-status-badge-booked"
                >
                  🔒 Booked
                </span>
              ) : slotStatus === "EXPIRED" ? (
                <span
                  style={{
                    background: "#f3f4f6",
                    color: "#4b5563",
                    border: "1px solid #9ca3af",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                  id="drawer-status-badge-expired"
                >
                  ⚫ Expired
                </span>
              ) : isCritical ? (
                <span
                  style={{
                    background: "rgba(232, 69, 44, 0.15)",
                    color: "#b91c1c",
                    border: "1px solid #ef4444",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                  id="drawer-status-badge-critical"
                >
                  🔴 Expiring soon
                </span>
              ) : (
                <span
                  style={{
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#15803d",
                    border: "1px solid #22c55e",
                    padding: "2px 6px",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                  id="drawer-status-badge-available"
                >
                  🟢 Available
                </span>
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
                  <div key={p.bookingKey} style={{ borderBottom: idx < sellerReputation.proofs.length - 1 ? "1px dashed #ccc" : "none", paddingBottom: 6 }}>
                    <div>
                      <strong>Booking:</strong>{" "}
                      <a href={getEntityExplorerUrl(p.bookingKey)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--c-ink)" }}>
                        {p.bookingKey.slice(0, 10)}…{p.bookingKey.slice(-6)} ↗
                      </a>
                    </div>
                    <div style={{ marginTop: 2, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                      <div>
                        <strong>Seller Signature:</strong>{" "}
                        <a href={getEntityExplorerUrl(p.sellerCompletionKey)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--c-ink)" }}>
                          {p.sellerCompletionKey.slice(0, 10)}…{p.sellerCompletionKey.slice(-6)} ↗
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExtendProof(p.sellerCompletionKey)}
                        disabled={extendingKey === p.sellerCompletionKey}
                        style={{
                          background: "none",
                          border: "1px solid var(--c-ink)",
                          fontSize: "0.68rem",
                          padding: "1px 6px",
                          cursor: "pointer",
                          fontWeight: 700,
                          borderRadius: 2,
                        }}
                        title="Permissionlessly extend public cryptographic availability of this completion proof for another 60 days on Arkiv."
                      >
                        {extendingKey === p.sellerCompletionKey ? "Extending…" : "🛡️ Preserve proof (extend 60d)"}
                      </button>
                    </div>
                    <div style={{ marginTop: 2, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                      <div>
                        <strong>Buyer Signature:</strong>{" "}
                        <a href={getEntityExplorerUrl(p.buyerCompletionKey)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", color: "var(--c-ink)" }}>
                          {p.buyerCompletionKey.slice(0, 10)}…{p.buyerCompletionKey.slice(-6)} ↗
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleExtendProof(p.buyerCompletionKey)}
                        disabled={extendingKey === p.buyerCompletionKey}
                        style={{
                          background: "none",
                          border: "1px solid var(--c-ink)",
                          fontSize: "0.68rem",
                          padding: "1px 6px",
                          cursor: "pointer",
                          fontWeight: 700,
                          borderRadius: 2,
                        }}
                        title="Permissionlessly extend public cryptographic availability of this completion proof for another 60 days on Arkiv."
                      >
                        {extendingKey === p.buyerCompletionKey ? "Extending…" : "🛡️ Preserve proof (extend 60d)"}
                      </button>
                    </div>
                    <div style={{ fontSize: "0.65rem", opacity: 0.75, marginTop: 2 }}>
                      ℹ️ Extension preserves on-chain receipt availability; it does not reopen the job window.
                    </div>
                  </div>
                ))}

                {extendSuccess && (
                  <div style={{ padding: "6px 8px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", color: "#15803d", fontSize: "0.72rem" }}>
                    ✓ Proof extended to block #{extendSuccess.expiresAt.toLocaleString()}!{" "}
                    <a href={getTxExplorerUrl(extendSuccess.txHash)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                      Tx ↗
                    </a>
                  </div>
                )}
                {extendError && (
                  <div style={{ padding: "6px 8px", background: "rgba(232, 69, 44, 0.15)", border: "1px solid #ef4444", color: "#b91c1c", fontSize: "0.72rem" }}>
                    ⚠️ {extendError}
                  </div>
                )}
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
              <div className="proof-key">$creator (immutable)</div>
              <div className="proof-val-wrap">
                <div className="drawer__key-box" style={{ fontSize: "0.65rem" }} aria-label={`Creator: ${slot.creator}`}>
                  {slot.creator}
                  {slot.creator.toLowerCase() === userAddr && (
                    <span style={{ marginLeft: 6, color: "var(--c-teal)", fontWeight: 700 }}>
                      (You)
                    </span>
                  )}
                </div>
                <CopyButton value={slot.creator} label="creator address" />
              </div>
            </div>

            {/* Current Owner */}
            <div className="proof-row">
              <div className="proof-key">
                $owner (current owner)
                {isVerifyingOwner && (
                  <span style={{ marginLeft: 6, fontSize: "0.65rem", color: "var(--c-amber)", fontWeight: 400 }}>
                    (verifying on-chain…)
                  </span>
                )}
                {!isVerifyingOwner && ownerVerificationError && (
                  <span style={{ marginLeft: 6, fontSize: "0.65rem", color: "#b91c1c", fontWeight: 400 }} title={ownerVerificationError}>
                    (cached state)
                  </span>
                )}
              </div>
              <div className="proof-val-wrap">
                <div className="drawer__key-box" style={{ fontSize: "0.65rem" }} aria-label={`Current Owner: ${currentOwner}`}>
                  {currentOwner}
                  {isOwner && (
                    <span style={{ marginLeft: 6, color: "var(--c-teal)", fontWeight: 700 }}>
                      (You)
                    </span>
                  )}
                </div>
                <div className="proof-actions">
                  <CopyButton value={currentOwner} label="owner address" />
                  {isOwner && walletConnected && (
                    <button
                      type="button"
                      id="toggle-transfer-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTransferOpen((v) => !v);
                        setTransferError(null);
                        setTransferSuccessTx(null);
                      }}
                      style={{
                        background: isTransferOpen ? "#2a2824" : "var(--c-paper)",
                        color: isTransferOpen ? "var(--c-paper)" : "var(--c-ink)",
                        border: isTransferOpen ? "1px solid rgba(251, 247, 240, 0.5)" : "1px solid var(--c-ink)",
                        padding: "2px 8px",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        fontWeight: 700,
                        borderRadius: 2,
                      }}
                    >
                      {isTransferOpen ? "Cancel Transfer" : "⇄ Transfer"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Inline Ownership Transfer Form */}
            {isTransferOpen && (
              <div
                style={{
                  background: "var(--c-paper-dark)",
                  color: "var(--c-ink)",
                  border: "1px dashed var(--c-ink)",
                  padding: "10px 12px",
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  borderRadius: 2,
                }}
              >
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--c-ink)" }}>
                  ⇄ Transfer Listing Ownership on Arkiv
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--c-ink)", opacity: 0.9, lineHeight: 1.45 }}>
                  Calls real Arkiv <code style={{ background: "rgba(0,0,0,0.08)", padding: "1px 4px", borderRadius: 2, color: "var(--c-ink)" }}>changeOwnership()</code>. The original creator (<code style={{ background: "rgba(0,0,0,0.08)", padding: "1px 4px", borderRadius: 2, color: "var(--c-ink)" }}>$creator</code>) remains
                  permanent and immutable on-chain, but you will lose owner-only controls and the recipient becomes the new owner.
                </div>
                <input
                  type="text"
                  placeholder="Recipient address (0x...)"
                  value={transferTarget}
                  onChange={(e) => setTransferTarget(e.target.value)}
                  disabled={isTransferring}
                  style={{
                    padding: "6px 8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    border: "1px solid var(--c-ink)",
                    background: "#ffffff",
                    color: "var(--c-ink)",
                    borderRadius: 2,
                    width: "100%",
                  }}
                />
                {transferError && (
                  <div style={{ color: "#b91c1c", fontSize: "0.72rem", fontWeight: 600 }}>
                    ⚠️ {transferError}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setIsTransferOpen(false)}
                    disabled={isTransferring}
                    style={{
                      background: "var(--c-paper)",
                      color: "var(--c-ink)",
                      border: "1px solid #777",
                      fontSize: "0.72rem",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontWeight: 600,
                      borderRadius: 2,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleTransferOwnership}
                    disabled={isTransferring || !transferTarget.trim()}
                    style={{
                      background: "var(--c-teal)",
                      color: "white",
                      border: "none",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "4px 12px",
                      cursor: isTransferring || !transferTarget.trim() ? "not-allowed" : "pointer",
                      opacity: isTransferring || !transferTarget.trim() ? 0.6 : 1,
                      borderRadius: 2,
                    }}
                  >
                    {isTransferring ? "Submitting tx…" : "Confirm Transfer"}
                  </button>
                </div>
              </div>
            )}

            {transferSuccessTx && (
              <div style={{ padding: "6px 8px", background: "rgba(34, 197, 94, 0.15)", border: "1px solid #22c55e", color: "#15803d", fontSize: "0.72rem", marginTop: 4 }}>
                ✓ Ownership transferred to <code>{currentOwner.slice(0, 8)}…{currentOwner.slice(-6)}</code>!{" "}
                <a href={getTxExplorerUrl(transferSuccessTx)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                  Tx ↗
                </a>
              </div>
            )}

            {/* Creation Flags (Display verified flags from fetched Arkiv entity) */}
            {slot.creationFlags ? (
              <div className="proof-row">
                <div className="proof-key">Creation Flags</div>
                <div className="proof-val" style={{ display: "flex", gap: "6px", flexWrap: "wrap", fontSize: "0.72rem" }}>
                  <span
                    style={{
                      background: slot.creationFlags.readonly ? "rgba(34, 197, 94, 0.15)" : "#f3f4f6",
                      color: slot.creationFlags.readonly ? "#15803d" : "#4b5563",
                      padding: "2px 6px",
                      borderRadius: "2px",
                      border: "1px solid",
                      borderColor: slot.creationFlags.readonly ? "#86efac" : "#d1d5db",
                      fontWeight: 700,
                    }}
                  >
                    {slot.creationFlags.readonly ? "🔒 readonly: true (Immutable)" : "readonly: false"}
                  </span>
                  <span
                    style={{
                      background: slot.creationFlags.permissionlessExtension ? "rgba(59, 130, 246, 0.15)" : "#f3f4f6",
                      color: slot.creationFlags.permissionlessExtension ? "#1d4ed8" : "#4b5563",
                      padding: "2px 6px",
                      borderRadius: "2px",
                      border: "1px solid",
                      borderColor: slot.creationFlags.permissionlessExtension ? "#93c5fd" : "#d1d5db",
                      fontWeight: 700,
                    }}
                  >
                    {slot.creationFlags.permissionlessExtension ? "🌐 permissionlessExtension: true" : "permissionlessExtension: false"}
                  </span>
                </div>
              </div>
            ) : null}

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
            {slotStatus === "AVAILABLE" ? (
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
            ) : slotStatus === "BOOKED" ? (
              <div
                title={bookDisabledReason}
                style={{ width: "100%" }}
              >
                <button
                  id="drawer-book-btn"
                  className="btn-primary"
                  disabled={true}
                  aria-label={bookDisabledReason}
                  aria-disabled={true}
                  style={{
                    width: "100%",
                    background: "#4b5563",
                    cursor: "not-allowed",
                    opacity: 0.9,
                  }}
                >
                  🔒 {userIsWinner ? "Booked by You" : "Slot Already Booked"}
                  <span className="btn-tooltip">{bookDisabledReason}</span>
                </button>
              </div>
            ) : slotStatus === "COMPLETED" ? (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.15)",
                  border: "1px solid #22c55e",
                  color: "#15803d",
                  padding: "8px 12px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  textAlign: "center",
                  width: "100%",
                }}
              >
                ✅ Job Completed — This capacity window is permanently fulfilled and closed.
              </div>
            ) : (
              <div
                style={{
                  background: "#f3f4f6",
                  border: "1px solid #9ca3af",
                  color: "#4b5563",
                  padding: "8px 12px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  textAlign: "center",
                  width: "100%",
                }}
              >
                ⚫ Slot window has expired. This capacity is no longer bookable.
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
