/**
 * src/components/FilterBar.tsx
 *
 * Filter chips: category, cluster, price band, "ending soon" (< 30 min).
 * Also shows live slot count, last-fetch time, and refresh button.
 */

import React from "react";
import type { SlotCategory } from "../lib/arkiv.js";

export type PriceBandFilter = "all" | "low" | "mid" | "high";

export interface FilterState {
  category: SlotCategory | "all";
  cluster:  string;           // "all" = no filter
  priceBand: PriceBandFilter;
  endingSoon: boolean;        // < 30 min remaining
}

export interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  clusters: string[];         // unique cluster names from loaded slots
  slotCount: number;
  totalCount: number;
  loading: boolean;
  lastFetched: Date | null;
  onRefresh: () => void;
}

const CATEGORY_OPTS: { value: SlotCategory | "all"; label: string; icon: string }[] = [
  { value: "all",       label: "All",       icon: "🗺"  },
  { value: "machine",   label: "Machine",   icon: "⚙️" },
  { value: "transport", label: "Transport", icon: "🚚" },
  { value: "freelance", label: "Freelance", icon: "💻" },
];

const PRICE_OPTS: { value: PriceBandFilter; label: string }[] = [
  { value: "all",  label: "Any price" },
  { value: "low",  label: "₹ Low"    },
  { value: "mid",  label: "₹₹ Mid"   },
  { value: "high", label: "₹₹₹ High" },
];

export function FilterBar({
  filters,
  onChange,
  clusters,
  slotCount,
  totalCount,
  loading,
  lastFetched,
  onRefresh,
}: FilterBarProps): React.ReactElement {

  function set<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onChange({ ...filters, [key]: val });
  }

  const lastLabel = lastFetched
    ? lastFetched.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="filter-bar" role="toolbar" aria-label="Slot filters">
      {/* Category chips */}
      <span className="filter-bar__label" aria-hidden="true">Type:</span>
      {CATEGORY_OPTS.map(({ value, label, icon }) => (
        <button
          key={value}
          id={`filter-chip-${value}`}
          className={[
            "filter-chip",
            value !== "all" ? `filter-chip--${value}` : "",
            filters.category === value ? "filter-chip--active" : "",
          ].filter(Boolean).join(" ")}
          onClick={() => set("category", value)}
          aria-pressed={filters.category === value}
          aria-label={`Filter by ${label}`}
        >
          <span aria-hidden="true">{icon}</span>
          {label}
        </button>
      ))}

      {/* Divider */}
      <span className="filter-bar__divider" aria-hidden="true" />

      {/* Cluster select */}
      {clusters.length > 0 && (
        <>
          <span className="filter-bar__label" aria-hidden="true">City:</span>
          <select
            id="filter-cluster"
            className="filter-select"
            value={filters.cluster}
            onChange={(e) => set("cluster", e.target.value)}
            aria-label="Filter by cluster"
          >
            <option value="all">All cities</option>
            {clusters.map((c) => (
              <option key={c} value={c} style={{ textTransform: "capitalize" }}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </>
      )}

      {/* Price band */}
      <span className="filter-bar__label" aria-hidden="true">Price:</span>
      {PRICE_OPTS.map(({ value, label }) => (
        <button
          key={value}
          id={`filter-price-${value}`}
          className={[
            "filter-chip filter-chip--sm",
            filters.priceBand === value ? "filter-chip--active" : "",
          ].join(" ")}
          onClick={() => set("priceBand", value)}
          aria-pressed={filters.priceBand === value}
          aria-label={`Filter by price: ${label}`}
        >
          {label}
        </button>
      ))}

      {/* Ending soon */}
      <button
        id="filter-ending-soon"
        className={[
          "filter-chip filter-chip--sm",
          filters.endingSoon ? "filter-chip--ending-soon-active" : "filter-chip--ending-soon",
        ].join(" ")}
        onClick={() => set("endingSoon", !filters.endingSoon)}
        aria-pressed={filters.endingSoon}
        aria-label="Show only slots ending in the next 15 minutes"
        title="Ending in < 15 min"
      >
        🔴 Ending soon (&lt;15 min)
      </button>

      {/* Count + refresh */}
      <span
        className="filter-bar__count"
        aria-live="polite"
        aria-label={`${slotCount} of ${totalCount} slots visible`}
      >
        {slotCount}/{totalCount} slots · <span style={{ opacity: 0.65, fontSize: "0.68rem" }}>{lastLabel}</span>
      </span>

      <button
        id="filter-bar-refresh"
        className="filter-bar__refresh"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh slots from Arkiv"
        title="Refresh"
      >
        <span className={loading ? "spin" : ""} aria-hidden="true">⟳</span>
        {loading ? "…" : "Refresh"}
      </button>
    </div>
  );
}
