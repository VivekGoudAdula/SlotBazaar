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
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { MarkerClusterGroup } from "./MarkerClusterGroup.js";

import type { SlotEntity, BookingEntity, ReputationResult } from "../lib/arkiv.js";
import { SlotCard } from "./SlotCard.js";
import { useNow } from "../hooks/useNow.js";
import { findNearestCluster } from "../lib/clusters.js";

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
 * Creates a DivIcon teardrop marker with category colour.
 * Adds vermilion pulse ring when < 15 min remain.
 * Adds hatched/dimmed style with "BOOKED" stamp for booked slots.
 */
function createSlotIcon(
  slot: SlotEntity,
  now: number,
  winningBooking?: BookingEntity,
  userAddress?: string | null
): L.DivIcon {
  const normUser = userAddress?.toLowerCase() ?? "";
  const isMine = Boolean(
    normUser &&
    (slot.creator.toLowerCase() === normUser || slot.owner.toLowerCase() === normUser)
  );
  const isBooked = Boolean(winningBooking);
  const isBookedByYou = Boolean(
    winningBooking && normUser && winningBooking.creator.toLowerCase() === normUser
  );

  const remaining  = slot.endsAt - now;
  const isCritical = remaining > 0 && remaining <= CRITICAL_SEC;
  const isExpired  = remaining <= 0;

  const baseColor  = isExpired
    ? "#9E9E9E"
    : CATEGORY_COLORS[slot.category] ?? "#1B1A17";

  const markerColor = isCritical ? "#E8452C" : baseColor;

  let extraClasses = "";
  if (isCritical) extraClasses += " slot-marker--pulse";
  if (isBooked) extraClasses += " slot-marker--booked";
  if (isBookedByYou) extraClasses += " slot-marker--booked-by-you";
  if (isMine) extraClasses += " slot-marker--mine";

  let stampHtml = "";
  if (isBookedByYou) {
    stampHtml = `<div class="slot-marker__stamp slot-marker__stamp--yours">YOU</div>`;
  } else if (isBooked) {
    stampHtml = `<div class="slot-marker__stamp">BOOKED</div>`;
  } else if (isMine) {
    stampHtml = `<div class="slot-marker__stamp" style="background:var(--c-marigold);color:var(--c-ink)">MINE</div>`;
  }

  const html = `
    <div
      class="slot-marker${extraClasses}"
      style="background:${markerColor};"
      title="${slot.title.replace(/"/g, "&quot;")}"
    >
      <div class="slot-marker__inner">${CATEGORY_ICONS[slot.category] ?? "📦"}</div>
      ${stampHtml}
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

/**
 * Creates custom "You Are Here" user location radar beacon icon.
 */
function createUserLocationIcon(): L.DivIcon {
  const html = `
    <div class="user-location-marker" title="You Are Here">
      <div class="user-location-radar"></div>
      <div class="user-location-dot"></div>
      <div class="user-location-tag">YOU ARE HERE</div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "user-location-div-icon",
    iconSize: [110, 42],
    iconAnchor: [55, 14],
    popupAnchor: [0, -20],
  });
}

// ─── India bounds ─────────────────────────────────────────────────────────────
/** Approximate bounding box for India — prevents scrolling to empty ocean */
const INDIA_BOUNDS = L.latLngBounds(
  [6.0,  68.0],   // SW: tip of Kanyakumari + west coast
  [37.5, 98.0],   // NE: Kashmir + Arunachal
);
const INDIA_CENTER: [number, number] = [22.5, 79.0];
const INDIA_ZOOM    = 5;
const INDIA_MIN_ZOOM = 4;

export interface UserLocationState {
  lat: number;
  lon: number;
  accuracy?: number;
}

// ─── Auto-fit to slot bounds (maxZoom 7 prevents village-level zoom) ──────────
function FitBounds({
  slots,
  fitted,
  userLocation,
}: {
  slots: SlotEntity[];
  fitted: React.MutableRefObject<boolean>;
  userLocation?: UserLocationState | null;
}): null {
  const map = useMap();
  useEffect(() => {
    // If user granted location, smoothly center to user's exact location on initial load
    if (userLocation && !fitted.current) {
      map.flyTo([userLocation.lat, userLocation.lon], 12, { duration: 1.2 });
      fitted.current = true;
      return;
    }
    if (slots.length === 0) {
      if (fitted.current) {
        map.setView(INDIA_CENTER, INDIA_ZOOM);
        fitted.current = false;
      }
      return;
    }
    if (!fitted.current) {
      const bounds = L.latLngBounds(slots.map((s) => [s.lat, s.lon]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 });
        fitted.current = true;
      }
    }
  }, [map, slots, fitted, userLocation]);
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
    map.flyTo(target, Math.max(map.getZoom(), 11), { duration: 0.9 });
  }, [map, target]);
  return null;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export interface MapViewProps {
  slots:       SlotEntity[];
  onSelectSlot: (slot: SlotEntity) => void;
  /** When set, map flies to this [lat, lon] */
  flyTarget?:  [number, number] | null;
  winningBookingsBySlot?: Map<string, BookingEntity>;
  reputationByAddress?: Map<string, ReputationResult>;
  userAddress?: string | null;
  userLocation?: UserLocationState | null;
  onRecenterUser?: () => void;
}

export function MapView({
  slots,
  onSelectSlot,
  flyTarget = null,
  winningBookingsBySlot,
  reputationByAddress,
  userAddress,
  userLocation = null,
  onRecenterUser,
}: MapViewProps): React.ReactElement {
  const now    = useNow();
  const fitted = useRef(false);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Recenter to My Location Button (shown once location is active) */}
      {userLocation && (
        <button
          type="button"
          className="map-locate-btn"
          id="recenter-my-location-btn"
          title="Center map on my location"
          onClick={onRecenterUser}
        >
          <span aria-hidden="true">📍</span>
          <span>My Location</span>
        </button>
      )}

      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lon] : INDIA_CENTER}
        zoom={userLocation ? 12 : INDIA_ZOOM}
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

        <FitBounds slots={slots} fitted={fitted} userLocation={userLocation} />
        <FlyController target={flyTarget} />

        {/* ─── YOU ARE HERE User Location Pin ─────────────────────── */}
        {userLocation && (
          <>
            {userLocation.accuracy && userLocation.accuracy > 0 && (
              <Circle
                center={[userLocation.lat, userLocation.lon]}
                radius={Math.min(userLocation.accuracy, 1500)}
                pathOptions={{
                  color: "#0F8B8D",
                  fillColor: "#0F8B8D",
                  fillOpacity: 0.12,
                  weight: 1.5,
                  dashArray: "4, 4",
                }}
              />
            )}

            <Marker
              position={[userLocation.lat, userLocation.lon]}
              icon={createUserLocationIcon()}
              zIndexOffset={1000}
            >
              <Popup className="slot-popup">
                <div style={{ padding: "12px 14px", minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: "1.1rem" }}>📍</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--c-ink)" }}>You Are Here</strong>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--c-ink)", opacity: 0.85, marginTop: 4 }}>
                    Exact GPS: <code>{userLocation.lat.toFixed(4)}°, {userLocation.lon.toFixed(4)}°</code>
                  </div>
                  {(() => {
                    const nearest = findNearestCluster(userLocation.lat, userLocation.lon);
                    return (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          marginTop: 6,
                          background: "var(--c-sand)",
                          padding: "4px 8px",
                          border: "1px solid var(--c-ink)",
                        }}
                      >
                        Nearest Hub: <strong>{nearest.label}</strong> ({nearest.state})
                      </div>
                    );
                  })()}
                  {userLocation.accuracy && (
                    <div style={{ fontSize: "0.72rem", opacity: 0.65, marginTop: 4 }}>
                      GPS Precision: ±{userLocation.accuracy}m
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Clustered slot markers */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          showCoverageOnHover={false}
        >
          {slots.map((slot) => {
            const sKeyNorm = slot.key.toLowerCase();
            const winningBooking = winningBookingsBySlot?.get(sKeyNorm);
            const sellerRep = reputationByAddress?.get(slot.creator.toLowerCase());
            const icon = createSlotIcon(slot, now, winningBooking, userAddress);

            return (
              <Marker
                key={slot.key}
                position={[slot.lat, slot.lon]}
                icon={icon}
                title={slot.title}
              >
                <Popup closeButton={false} className="slot-popup">
                  <SlotCard
                    slot={slot}
                    winningBooking={winningBooking}
                    sellerReputation={sellerRep}
                    userAddress={userAddress}
                    onSelect={onSelectSlot}
                  />
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

