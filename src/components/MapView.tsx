/**
 * src/components/MapView.tsx
 *
 * Full-screen Leaflet map centred on India with custom slot markers.
 * Features:
 *  - Marker clustering (react-leaflet-markercluster)
 *  - Category × urgency color-coded teardrop markers
 *  - Vermilion pulse animation for slots < 15 min remaining
 *  - SlotCard mini popup on click
 *  - Auto-fits to slot bounds on first load
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

// ─────────────────────────────────────────────────────────────────────────────
// Fix Leaflet default icon paths (broken under Vite)
// ─────────────────────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─────────────────────────────────────────────────────────────────────────────
// COLOR MAP
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  machine:   "#3B3F9E",
  transport: "#4E6B3D",
  freelance: "#0F8B8D",
};

const CATEGORY_ICONS: Record<string, string> = {
  machine:   "⚙",
  transport: "🚚",
  freelance: "💻",
};

/** 15-minute threshold triggers vermilion pulse */
const CRITICAL_SEC  = 15 * 60;
const URGENT_SEC    = 30 * 60;

/**
 * Creates a DivIcon teardrop marker.
 * Adds `slot-marker--pulse` class for the <15min case.
 */
function createSlotIcon(slot: SlotEntity, now: number): L.DivIcon {
  const remaining = slot.endsAt - now;
  let color: string;
  let extraClass = "";

  if (remaining <= 0) {
    color = "#6B7C61";
  } else if (remaining <= CRITICAL_SEC) {
    color = "#E8452C";
    extraClass = "slot-marker--pulse";
  } else if (remaining <= URGENT_SEC) {
    color = "#F5A623";
    extraClass = "slot-marker--urgent";
  } else {
    color = CATEGORY_COLORS[slot.category] ?? "#1B1A17";
  }

  const emoji = CATEGORY_ICONS[slot.category] ?? "📦";
  const isSynthetic = slot.synthetic;

  const html = `
    <div
      class="slot-marker ${extraClass}"
      style="background:${color};"
      title="${slot.title}"
    >
      <div class="slot-marker__inner">${emoji}</div>
      ${isSynthetic ? '<div class="slot-marker__badge">DEMO</div>' : ""}
    </div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize:   [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -40],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-FIT BOUNDS
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_ZOOM = 5;

export interface MapViewProps {
  slots: SlotEntity[];
  onSelectSlot: (slot: SlotEntity) => void;
}

export function MapView({ slots, onSelectSlot }: MapViewProps): React.ReactElement {
  const now    = useNow();
  const fitted = useRef(false);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={INDIA_ZOOM}
      style={{ width: "100%", height: "100%" }}
      zoomControl={true}
      attributionControl={false}
      id="leaflet-map"
    >
      {/* Carto Positron tiles — clean light base */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      <FitBounds slots={slots} fitted={fitted} />

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
