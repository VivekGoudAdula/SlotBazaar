/**
 * src/components/SlotCard.tsx
 *
 * Compact slot information card used in both Leaflet popups and the drawer.
 * Indian Railway station-board style: title bold, cluster tag, countdown.
 */

import React from "react";
import type { SlotEntity } from "../lib/arkiv.js";
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
  /** Called when user clicks "View Details" / the card body */
  onSelect?: (slot: SlotEntity) => void;
}

export function SlotCard({ slot, onSelect }: SlotCardProps): React.ReactElement {
  const now      = useNow();
  const urgency  = getUrgency(slot.endsAt, now);
  const timeLeft = formatTimeLeft(slot.endsAt, now);
  const icon     = CATEGORY_ICONS[slot.category] ?? "📦";

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
          </div>
        </div>
      </div>

      {/* Cluster + price band row */}
      <div className="slot-card__row">
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
