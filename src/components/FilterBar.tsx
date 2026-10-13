/**
 * src/components/FilterBar.tsx
 *
 * Category filter chips + slot count + manual refresh button.
 */

import React from "react";
import type { SlotCategory } from "../lib/arkiv.js";

const CATEGORY_LABELS: Record<SlotCategory | "all", { label: string; icon: string }> = {
  all:       { label: "All Slots",  icon: "🗺" },
  machine:   { label: "Machine",    icon: "⚙️" },
  transport: { label: "Transport",  icon: "🚚" },
  freelance: { label: "Freelance",  icon: "💻" },
};

export interface FilterBarProps {
  /** Currently active filter ("all" | SlotCategory) */
  active: SlotCategory | "all";
  /** Called when the user clicks a filter chip */
  onChange: (next: SlotCategory | "all") => void;
  /** Total number of visible slots (after filtering) */
  slotCount: number;
  /** Whether a background fetch is in progress */
  loading: boolean;
  /** ISO string of last successful fetch */
  lastFetched: Date | null;
  /** Triggered by the refresh button */
  onRefresh: () => void;
}

export function FilterBar({
  active,
  onChange,
  slotCount,
  loading,
  lastFetched,
  onRefresh,
}: FilterBarProps): React.ReactElement {
  const categories: Array<SlotCategory | "all"> = ["all", "machine", "transport", "freelance"];

  const lastFetchedLabel = lastFetched
    ? `Updated ${lastFetched.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "—";

  return (
    <div className="filter-bar" role="toolbar" aria-label="Slot category filters">
      <span className="filter-bar__label" aria-hidden="true">Filter:</span>

      {categories.map((cat) => {
        const { label, icon } = CATEGORY_LABELS[cat];
        const isActive = active === cat;
        return (
          <button
            key={cat}
            id={`filter-chip-${cat}`}
            className={[
              "filter-chip",
              cat !== "all" ? `filter-chip--${cat}` : "",
              isActive ? "filter-chip--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onChange(cat)}
            aria-pressed={isActive}
            aria-label={`Filter: ${label}`}
            title={label}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        );
      })}

      <span className="filter-bar__count" aria-live="polite" aria-label={`${slotCount} slots visible`}>
        {slotCount} slot{slotCount !== 1 ? "s" : ""}
        {" · "}
        <span style={{ opacity: 0.65, fontSize: "0.68rem" }}>{lastFetchedLabel}</span>
      </span>

      <button
        id="filter-bar-refresh"
        className="filter-bar__refresh"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh slots from Arkiv"
        title="Refresh slots from Arkiv"
      >
        <span className={loading ? "spin" : ""} aria-hidden="true">⟳</span>
        {loading ? "Fetching…" : "Refresh"}
      </button>
    </div>
  );
}
