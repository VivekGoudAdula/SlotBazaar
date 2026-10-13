/**
 * src/components/FilterBar.tsx
 *
 * Filter bar — Phase 2C UI Fix:
 *  - One compact row on desktop, wraps cleanly on mobile
 *  - Type chips (All, Machine, Transport, Freelance)
 *  - City / cluster select
 *  - Price chips (Any, Low, Mid, High)
 *  - "Ending soon (<15 min)" toggle
 *  - "My slots" toggle (only when connected)
 *  - Live count "N slots"
 *  - Last-updated time & Refresh button
 *  - "Synthetic demo data" legend badge
 *  - "List" button that toggles the slide-over slot drawer
 */

import React from "react";
import type { SlotCategory } from "../lib/arkiv.js";

export type PriceBandFilter = "all" | "low" | "mid" | "high";

export interface FilterState {
  category: SlotCategory | "all";
  cluster: string; // "all" = no filter
  priceBand: PriceBandFilter;
  endingSoon: boolean;
  mySlots: boolean;
}

export interface FilterBarProps {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  clusters: string[];
  slotCount: number;
  totalCount: number;
  loading: boolean;
  lastFetched: Date | null;
  onRefresh: () => void;
  isListOpen: boolean;
  onToggleList: () => void;
  isConnected: boolean;
}

const CATEGORY_OPTS: { value: SlotCategory | "all"; label: string; icon: string }[] = [
  { value: "all",       label: "All",       icon: "🗺" },
  { value: "machine",   label: "Machine",   icon: "⚙️" },
  { value: "transport", label: "Transport", icon: "🚚" },
  { value: "freelance", label: "Freelance", icon: "💻" },
];

const PRICE_OPTS: { value: PriceBandFilter; label: string }[] = [
  { value: "all",  label: "Any" },
  { value: "low",  label: "₹ Low" },
  { value: "mid",  label: "₹₹ Mid" },
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
  isListOpen,
  onToggleList,
  isConnected,
}: FilterBarProps): React.ReactElement {
  function set<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onChange({ ...filters, [key]: val });
  }

  const lastLabel = lastFetched
    ? lastFetched.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="filter-bar" role="toolbar" aria-label="Slot filters" id="filter-bar">
      {/* Category chips */}
      <div className="filter-group filter-group--categories">
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
            <span>{label}</span>
          </button>
        ))}
      </div>

      <span className="filter-bar__divider" aria-hidden="true" />

      {/* City select */}
      <div className="filter-group filter-group--city">
        <select
          id="filter-cluster"
          className="filter-select"
          value={filters.cluster}
          onChange={(e) => set("cluster", e.target.value)}
          aria-label="Filter by city"
        >
          <option value="all">All cities</option>
          {clusters.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <span className="filter-bar__divider" aria-hidden="true" />

      {/* Price chips */}
      <div className="filter-group filter-group--price">
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
      </div>

      <span className="filter-bar__divider" aria-hidden="true" />

      {/* Toggles group */}
      <div className="filter-group filter-group--toggles">
        {/* Ending soon toggle */}
        <button
          id="filter-ending-soon"
          className={[
            "filter-chip filter-chip--sm",
            filters.endingSoon ? "filter-chip--ending-soon-active" : "filter-chip--ending-soon",
          ].join(" ")}
          onClick={() => set("endingSoon", !filters.endingSoon)}
          aria-pressed={filters.endingSoon}
          aria-label="Show only slots ending in <15 min"
          title="Ending in < 15 min"
        >
          🔴 &lt;15 min
        </button>

        {/* My slots toggle (only enabled/visible when wallet connected) */}
        {isConnected && (
          <button
            id="filter-my-slots"
            className={[
              "filter-chip filter-chip--sm",
              filters.mySlots ? "filter-chip--active" : "",
            ].join(" ")}
            onClick={() => set("mySlots", !filters.mySlots)}
            aria-pressed={filters.mySlots}
            aria-label="Show only my slots"
            title="My posted slots"
          >
            👤 My slots
          </button>
        )}
      </div>

      <span className="filter-bar__divider" aria-hidden="true" />

      {/* Right controls: count, refresh, demo badge, list button */}
      <div className="filter-bar__right">
        {/* Live Count */}
        <span
          className="filter-bar__count"
          aria-live="polite"
          aria-label={`${slotCount} of ${totalCount} slots`}
          id="filter-slot-count"
        >
          <strong>{slotCount}</strong>/{totalCount} slots
          <span className="filter-bar__time" title={`Last updated: ${lastLabel}`}>
            · {lastLabel}
          </span>
        </span>

        {/* Refresh button */}
        <button
          id="filter-bar-refresh"
          className="filter-bar__refresh"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh slots from Arkiv"
          title="Refresh"
        >
          <span className={loading ? "spin" : ""} aria-hidden="true">⟳</span>
        </button>

        {/* Synthetic demo data legend badge */}
        <span
          className="filter-bar__demo-badge"
          title="Data generated on Arkiv testnet"
          id="filter-demo-badge"
        >
          Synthetic demo data
        </span>

        {/* List toggle button */}
        <button
          id="filter-bar-list-btn"
          className={`filter-bar__list-btn${isListOpen ? " filter-bar__list-btn--active" : ""}`}
          onClick={onToggleList}
          aria-expanded={isListOpen}
          aria-label={isListOpen ? "Close slot list" : "Open slot list"}
          title="Toggle slot list panel"
        >
          <span>📋</span>
          <span>List</span>
          <span className="filter-bar__list-pill">{slotCount}</span>
        </button>
      </div>
    </div>
  );
}
