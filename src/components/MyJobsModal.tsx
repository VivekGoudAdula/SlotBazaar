/**
 * src/components/MyJobsModal.tsx
 *
 * Phase 4: "My Jobs" Panel under Wallet Menu.
 *
 * Lists all bookings where connected user is seller or buyer:
 *  - Displays status: Awaiting completion, Awaiting other side, Verified
 *  - Action button to confirm job done once slot has started
 *  - On-chain cryptographic proof: links to entity keys on Arkiv Explorer
 */

import React, { useState } from "react";
import type { Hex, Address } from "viem";
import type {
  BookingEntity,
  CompletionEntity,
  SlotEntity,
  ReputationResult,
} from "../lib/arkiv.js";
import { formatDateTime } from "../lib/time.js";
import { useNow } from "../hooks/useNow.js";

const EXPLORER_BASE = "https://explorer.tiramisu.arkiv.network";

export interface MyJobsModalProps {
  open: boolean;
  onClose: () => void;
  userAddress: Address | null;
  slots: SlotEntity[];
  bookings: BookingEntity[];
  completions: CompletionEntity[];
  winningBookingsBySlot: Map<string, BookingEntity>;
  reputation: ReputationResult | undefined;
  onOpenConfirmJob: (slot: SlotEntity, booking: BookingEntity, role: "seller" | "buyer") => void;
}

export function MyJobsModal({
  open,
  onClose,
  userAddress,
  slots,
  bookings: _bookings,
  completions,
  winningBookingsBySlot,
  reputation,
  onOpenConfirmJob,
}: MyJobsModalProps): React.ReactElement | null {
  const now = useNow();
  const [expandedJobKey, setExpandedJobKey] = useState<Hex | null>(null);

  if (!open || !userAddress) return null;

  const normUser = userAddress.toLowerCase();

  // Find all winning bookings where user is seller or buyer
  interface JobRow {
    booking: BookingEntity;
    slot: SlotEntity | undefined;
    role: "seller" | "buyer";
    hasSellerConfirmed: boolean;
    hasBuyerConfirmed: boolean;
    sellerCompletion?: CompletionEntity;
    buyerCompletion?: CompletionEntity;
    isVerified: boolean;
    canConfirm: boolean;
  }

  const jobs: JobRow[] = [];

  for (const [, winner] of winningBookingsBySlot.entries()) {
    const slotMatch = slots.find((s) => s.key.toLowerCase() === winner.slotKey.toLowerCase());
    const slotCreator = (winner.slotCreator || slotMatch?.creator || "0x0").toLowerCase();
    const buyerCreator = winner.creator.toLowerCase();

    const isUserSeller = slotCreator === normUser;
    const isUserBuyer = buyerCreator === normUser;

    if (!isUserSeller && !isUserBuyer) continue;

    const role: "seller" | "buyer" = isUserSeller ? "seller" : "buyer";

    // Find completions matching this booking
    const winnerKeyNorm = winner.key.toLowerCase();
    const slotKeyNorm = winner.slotKey.toLowerCase();

    const matchingCompletions = completions.filter((c) => {
      const bKey = (c.bookingKey || "").toLowerCase();
      const sKey = (c.slotKey || "").toLowerCase();
      return bKey === winnerKeyNorm || sKey === slotKeyNorm;
    });

    const sellerComp = matchingCompletions.find((c) => c.role === "seller" && c.creator.toLowerCase() === slotCreator);
    const buyerComp = matchingCompletions.find((c) => c.role === "buyer" && c.creator.toLowerCase() === buyerCreator);

    const hasSellerConfirmed = Boolean(sellerComp);
    const hasBuyerConfirmed = Boolean(buyerComp);
    const isVerified = hasSellerConfirmed && hasBuyerConfirmed;

    const userHasConfirmed = isUserSeller ? hasSellerConfirmed : hasBuyerConfirmed;
    const slotStarted = slotMatch ? now >= slotMatch.startsAt : true;
    const canConfirm = !userHasConfirmed && slotStarted;

    jobs.push({
      booking: winner,
      slot: slotMatch,
      role,
      hasSellerConfirmed,
      hasBuyerConfirmed,
      sellerCompletion: sellerComp,
      buyerCompletion: buyerComp,
      isVerified,
      canConfirm,
    });
  }

  // Sort by earliest booking
  jobs.sort((a, b) => b.booking.bookedAt - a.booking.bookedAt);

  return (
    <div className="post-modal-backdrop" onClick={onClose}>
      <div
        className="post-modal"
        role="dialog"
        aria-modal="true"
        aria-label="My jobs list"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640, maxHeight: "88vh", overflowY: "auto" }}
      >
        <div className="post-modal__header">
          <div>
            <h3>My Jobs & Reputation</h3>
            <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
              Two-sided decentralized work receipts on Arkiv Tiramisu
            </span>
          </div>
          <button className="post-modal__close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Reputation Score Summary Card */}
        <div
          style={{
            background: "var(--c-paper-dark)",
            border: "var(--border)",
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
              Your Verified Reputation
            </div>
            <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-display)", fontWeight: 800, marginTop: 2 }}>
              🏆 {reputation?.verifiedJobsCount ?? 0} Verified Jobs
            </div>
          </div>
          <div style={{ fontSize: "0.75rem", textAlign: "right", opacity: 0.85, maxWidth: 220, lineHeight: 1.3 }}>
            Counts when distinct buyer and seller wallets both sign on-chain completion.
          </div>
        </div>

        {/* Jobs List */}
        <div className="post-modal__body" style={{ gap: 10 }}>
          {jobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "var(--c-ink)", opacity: 0.7 }}>
              No active bookings found for your connected address.
              <br />
              <span style={{ fontSize: "0.8rem" }}>
                Post a slot or book an open slot to begin working!
              </span>
            </div>
          ) : (
            jobs.map((job) => {
              const isExpanded = expandedJobKey === job.booking.key;
              const slotTitle = job.slot?.title ?? `Slot ${job.booking.slotKey.slice(0, 10)}…`;

              return (
                <div
                  key={job.booking.key}
                  style={{
                    border: "var(--border)",
                    background: "var(--c-paper)",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {slotTitle}
                      </div>
                      <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 2 }}>
                        Role: <strong>{job.role === "seller" ? "Seller (Merchant)" : "Buyer (Client)"}</strong>
                        {" · "}Booked {formatDateTime(job.booking.bookedAt)}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {job.isVerified ? (
                        <span
                          style={{
                            background: "rgba(34, 197, 94, 0.15)",
                            color: "#15803d",
                            border: "1px solid #22c55e",
                            padding: "3px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ✓ Verified
                        </span>
                      ) : (job.role === "seller" && job.hasSellerConfirmed) || (job.role === "buyer" && job.hasBuyerConfirmed) ? (
                        <span
                          style={{
                            background: "rgba(234, 179, 8, 0.15)",
                            color: "#a16207",
                            border: "1px solid #eab308",
                            padding: "3px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⏳ Awaiting Other Side
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(100, 116, 139, 0.12)",
                            color: "var(--c-ink)",
                            border: "1px solid var(--c-ink)",
                            padding: "3px 8px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Awaiting Completion
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Proof trigger */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setExpandedJobKey(isExpanded ? null : job.booking.key)}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        color: "var(--c-ink)",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      {isExpanded ? "Hide On-Chain Proofs ▲" : "View On-Chain Proofs ▼"}
                    </button>

                    {job.canConfirm && job.slot && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          onClose();
                          onOpenConfirmJob(job.slot!, job.booking, job.role);
                        }}
                        style={{
                          padding: "4px 10px",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Confirm Job Done →
                      </button>
                    )}
                  </div>

                  {/* Expanded On-chain Proof */}
                  {isExpanded && (
                    <div
                      style={{
                        background: "var(--c-paper-dark)",
                        border: "1px solid var(--c-ink)",
                        padding: "8px 10px",
                        fontSize: "0.72rem",
                        fontFamily: "var(--font-mono)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      <div>
                        <strong>Booking:</strong>{" "}
                        <a
                          href={`${EXPLORER_BASE}/entity/${job.booking.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "underline", color: "var(--c-ink)" }}
                        >
                          {job.booking.key.slice(0, 14)}…{job.booking.key.slice(-8)} ↗
                        </a>
                      </div>
                      {job.sellerCompletion && (
                        <div>
                          <strong>Seller Receipt:</strong>{" "}
                          <a
                            href={`${EXPLORER_BASE}/entity/${job.sellerCompletion.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "underline", color: "var(--c-ink)" }}
                          >
                            {job.sellerCompletion.key.slice(0, 14)}…{job.sellerCompletion.key.slice(-8)} ↗
                          </a>
                        </div>
                      )}
                      {job.buyerCompletion && (
                        <div>
                          <strong>Buyer Receipt:</strong>{" "}
                          <a
                            href={`${EXPLORER_BASE}/entity/${job.buyerCompletion.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "underline", color: "var(--c-ink)" }}
                          >
                            {job.buyerCompletion.key.slice(0, 14)}…{job.buyerCompletion.key.slice(-8)} ↗
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="post-modal__footer">
          <button type="button" className="post-modal__btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
