/**
 * src/lib/clusters.ts
 *
 * Single source of truth for Indian industrial cluster definitions:
 * Used across seed scripts, post slot modal, map view, and filter bar.
 */

export interface ClusterDef {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  state: string;
  industry: string;
}

export const CLUSTERS: ClusterDef[] = [
  // Primary Seed & Manufacturing Hubs (Phase 4 Specification)
  {
    id: "surat",
    name: "surat",
    label: "Surat",
    lat: 21.1702,
    lon: 72.8311,
    state: "Gujarat",
    industry: "Textiles & Diamond Precision",
  },
  {
    id: "tiruppur",
    name: "tiruppur",
    label: "Tiruppur",
    lat: 11.1085,
    lon: 77.3411,
    state: "Tamil Nadu",
    industry: "Knitwear & Apparel Machinery",
  },
  {
    id: "morbi",
    name: "morbi",
    label: "Morbi",
    lat: 22.8173,
    lon: 70.8370,
    state: "Gujarat",
    industry: "Ceramic Tile & Kiln Capacity",
  },
  {
    id: "ludhiana",
    name: "ludhiana",
    label: "Ludhiana",
    lat: 30.9010,
    lon: 75.8573,
    state: "Punjab",
    industry: "Auto Parts & Precision Machine Tools",
  },
  {
    id: "jeedimetla",
    name: "jeedimetla",
    label: "Jeedimetla (Hyderabad)",
    lat: 17.5190,
    lon: 78.4480,
    state: "Telangana",
    industry: "Industrial Fabrication & Chemical Processing",
  },
  {
    id: "coimbatore",
    name: "coimbatore",
    label: "Coimbatore",
    lat: 11.0168,
    lon: 76.9558,
    state: "Tamil Nadu",
    industry: "Pumps, Motors & Foundry Castings",
  },
  {
    id: "pune",
    name: "pune",
    label: "Pune",
    lat: 18.5204,
    lon: 73.8567,
    state: "Maharashtra",
    industry: "Automotive & Heavy Forging",
  },
  {
    id: "rajkot",
    name: "rajkot",
    label: "Rajkot",
    lat: 22.3039,
    lon: 70.8022,
    state: "Gujarat",
    industry: "Diesel Engines & CNC Workshops",
  },
  {
    id: "mumbai",
    name: "mumbai",
    label: "Mumbai",
    lat: 19.0760,
    lon: 72.8777,
    state: "Maharashtra",
    industry: "Port Logistics & Freight Forwarding",
  },
  {
    id: "bengaluru",
    name: "bengaluru",
    label: "Bengaluru",
    lat: 12.9716,
    lon: 77.5946,
    state: "Karnataka",
    industry: "Aerospace Machining & Embedded Dev Sprints",
  },

  // Supporting Major Regional Industrial Clusters
  {
    id: "delhi",
    name: "delhi",
    label: "Delhi NCR",
    lat: 28.6139,
    lon: 77.2090,
    state: "Delhi",
    industry: "Multi-modal Transport & Light Assembly",
  },
  {
    id: "jaipur",
    name: "jaipur",
    label: "Jaipur",
    lat: 26.9124,
    lon: 75.7873,
    state: "Rajasthan",
    industry: "Handicraft Workshops & Gemstone Cutting",
  },
  {
    id: "kolkata",
    name: "kolkata",
    label: "Kolkata",
    lat: 22.5726,
    lon: 88.3639,
    state: "West Bengal",
    industry: "Jute Mills & Heavy Engineering",
  },
  {
    id: "chennai",
    name: "chennai",
    label: "Chennai",
    lat: 13.0827,
    lon: 80.2707,
    state: "Tamil Nadu",
    industry: "Automobile Corridors & Port Transit",
  },
  {
    id: "ahmedabad",
    name: "ahmedabad",
    label: "Ahmedabad",
    lat: 23.0225,
    lon: 72.5714,
    state: "Gujarat",
    industry: "Chemical Engineering & Cotton Spinning",
  },
  {
    id: "lucknow",
    name: "lucknow",
    label: "Lucknow",
    lat: 26.8467,
    lon: 80.9462,
    state: "Uttar Pradesh",
    industry: "Chikan Handloom & Agricultural Logistics",
  },
];

export const CLUSTER_NAMES = CLUSTERS.map((c) => c.name);

export function getClusterById(id: string): ClusterDef | undefined {
  const norm = id.toLowerCase().trim();
  return CLUSTERS.find((c) => c.id === norm || c.name === norm || c.label.toLowerCase() === norm);
}
