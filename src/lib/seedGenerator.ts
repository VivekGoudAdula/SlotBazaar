/**
 * src/lib/seedGenerator.ts
 *
 * Shared synthetic slot generator used by both scripts/seed.ts and SeedModal.tsx.
 * Follows strict generation rules:
 * - Uses shared CLUSTERS list and fictional seller names only.
 * - Spreads clusters, categories ("machine", "transport", "freelance"), and price bands.
 * - Spreads durations: includes short (<15m), normal (1h-8h), and long (>24h up to 7d).
 * - Refuses any slot where ends_at is in the past.
 */

import { CLUSTERS } from "./clusters.js";
import type { PriceBand } from "./arkiv.js";

export type SeedCategory = "machine" | "transport" | "freelance";

export interface SeedTemplate {
  category: SeedCategory;
  priceBand: PriceBand;
  titleBase: string;
  description: string;
  sellerLabel: string;
}

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    category: "machine",
    priceBand: "low",
    titleBase: "CNC Lathe block",
    description: "5-axis CNC lathe for small batch runs. Min order 50 pcs. Coolant included.",
    sellerLabel: "PrecisionWorks SME",
  },
  {
    category: "transport",
    priceBand: "mid",
    titleBase: "Mini-truck 2T",
    description: "2-tonne pickup for intracity delivery. Driver included. Fuel extra.",
    sellerLabel: "FastMove Logistics",
  },
  {
    category: "freelance",
    priceBand: "high",
    titleBase: "React engineer sprint",
    description: "Senior React/TypeScript engineer. Available for focused product sprint.",
    sellerLabel: "IndieDevIndia",
  },
  {
    category: "machine",
    priceBand: "mid",
    titleBase: "3D Printer — Industrial PLA/ABS",
    description: "FDM printer, 300×300×400mm build volume. Rapid prototyping batch.",
    sellerLabel: "MakerSpace Pune",
  },
  {
    category: "transport",
    priceBand: "low",
    titleBase: "E-rickshaw city delivery",
    description: "Electric 3-wheeler for last-mile intracity parcels. Up to 300kg.",
    sellerLabel: "GreenHaul City",
  },
  {
    category: "freelance",
    priceBand: "mid",
    titleBase: "UI/UX Designer — 1 day",
    description: "Figma & design system sprint. Wireframing, components, and review.",
    sellerLabel: "PixelCraft Studio",
  },
  {
    category: "machine",
    priceBand: "high",
    titleBase: "Laser cutter 100W",
    description: "100W CO₂ laser for acrylic and sheet metal. Max 900×600mm. Operator included.",
    sellerLabel: "FabricationHub BLR",
  },
  {
    category: "transport",
    priceBand: "high",
    titleBase: "10T heavy interstate truck",
    description: "10-tonne closed container truck for interstate transit. GPS-tracked.",
    sellerLabel: "Shiva Transport Co.",
  },
  {
    category: "freelance",
    priceBand: "low",
    titleBase: "Catalog data validation",
    description: "SKU mapping, QA inspection, and inventory data hygiene. 5000 records/hr.",
    sellerLabel: "QuickData Works",
  },
  {
    category: "machine",
    priceBand: "low",
    titleBase: "MIG/TIG Welding station",
    description: "Hourly welding bay equipped with Argon gas and safety gear.",
    sellerLabel: "WeldMaster SME",
  },
];

export interface GeneratedSlot {
  cluster: string;
  clusterLabel: string;
  lat: number;
  lon: number;
  category: SeedCategory;
  priceBand: PriceBand;
  title: string;
  description: string;
  sellerLabel: string;
  startsAt: number;
  endsAt: number;
  durationHours: number;
  durationLabel: string;
  tier: "short" | "normal" | "long";
}

export interface SeedGeneratorOptions {
  count: number;
  nowSec?: number;
  includeLong?: boolean;
  maxHours?: number;
}

/**
 * Realistic geographic dispersion across industrial corridors (~4 to 22 km).
 * Uses polar coordinates to ensure uniform 2D distribution across regional manufacturing belts
 * instead of stacking multiple tasks on an artificial single point.
 */
function disperseCoordinates(centerLat: number, centerLon: number): { lat: number; lon: number } {
  const angle = Math.random() * 2 * Math.PI;
  // Radius between 0.035 and 0.16 degrees (~4km to 18km spread across industrial belts)
  const radiusDeg = 0.035 + Math.random() * 0.125;
  const dLat = radiusDeg * Math.cos(angle);
  const dLon = (radiusDeg * Math.sin(angle)) / Math.cos((centerLat * Math.PI) / 180);
  return {
    lat: Number((centerLat + dLat).toFixed(4)),
    lon: Number((centerLon + dLon).toFixed(4)),
  };
}

/** Format hours into readable string: 12m, 30m, 1h, 4h, 2.5d */
export function formatDurationLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 24) {
    const days = h / 24;
    return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
  }
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

/**
 * Generates synthetic slots adhering to SlotBazaar seed guidelines:
 * - Deterministically spreads across industrial clusters.
 * - Balances machine, transport, and freelance categories.
 * - Always injects slots under 15m (for fast testing) and some over 1 day when count >= 3.
 * - Refuses any computed slots that would expire in the past.
 */
export function generateSeedSlots(options: SeedGeneratorOptions): GeneratedSlot[] {
  const count = Math.max(1, Math.min(options.count, 50));
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const includeLong = options.includeLong ?? true;
  const maxHours = options.maxHours ?? 12;

  // Tier distributions based on requested count
  const tierPlan: { durationHours: number; tier: "short" | "normal" | "long" }[] = [];

  if (count === 1) {
    tierPlan.push({ durationHours: 0.2, tier: "short" }); // 12 min
  } else if (count <= 3) {
    tierPlan.push({ durationHours: 0.2, tier: "short" }); // 12 min
    tierPlan.push({ durationHours: 2, tier: "normal" });
    if (includeLong) {
      tierPlan.push({ durationHours: 36, tier: "long" }); // 1.5 days
    } else {
      tierPlan.push({ durationHours: 4, tier: "normal" });
    }
  } else if (count <= 6) {
    tierPlan.push({ durationHours: 0.15, tier: "short" }); // ~9 min
    tierPlan.push({ durationHours: 0.5, tier: "short" });  // 30 min
    tierPlan.push({ durationHours: 2, tier: "normal" });
    tierPlan.push({ durationHours: 6, tier: "normal" });
    tierPlan.push({ durationHours: 48, tier: "long" });    // 2 days
    tierPlan.push({ durationHours: 168, tier: "long" });   // 7 days
  } else {
    // Large batch (e.g. 10 to 40)
    tierPlan.push({ durationHours: 0.15, tier: "short" }); // 9m
    tierPlan.push({ durationHours: 0.2, tier: "short" });  // 12m
    tierPlan.push({ durationHours: 0.5, tier: "short" });  // 30m
    tierPlan.push({ durationHours: 0.75, tier: "short" }); // 45m
    tierPlan.push({ durationHours: 1.0, tier: "short" });  // 1h

    if (includeLong) {
      tierPlan.push({ durationHours: 24, tier: "long" });   // 1 day
      tierPlan.push({ durationHours: 48, tier: "long" });   // 2 days
      tierPlan.push({ durationHours: 72, tier: "long" });   // 3 days
      tierPlan.push({ durationHours: 168, tier: "long" });  // 7 days
    }

    const remaining = count - tierPlan.length;
    for (let i = 0; i < remaining; i++) {
      const dur = 1 + (i % maxHours);
      tierPlan.push({ durationHours: dur, tier: "normal" });
    }
  }

  // Randomize cluster order across all available Indian manufacturing hubs
  const availableClusters = [...CLUSTERS].sort(() => Math.random() - 0.5);

  const results: GeneratedSlot[] = [];

  for (let idx = 0; idx < count; idx++) {
    const spec = tierPlan[idx % tierPlan.length];
    const template = SEED_TEMPLATES[idx % SEED_TEMPLATES.length];
    const cluster = availableClusters[idx % availableClusters.length];

    // Starts between 1 and 10 minutes in the future
    const startDelaySec = 60 + (idx * 30);
    const startsAt = now + startDelaySec;
    const durationSec = Math.round(spec.durationHours * 3600);
    const endsAt = startsAt + durationSec;

    // Safety guard: refuse past expiry
    if (endsAt <= now) continue;

    const { lat, lon } = disperseCoordinates(cluster.lat, cluster.lon);
    const durationLabel = formatDurationLabel(spec.durationHours);
    const title = `[${cluster.label.toUpperCase()}] ${template.titleBase} (${durationLabel})`;

    results.push({
      cluster: cluster.name,
      clusterLabel: cluster.label,
      lat,
      lon,
      category: template.category,
      priceBand: template.priceBand,
      title,
      description: template.description,
      sellerLabel: template.sellerLabel,
      startsAt,
      endsAt,
      durationHours: spec.durationHours,
      durationLabel,
      tier: spec.tier,
    });
  }

  return results;
}
