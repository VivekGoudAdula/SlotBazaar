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
  const clusterInstance: L.MarkerClusterGroup = L.markerClusterGroup(options);
  return createElementObject(
    clusterInstance,
    extendContext(context, { layerContainer: clusterInstance })
  );
});
