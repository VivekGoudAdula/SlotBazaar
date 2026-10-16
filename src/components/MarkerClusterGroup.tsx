/**
 * src/components/MarkerClusterGroup.tsx
 *
 * React-Leaflet v5 (React 19) compatible MarkerClusterGroup container.
 * Uses Leaflet's standard `leaflet.markercluster` plugin directly via
 * `@react-leaflet/core`'s `createLayerComponent`.
 */

import type React from "react";
import L from "leaflet";
import {
  createLayerComponent,
  createElementObject,
  extendContext,
} from "@react-leaflet/core";

// Ensure global L exists in browser environment before leaflet.markercluster loads
if (typeof window !== "undefined" && !(window as unknown as { L?: typeof L }).L) {
  (window as unknown as { L: typeof L }).L = L;
}

import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

export interface MarkerClusterGroupProps extends L.MarkerClusterGroupOptions {
  children?: React.ReactNode;
}

export const MarkerClusterGroup = createLayerComponent<
  L.MarkerClusterGroup,
  MarkerClusterGroupProps
>((props, context) => {
  const { children: _children, ...options } = props;
  const clusterInstance: L.MarkerClusterGroup = L.markerClusterGroup({
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: false, // Handled smartly below to spiderfy same-location clusters at any zoom
    spiderfyDistanceMultiplier: 1.5,
    maxClusterRadius: 35,
    ...options,
  });

  // Smart cluster click: if markers are at the same or near-identical coordinates,
  // spiderfy immediately instead of requiring zooming all the way to maxZoom 19.
  clusterInstance.on("clusterclick", (e: L.LeafletEvent) => {
    const cluster = (e as unknown as { layer: L.MarkerCluster }).layer;
    if (!cluster) return;
    const bounds = cluster.getBounds();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const latDiff = Math.abs(ne.lat - sw.lat);
    const lonDiff = Math.abs(ne.lng - sw.lng);

    if (latDiff < 0.001 && lonDiff < 0.001) {
      cluster.spiderfy();
    } else {
      cluster.zoomToBounds();
    }
  });

  return createElementObject(
    clusterInstance,
    extendContext(context, { layerContainer: clusterInstance })
  );
});
