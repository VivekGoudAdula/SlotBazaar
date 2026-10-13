/**
 * src/components/MapView.tsx
 *
 * Full-screen Leaflet map centred on India with custom slot markers.
 * Each marker:
 *   - Uses a colored teardrop icon (category × urgency coded)
 *   - Opens a mini SlotCard in a Leaflet Popup
 *   - Clicking "View Details" opens the SlotDrawer
 *
 * Read-only in Phase 2.
 */

import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { SlotEntity } from "../lib/arkiv.js";
import { getUrgency } from "../lib/time.js";
import { SlotCard } from "./SlotCard.js";
import { useNow } from "../hooks/useNow.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fix Leaflet's broken default icon paths (Vite doesn't inline them)
// ─────────────────────────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM MARKER ICON FACTORY
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  machine:   "#3B3F9E",   // Indigo
  transport: "#4E6B3D",   // Sage
  freelance: "#0F8B8D",   // Teal
};

const URGENCY_OVERRIDE: Record<string, string> = {
  critical: "#E8452C",  // Vermilion
  urgent:   "#F5A623",  // Marigold
};

const CATEGORY_ICONS: Record<string, string> = {
  machine:   "⚙",
  transport: "🚚",
  freelance: "💻",
};

/**
 * Creates a custom DivIcon teardrop marker for a slot.
 */
function createSlotIcon(slot: SlotEntity, urgency: string): L.DivIcon {
  const color = URGENCY_OVERRIDE[urgency] ?? CATEGORY_COLORS[slot.category] ?? "#1B1A17";
  const emoji = CATEGORY_ICONS[slot.category] ?? "📦";

  const html = `
    <div class="slot-marker slot-marker--${urgency === "critical" || urgency === "urgent" ? urgency : slot.category}"
         style="background:${color}; border-color:#1B1A17;"
         title="${slot.title}">
      <div class="slot-marker__inner">${emoji}</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "",
    iconSize:  [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP BOUNDS FITTER — fits to marker bounds when slots load
// ─────────────────────────────────────────────────────────────────────────────

interface FitBoundsProps {
  slots: SlotEntity[];
  fitted: React.MutableRefObject<boolean>;
}

function FitBounds({ slots, fitted }: FitBoundsProps): null {
  const map = useMap();

  useEffect(() => {
    if (fitted.current || slots.length === 0) return;

    const bounds = L.latLngBounds(slots.map((s) => [s.lat, s.lon]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 10 });
      fitted.current = true;
    }
  }, [map, slots, fitted]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

// India bounds for initial view
const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const INDIA_ZOOM = 5;

export interface MapViewProps {
  slots: SlotEntity[];
  onSelectSlot: (slot: SlotEntity) => void;
}

export function MapView({ slots, onSelectSlot }: MapViewProps): React.ReactElement {
  const now    = useNow();
  const fitted = useRef(false);

  // Reset fit when a new set of slots arrives for the first time
  useEffect(() => {
    if (slots.length > 0) {
      // Allow re-fit on first non-empty load only
    }
  }, [slots.length]);

  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={INDIA_ZOOM}
      style={{ width: "100%", height: "100%" }}
      zoomControl={true}
      attributionControl={false}
      id="leaflet-map"
    >
      {/* Carto Positron — clean, light, no roads noise */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      {/* Auto-fit bounds on first slot load */}
      <FitBounds slots={slots} fitted={fitted} />

      {/* Slot markers */}
      {slots.map((slot) => {
        const urgency = getUrgency(slot.endsAt, now);
        const icon    = createSlotIcon(slot, urgency);

        return (
          <Marker
            key={slot.key}
            position={[slot.lat, slot.lon]}
            icon={icon}
            title={slot.title}
          >
            <Popup
              closeButton={false}
              className="slot-popup"
            >
              <SlotCard
                slot={slot}
                onSelect={onSelectSlot}
              />
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
