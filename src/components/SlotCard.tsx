/**
 * src/components/SlotCard.tsx
 *
 * Compact slot information card used in both Leaflet popups and the drawer.
 * Indian Railway station-board style: title bold, cluster tag, countdown.
 */

import React from "react";
import type { SlotEntity, BookingEntity, ReputationResult } from "../lib/arkiv.js";
import { formatTimeLeft, getUrgency } from "../lib/time.js";
import { useNow } from "../hooks/useNow.js";

const CATEGORY_ICONS: Record<string, string> = {
  machine:   "⚙️",
  transport: "🚚",
  freelance: "💻",
};

const PRICE_BAND_LABELS: Record<string, string> = {
  low:  "₹ Low",
  mid:  "₹₹ Mid",
  high: "₹₹₹ High",
};

export interface SlotCardProps {
  slot: SlotEntity;
  winningBooking?: BookingEntity;
  sellerReputation?: ReputationResult;
  userAddress?: string | null;
  /** Called when user clicks "View Details" / the card body */
  onSelect?: (slot: SlotEntity) => void;
}

export function SlotCard({
  slot,
  winningBooking,
  sellerReputation,
  userAddress,
  onSelect,
}: SlotCardProps): React.ReactElement {
  const now      = useNow();
  const urgency  = getUrgency(slot.endsAt, now);
  const timeLeft = formatTimeLeft(slot.endsAt, now);
  const icon     = CATEGORY_ICONS[slot.category] ?? "📦";

  const normUser = userAddress?.toLowerCase() ?? "";
  const isMine = Boolean(
    normUser &&
    (slot.creator.toLowerCase() === normUser || slot.owner.toLowerCase() === normUser)
  );
  const isBooked = Boolean(winningBooking);
  const isBookedByYou = Boolean(
    winningBooking && normUser && winningBooking.creator.toLowerCase() === normUser
  );

  const verifiedCount = sellerReputation?.verifiedJobsCount ?? 0;

  function handleSelect() {
    onSelect?.(slot);
  }

  return (
    <article
      className="slot-card"
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleSelect()}
      aria-label={`${slot.title} — ${timeLeft} remaining`}
    >
      {/* Header row */}
      <div className="slot-card__header">
        <div
          className="slot-card__category-badge"
          aria-hidden="true"
          title={slot.category}
        >
          {icon}
        </div>
        <div className="slot-card__meta">
          <div className="slot-card__title" title={slot.title}>
            {slot.title}
          </div>
          <div className="slot-card__seller" title={slot.sellerLabel}>
            {slot.sellerLabel}
            {verifiedCount > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  color: "var(--c-teal)",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                }}
                title="Verified jobs on Arkiv: confirmed by both seller and winning buyer"
              >
                🏆 {verifiedCount} verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* State badge + Cluster + price band row */}
      <div className="slot-card__row" style={{ flexWrap: "wrap", gap: "6px" }}>
        {isBookedByYou ? (
          <span
            style={{
              background: "var(--c-teal)",
              color: "white",
              fontSize: "0.68rem",
              fontWeight: 800,
              padding: "1px 5px",
              borderRadius: "2px",
            }}
          >
            ★ Booked by you
          </span>
        ) : isMine ? (
          <span
            style={{
              background: "var(--c-marigold)",
              color: "var(--c-ink)",
              fontSize: "0.68rem",
              fontWeight: 800,
              padding: "1px 5px",
              borderRadius: "2px",
            }}
          >
            ★ Your slot
          </span>
        ) : isBooked ? (
          <span
            style={{
              background: "#9E9E9E",
              color: "white",
              fontSize: "0.68rem",
              fontWeight: 800,
              padding: "1px 5px",
              borderRadius: "2px",
            }}
          >
            🔒 Booked
          </span>
        ) : (
          <span
            style={{
              background: "rgba(34, 197, 94, 0.15)",
              color: "#15803d",
              border: "1px solid #22c55e",
              fontSize: "0.68rem",
              fontWeight: 800,
              padding: "1px 5px",
              borderRadius: "2px",
            }}
          >
            🟢 Open
          </span>
        )}

        <span className="slot-card__cluster-tag" aria-label={`Cluster: ${slot.cluster}`}>
          {slot.cluster}
        </span>
        <span
          className={`slot-card__price-band slot-card__price-band--${slot.priceBand}`}
          aria-label={`Price band: ${slot.priceBand}`}
        >
          {PRICE_BAND_LABELS[slot.priceBand]}
        </span>
      </div>

      {/* Countdown */}
      <div
        className={`slot-card__countdown slot-card__countdown--${urgency}`}
        aria-label={`Time remaining: ${timeLeft}`}
        aria-live="off"
      >
        <span aria-hidden="true">
          {urgency === "critical" ? "🔴" : urgency === "urgent" ? "🟡" : "🟢"}
        </span>
        <span>{timeLeft}</span>
      </div>

      {/* CTA */}
      {onSelect && (
        <div className="slot-card__cta" aria-hidden="true">
          View Details →
        </div>
      )}
    </article>
  );
}

