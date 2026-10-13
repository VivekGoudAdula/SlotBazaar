/**
 * src/components/MapView.tsx — Phase 2C
 *
 * Changes from Phase 2B:
 *  - OSM tile source (no API key required)
 *  - CSS tinting via .leaflet-tile-pane for paper-map look
 *  - Corrected category colors: marigold / peacock teal / indigo
 *  - minZoom 4, maxBounds India, maxZoom 19
 *  - attributionControl re-enabled (OSM requires visible attribution)
 *  - Tile-fail fallback: paper background preserved via CSS
 *  - flyTo support via new `flyTarget` prop
 */

import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
// @ts-expect-error — no types for this package
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import "@changey/react-leaflet-markercluster/dist/styles.min.css";
import type { SlotEntity } from "../lib/arkiv.js";
import { SlotCard } from "./SlotCard.js";
import { useNow } from "../hooks/useNow.js";

// ─── Fix Leaflet icon paths (broken under Vite) ───────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Spec colours ─────────────────────────────────────────────────────────────
/** Marigold, Peacock Teal, Indigo — exactly as specified */
const CATEGORY_COLORS: Record<string, string> = {
  machine:   "#F5A623", // Marigold
  transport: "#0F8B8D", // Peacock Teal
  freelance: "#3B3F9E", // Indigo
};

const CATEGORY_ICONS: Record<string, string> = {
  machine:   "⚙",
  transport: "🚚",
  freelance: "💻",
};

/** 15-minute threshold for vermilion pulse ring */
const CRITICAL_SEC = 15 * 60;

/**
 * Creates a DivIcon teardrop marker with the correct category colour.
 * Adds vermilion pulse ring when < 15 min remain.
 */
function createSlotIcon(slot: SlotEntity, now: number): L.DivIcon {
  const remaining  = slot.endsAt - now;
  const isCritical = remaining > 0 && remaining <= CRITICAL_SEC;
  const isExpired  = remaining <= 0;

  const baseColor  = isExpired
    ? "#9E9E9E"
    : CATEGORY_COLORS[slot.category] ?? "#1B1A17";

  const markerColor = isCritical ? "#E8452C" : baseColor;

  const html = `
    <div
      class="slot-marker${isCritical ? " slot-marker--pulse" : ""}"
      style="background:${markerColor};"
      title="${slot.title.replace(/"/g, "&quot;")}"
    >
      <div class="slot-marker__inner">${CATEGORY_ICONS[slot.category] ?? "📦"}</div>
      ${slot.synthetic ? '<div class="slot-marker__badge">DEMO</div>' : ""}
    </div>
  `;

  return L.divIcon({
    html,
    className:   "",
    iconSize:    [36, 36],
    iconAnchor:  [18, 36],
    popupAnchor: [0, -40],
  });
}

// ─── India bounds ─────────────────────────────────────────────────────────────
/** Approximate bounding box for India — prevents scrolling to empty ocean */
const INDIA_BOUNDS = L.latLngBounds(
  [6.0,  68.0],   // SW: tip of Kanyakumari + west coast
  [37.5, 98.0],   // NE: Kashmir + Arunachal
);
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_ZOOM    = 5;
const INDIA_MIN_ZOOM = 4;

// ─── Auto-fit to slot bounds (fires once on first non-empty render) ───────────
function FitBounds({
  slots,
  fitted,
}: {
  slots: SlotEntity[];
  fitted: React.MutableRefObject<boolean>;
}): null {
  const map = useMap();
  useEffect(() => {
    if (fitted.current || slots.length === 0) return;
    const bounds = L.latLngBounds(slots.map((s) => [s.lat, s.lon]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
      fitted.current = true;
    }
  }, [map, slots, fitted]);
  return null;
}

// ─── Fly-to controller (fires when flyTarget changes) ─────────────────────────
function FlyController({
  target,
}: {
  target: [number, number] | null;
}): null {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, Math.max(map.getZoom(), 10), { duration: 0.8 });
  }, [map, target]);
  return null;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export interface MapViewProps {
  slots:       SlotEntity[];
  onSelectSlot: (slot: SlotEntity) => void;
  /** When set, map flies to this [lat, lon] */
  flyTarget?:  [number, number] | null;
}

export function MapView({ slots, onSelectSlot, flyTarget = null }: MapViewProps): React.ReactElement {
  const now    = useNow();
  const fitted = useRef(false);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={INDIA_ZOOM}
      minZoom={INDIA_MIN_ZOOM}
      maxZoom={19}
      maxBounds={INDIA_BOUNDS}
      maxBoundsViscosity={0.85}
      style={{ width: "100%", height: "100%", background: "#FBF7F0" }}
      zoomControl={true}
      attributionControl={true}
      id="leaflet-map"
    >
      {/*
        OpenStreetMap raster tiles — free, no API key, CC-BY-SA licence.
        Usage policy: https://operations.osmfoundation.org/policies/tiles/
        Tile provider: openstreetmap.org
        Tinting applied via CSS on .leaflet-tile-pane in index.css.
      */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
        crossOrigin="anonymous"
        errorTileUrl="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
      />

      <FitBounds slots={slots} fitted={fitted} />
      <FlyController target={flyTarget} />

      {/* Clustered slot markers */}
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={50}
        showCoverageOnHover={false}
      >
        {slots.map((slot) => {
          const icon = createSlotIcon(slot, now);
          return (
            <Marker
              key={slot.key}
              position={[slot.lat, slot.lon]}
              icon={icon}
              title={slot.title}
            >
              <Popup closeButton={false} className="slot-popup">
                <SlotCard slot={slot} onSelect={onSelectSlot} />
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
