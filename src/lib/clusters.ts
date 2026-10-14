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
  {
    id: "indore",
    name: "indore",
    label: "Indore",
    lat: 22.7196,
    lon: 75.8577,
    state: "Madhya Pradesh",
    industry: "Auto Ancillaries & Pharma SEZ (Pithampur)",
  },
  {
    id: "bhopal",
    name: "bhopal",
    label: "Bhopal",
    lat: 23.2599,
    lon: 77.4126,
    state: "Madhya Pradesh",
    industry: "Heavy Electricals & Industrial Fabrication (Mandideep)",
  },
  {
    id: "kanpur",
    name: "kanpur",
    label: "Kanpur",
    lat: 26.4499,
    lon: 80.3319,
    state: "Uttar Pradesh",
    industry: "Defence Components & Precision Machine Tooling",
  },
  {
    id: "nashik",
    name: "nashik",
    label: "Nashik",
    lat: 19.9975,
    lon: 73.7898,
    state: "Maharashtra",
    industry: "Automotive Assembly & Electrical Engineering (Ambad)",
  },
  {
    id: "aurangabad",
    name: "aurangabad",
    label: "Aurangabad",
    lat: 19.8762,
    lon: 75.3433,
    state: "Maharashtra",
    industry: "Auto Components & Tooling Corridors (Shendra)",
  },
  {
    id: "nagpur",
    name: "nagpur",
    label: "Nagpur",
    lat: 21.1458,
    lon: 79.0882,
    state: "Maharashtra",
    industry: "Multimodal Logistics Hub & Heavy Metallurgy (Butibori)",
  },
  {
    id: "bhubaneswar",
    name: "bhubaneswar",
    label: "Bhubaneswar",
    lat: 20.2961,
    lon: 85.8245,
    state: "Odisha",
    industry: "Metals Processing & Freight Engineering",
  },
  {
    id: "jamshedpur",
    name: "jamshedpur",
    label: "Jamshedpur",
    lat: 22.8046,
    lon: 86.2029,
    state: "Jharkhand",
    industry: "Steel Fabrication & Heavy Truck Components",
  },
  {
    id: "visakhapatnam",
    name: "visakhapatnam",
    label: "Visakhapatnam",
    lat: 17.6868,
    lon: 83.2185,
    state: "Andhra Pradesh",
    industry: "Port Freight Transit & Heavy Marine Engineering",
  },
  {
    id: "kochi",
    name: "kochi",
    label: "Kochi",
    lat: 9.9312,
    lon: 76.2673,
    state: "Kerala",
    industry: "Marine Logistics & Industrial Electronics",
  },
  {
    id: "vadodara",
    name: "vadodara",
    label: "Vadodara",
    lat: 22.3072,
    lon: 73.1812,
    state: "Gujarat",
    industry: "Power Transmission & Heavy Polymers (Makarpura)",
  },
  {
    id: "chandigarh",
    name: "chandigarh",
    label: "Chandigarh",
    lat: 30.7333,
    lon: 76.7794,
    state: "Punjab",
    industry: "Pharma Formulations & Precision Light Engineering (Baddi)",
  },
];

export const CLUSTER_NAMES = CLUSTERS.map((c) => c.name);

export function getClusterById(id: string): ClusterDef | undefined {
  const norm = id.toLowerCase().trim();
  return CLUSTERS.find((c) => c.id === norm || c.name === norm || c.label.toLowerCase() === norm);
}

/**
 * Calculates great-circle distance between two coordinates in kilometers (Haversine formula).
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c; // Earth radius in km
}

/**
 * Finds the nearest industrial cluster to the given GPS coordinates.
 */
export function findNearestCluster(lat: number, lon: number): ClusterDef {
  if (CLUSTERS.length === 0) {
    throw new Error("No clusters available");
  }
  let closest = CLUSTERS[0];
  let minDistance = Infinity;

  for (const cluster of CLUSTERS) {
    const d = getDistanceKm(lat, lon, cluster.lat, cluster.lon);
    if (d < minDistance) {
      minDistance = d;
      closest = cluster;
    }
  }

  return closest;
}

