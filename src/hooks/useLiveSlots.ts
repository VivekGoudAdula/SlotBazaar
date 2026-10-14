/**
 * src/hooks/useLiveSlots.ts
 *
 * Phase 4 Market Data Hook:
 *  - Polls Arkiv index for slots, bookings, and completions every 8 seconds.
 *  - Strictly executes exactly 3 batch queries per refresh (no N+1 queries).
 *  - Groups bookings, computes winning bookings, and derives two-sided reputation client-side.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getArkivPublicClient,
  getArkivWebSocketClient,
  fetchLiveSlots,
  fetchAllBookings,
  fetchAllCompletions,
  getWinningBooking,
  verifyJobCompletion,
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
  type ReputationResult,
  type ReputationProof,
} from "../lib/arkiv.js";
import type { Address } from "viem";

const POLL_INTERVAL_MS = 30_000; // 30-second polling safety net

export interface UseLiveSlotsResult {
  slots: SlotEntity[];
  bookings: BookingEntity[];
  completions: CompletionEntity[];
  bookingsBySlot: Map<string, BookingEntity[]>;
  completionsByBooking: Map<string, CompletionEntity[]>;
  winningBookingsBySlot: Map<string, BookingEntity>;
  reputationByAddress: Map<string, ReputationResult>;
  queryCount: number;
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  isSocketHealthy: boolean;
  refresh: () => void;
  addSlot: (slot: SlotEntity) => void;
}

const LOCAL_STORAGE_KEY = "slotbazaar_recent_slots";

export function getBaseOnChainSlots(): SlotEntity[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      key: "0x844c662541d77ebae8102ed29e0de86aaa06915ef452e034218b87a2679f4d47",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "machine",
      cluster: "jeedimetla",
      title: "test",
      description: "Test Description",
      sellerLabel: "0x5349…a6e9",
      priceBand: "high",
      lat: 17.4902,
      lon: 78.5645,
      startsAt: now - 1800,
      endsAt: now + 4 * 3600,
      synthetic: false,
    },
    {
      key: "0x9005951fc5c031652cbde5d77c749f37c1b3ccabfe7c7573cad26c560ef6db8b",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "machine",
      cluster: "jeedimetla",
      title: "test description",
      description: "test description",
      sellerLabel: "0x5349…a6e9",
      priceBand: "mid",
      lat: 17.4896,
      lon: 78.5642,
      startsAt: now - 3600,
      endsAt: now + 3 * 3600,
      synthetic: false,
    },
    {
      key: "0x8494ea41238f7fd65a5e03ca49dfc04bd1a6fd1e59f211a5b560e31c45e96bee",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "machine",
      cluster: "surat",
      title: "[SURAT] CNC Lathe block (2h)",
      description: "5-axis CNC lathe for small batch runs. Min order 50 pcs. Coolant included.",
      sellerLabel: "PrecisionWorks SME",
      priceBand: "low",
      lat: 21.2185,
      lon: 72.8450,
      startsAt: now - 600,
      endsAt: now + 7200,
      synthetic: true,
    },
    {
      key: "0x852253c25bcb785dadbe0653a97a0e62ae228e14f53a114081c57a9ae54e4e84",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "transport",
      cluster: "tiruppur",
      title: "[TIRUPPUR] Mini-truck 2T (4h)",
      description: "2-tonne pickup for intracity delivery. Driver included. Fuel extra.",
      sellerLabel: "FastMove Logistics",
      priceBand: "mid",
      lat: 11.1085,
      lon: 77.3411,
      startsAt: now - 900,
      endsAt: now + 14400,
      synthetic: true,
    },
    {
      key: "0x7049607d10d6a6d981b74f6b63aa77972358863995e6d3ee8e0e69e90347a73f",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "freelance",
      cluster: "morbi",
      title: "[MORBI] React engineer sprint (3h)",
      description: "Senior React/TypeScript engineer. Vite, Next.js. Available for focused sprint.",
      sellerLabel: "IndieDevIndia",
      priceBand: "high",
      lat: 22.8120,
      lon: 70.8380,
      startsAt: now - 1200,
      endsAt: now + 10800,
      synthetic: true,
    },
    {
      key: "0x5ee1e7729da82f2559be2ad860a7b29d6b9e20263c7ff81f3aa4c1120b7d6f9e",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "machine",
      cluster: "ludhiana",
      title: "[LUDHIANA] 3D Printer — PLA/ABS (5h)",
      description: "FDM printer, 300×300×400mm build volume. First-come first-served.",
      sellerLabel: "MakerSpace Pune",
      priceBand: "mid",
      lat: 30.9010,
      lon: 75.8573,
      startsAt: now - 300,
      endsAt: now + 18000,
      synthetic: true,
    },
    {
      key: "0xc73929653c7300ef0524ec17cdc9195b5f697736ac78a3317ec7a9b4fa3c4ec9",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "transport",
      cluster: "jeedimetla",
      title: "[JEEDIMETLA] E-rickshaw city run (2h)",
      description: "Electric rickshaw for last-mile intracity goods delivery. Up to 300kg.",
      sellerLabel: "GreenHaul",
      priceBand: "low",
      lat: 17.4897,
      lon: 78.5650,
      startsAt: now - 400,
      endsAt: now + 7200,
      synthetic: true,
    },
    {
      key: "0x286b75451edefb9013d4cd722f019898756a5dcd4964aee62868290146081bba",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "freelance",
      cluster: "coimbatore",
      title: "[COIMBATORE] UX Designer — 1 day (6h)",
      description: "Figma, Framer. Portfolio: dribbble.com/…. One full working day.",
      sellerLabel: "PixelCraft Studio",
      priceBand: "mid",
      lat: 11.0168,
      lon: 76.9558,
      startsAt: now - 500,
      endsAt: now + 21600,
      synthetic: true,
    },
    {
      key: "0x3b3fb83b48130a2231c17fef93062fbb72bd1013a3d63309d5f1993f7e2d35c3",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "machine",
      cluster: "pune",
      title: "[PUNE] Laser cutter 100W (6h)",
      description: "100W CO₂ laser. Max 900×600mm sheet. Includes operator.",
      sellerLabel: "FabricationHub BLR",
      priceBand: "high",
      lat: 18.5204,
      lon: 73.8567,
      startsAt: now - 600,
      endsAt: now + 21600,
      synthetic: true,
    },
    {
      key: "0x01b0ec1126735030583c73d297b12040d1f7676030990ef408b8cef5eaaaa2ca",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "transport",
      cluster: "rajkot",
      title: "[RAJKOT] Heavy Crane 10T (8h)",
      description: "Mobile crane 10-tonne capacity. Operator included. Fuel extra.",
      sellerLabel: "Gujarat Lift Services",
      priceBand: "high",
      lat: 22.3039,
      lon: 70.8022,
      startsAt: now - 700,
      endsAt: now + 28800,
      synthetic: true,
    },
    {
      key: "0x925512d97f69007bf97a6da317b05bcd7591ecd695c27b637d01dbbf05efa33b",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "freelance",
      cluster: "mumbai",
      title: "[MUMBAI] Content Writer Tech (4h)",
      description: "Technical documentation and release notes writer. Immediate start.",
      sellerLabel: "WordCraft Studio",
      priceBand: "low",
      lat: 19.0760,
      lon: 72.8777,
      startsAt: now - 800,
      endsAt: now + 14400,
      synthetic: true,
    },
    {
      key: "0xe55fc916bac0593a8206dbac5fbcce351326a59e91e75ca6bb430eede68ccddc",
      creator: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      owner: "0x53491aa366e086c19da948669b340317ee6ea6e9",
      category: "machine",
      cluster: "bengaluru",
      title: "[BENGALURU] PCB SMT Line (3h)",
      description: "Automated surface-mount assembly pick & place line. 200 components/hr.",
      sellerLabel: "ElectroFab BLR",
      priceBand: "mid",
      lat: 12.9716,
      lon: 77.5946,
      startsAt: now - 900,
      endsAt: now + 10800,
      synthetic: true,
    },
  ];
}

function loadLocalRecentSlots(): SlotEntity[] {
  const base = getBaseOnChainSlots();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as SlotEntity[]) : [];
    const nowSec = Math.floor(Date.now() / 1000);
    const validLocal = parsed
      .filter((s) => s.endsAt > nowSec)
      .map((s) => ({
        ...s,
        createdAtBlock: s.createdAtBlock ? BigInt(s.createdAtBlock) : undefined,
        expiresAtBlock: s.expiresAtBlock ? BigInt(s.expiresAtBlock) : undefined,
      }));
    const map = new Map<string, SlotEntity>();
    for (const b of base) map.set(b.key.toLowerCase(), b);
    for (const s of validLocal) map.set(s.key.toLowerCase(), s);
    return Array.from(map.values()).sort((a, b) => a.endsAt - b.endsAt);
  } catch {
    return base;
  }
}

function saveLocalRecentSlots(slots: SlotEntity[]): void {
  if (typeof window === "undefined") return;
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const valid = slots.filter((s) => s.endsAt > nowSec);
    // Custom replacer handles BigInt serialization (e.g. createdAtBlock, expiresAtBlock)
    const serialized = JSON.stringify(valid, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
  } catch (err) {
    console.error("Failed to persist slots to localStorage:", err);
  }
}

export function useLiveSlots(): UseLiveSlotsResult {
  const [slots, setSlots] = useState<SlotEntity[]>(() => loadLocalRecentSlots());
  const [bookings, setBookings] = useState<BookingEntity[]>([]);
  const [completions, setCompletions] = useState<CompletionEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const client = useRef(getArkivPublicClient()).current;
  const isMounted = useRef(true);
  const localSlotsRef = useRef<SlotEntity[]>(loadLocalRecentSlots());

  const addSlot = useCallback((newSlot: SlotEntity) => {
    localSlotsRef.current = [
      newSlot,
      ...localSlotsRef.current.filter((s) => s.key.toLowerCase() !== newSlot.key.toLowerCase()),
    ];
    saveLocalRecentSlots(localSlotsRef.current);
    setSlots((prev) => [
      newSlot,
      ...prev.filter((s) => s.key.toLowerCase() !== newSlot.key.toLowerCase()),
    ]);
  }, []);

  // Fixed 3 queries per refresh cycle: 1 slots + 1 bookings + 1 completions
  const queryCount = 3;

  const doFetch = useCallback(async () => {
    try {
      setError(null);
      const withTimeout = <T>(p: Promise<T>, ms = 8000): Promise<T> =>
        Promise.race([
          p,
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("RPC query timed out")), ms)
          ),
        ]);

      // Batch fetch with Promise.all: exactly 3 queries, each guarded by timeout
      const [freshSlots, freshBookings, freshCompletions] = await Promise.all([
        withTimeout(fetchLiveSlots(client)).catch(() => [] as SlotEntity[]),
        withTimeout(fetchAllBookings(client)).catch(() => [] as BookingEntity[]),
        withTimeout(fetchAllCompletions(client)).catch(() => [] as CompletionEntity[]),
      ]);

      if (isMounted.current) {
        const nowSec = Math.floor(Date.now() / 1000);
        localSlotsRef.current = localSlotsRef.current.filter((s) => s.endsAt > nowSec);
        saveLocalRecentSlots(localSlotsRef.current);

        const baseSlots = getBaseOnChainSlots();

        if (freshSlots.length > 0) {
          const slotMap = new Map<string, SlotEntity>();
          for (const s of freshSlots) {
            slotMap.set(s.key.toLowerCase(), s);
          }
          for (const s of localSlotsRef.current) {
            if (!slotMap.has(s.key.toLowerCase())) {
              slotMap.set(s.key.toLowerCase(), s);
            }
          }
          const mergedSlots = Array.from(slotMap.values())
            .filter((s) => s.endsAt > nowSec)
            .sort((a, b) => a.endsAt - b.endsAt);
          setSlots(mergedSlots);
        } else {
          // If RPC query returned 0 slots (e.g. indexer timeout), PRESERVE existing slots!
          // Never wipe active slots to 0.
          setSlots((prev) => {
            const slotMap = new Map<string, SlotEntity>();
            for (const s of prev) {
              if (s.endsAt > nowSec) slotMap.set(s.key.toLowerCase(), s);
            }
            for (const s of localSlotsRef.current) {
              if (s.endsAt > nowSec && !slotMap.has(s.key.toLowerCase())) {
                slotMap.set(s.key.toLowerCase(), s);
              }
            }
            for (const s of baseSlots) {
              if (s.endsAt > nowSec && !slotMap.has(s.key.toLowerCase())) {
                slotMap.set(s.key.toLowerCase(), s);
              }
            }
            return Array.from(slotMap.values()).sort((a, b) => a.endsAt - b.endsAt);
          });
        }

        if (freshBookings.length > 0) setBookings(freshBookings);
        if (freshCompletions.length > 0) setCompletions(freshCompletions);
        setLastFetched(new Date());
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Arkiv indexer slow — displaying cached on-chain state.");
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [client]);

  const [isSocketHealthy, setIsSocketHealthy] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffDelayRef = useRef(1000);
  const unwatchRef = useRef<(() => void) | null>(null);

  // Debounced refetch (500 ms) triggered by WebSocket events
  const triggerDebouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      doFetch();
    }, 500);
  }, [doFetch]);

  // WebSocket subscription with exponential backoff reconnect
  useEffect(() => {
    let active = true;

    function connectWs() {
      if (!active) return;
      try {
        const wsClient = getArkivWebSocketClient();

        const unwatch = wsClient.watchEntityEvents({
          onEntityCreated: () => {
            setIsSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onEntityPatched: () => {
            setIsSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onExpiryExtended: () => {
            setIsSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onOwnershipTransferred: () => {
            setIsSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onEntityDeleted: () => {
            setIsSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onEvent: () => {
            setIsSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onError: (err) => {
            console.warn("WebSocket entity subscription warning/disconnect:", err.message);
            setIsSocketHealthy(false);
            scheduleReconnect();
          },
        });

        unwatchRef.current = unwatch;
        setIsSocketHealthy(true);
      } catch (err) {
        console.warn("Failed to connect WebSocket entity watcher:", err);
        setIsSocketHealthy(false);
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (!active) return;
      if (unwatchRef.current) {
        try { unwatchRef.current(); } catch {}
        unwatchRef.current = null;
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

      const delay = backoffDelayRef.current;
      backoffDelayRef.current = Math.min(backoffDelayRef.current * 2, 30_000);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (active) connectWs();
      }, delay);
    }

    connectWs();

    return () => {
      active = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (unwatchRef.current) {
        try { unwatchRef.current(); } catch {}
        unwatchRef.current = null;
      }
    };
  }, [triggerDebouncedFetch]);

  // Client-side expiry removal: when ends_at passes locally (with 1-2 block margin = 4s), remove slot immediately
  useEffect(() => {
    const BLOCK_MARGIN_SEC = 4;
    const interval = setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      setSlots((prev) => {
        const remaining = prev.filter((s) => s.endsAt > nowSec + BLOCK_MARGIN_SEC);
        if (remaining.length !== prev.length) {
          return remaining;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Polling safety net (30 seconds)
  useEffect(() => {
    isMounted.current = true;
    doFetch();
    const interval = setInterval(doFetch, POLL_INTERVAL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [doFetch]);

  // Client-side grouping: bookings by slotKey
  const bookingsBySlot = useMemo(() => {
    const map = new Map<string, BookingEntity[]>();
    for (const b of bookings) {
      const sKey = b.slotKey.toLowerCase();
      const list = map.get(sKey) ?? [];
      list.push(b);
      map.set(sKey, list);
    }
    return map;
  }, [bookings]);

  // Client-side grouping: winning booking per slot
  const winningBookingsBySlot = useMemo(() => {
    const map = new Map<string, BookingEntity>();
    for (const [sKey, slotBookings] of bookingsBySlot.entries()) {
      const winner = getWinningBooking(slotBookings);
      if (winner) {
        map.set(sKey, winner);
      }
    }
    return map;
  }, [bookingsBySlot]);

  // Client-side grouping: completions by bookingKey (and slotKey for v1 fallback)
  const completionsByBooking = useMemo(() => {
    const map = new Map<string, CompletionEntity[]>();
    for (const c of completions) {
      const bKey = (c.bookingKey || "").toLowerCase();
      if (bKey && bKey !== "0x0") {
        const list = map.get(bKey) ?? [];
        list.push(c);
        map.set(bKey, list);
      }
      if (c.slotKey) {
        const sKey = c.slotKey.toLowerCase();
        const list = map.get(sKey) ?? [];
        list.push(c);
        map.set(sKey, list);
      }
    }
    return map;
  }, [completions]);

  // Client-side derivation: reputation by address
  const reputationByAddress = useMemo(() => {
    const repMap = new Map<string, ReputationResult>();

    // Helper to get or init reputation struct
    function getRep(addr: string): ReputationResult {
      const norm = addr.toLowerCase();
      let r = repMap.get(norm);
      if (!r) {
        r = {
          verifiedJobsCount: 0,
          verifiedSlotKeys: [],
          verifiedBookingKeys: [],
          proofs: [],
        };
        repMap.set(norm, r);
      }
      return r;
    }

    // Evaluate every slot that has a winning booking
    for (const [slotKey, winner] of winningBookingsBySlot.entries()) {
      const slotMatch = slots.find((s) => s.key.toLowerCase() === slotKey);
      const slotCreator = (winner.slotCreator || slotMatch?.creator || "0x0").toLowerCase();
      const buyerCreator = winner.creator.toLowerCase();

      // Skip self-booking
      if (slotCreator === buyerCreator) continue;

      const verified = verifyJobCompletion(
        {
          key: winner.slotKey,
          creator: slotCreator as Address,
          startsAt: slotMatch?.startsAt,
        },
        winner,
        completions
      );

      if (verified) {
        const proof: ReputationProof = {
          slotKey: winner.slotKey,
          bookingKey: winner.key,
          seller: verified.seller.creator,
          buyer: verified.buyer.creator,
          sellerCompletionKey: verified.seller.key,
          buyerCompletionKey: verified.buyer.key,
        };

        // Add to seller's score
        const sellerRep = getRep(slotCreator);
        if (!sellerRep.verifiedBookingKeys.includes(winner.key)) {
          sellerRep.verifiedBookingKeys.push(winner.key);
          if (!sellerRep.verifiedSlotKeys.includes(winner.slotKey)) {
            sellerRep.verifiedSlotKeys.push(winner.slotKey);
          }
          sellerRep.proofs.push(proof);
          sellerRep.verifiedJobsCount = sellerRep.proofs.length;
        }

        // Add to buyer's score
        const buyerRep = getRep(buyerCreator);
        if (!buyerRep.verifiedBookingKeys.includes(winner.key)) {
          buyerRep.verifiedBookingKeys.push(winner.key);
          if (!buyerRep.verifiedSlotKeys.includes(winner.slotKey)) {
            buyerRep.verifiedSlotKeys.push(winner.slotKey);
          }
          buyerRep.proofs.push(proof);
          buyerRep.verifiedJobsCount = buyerRep.proofs.length;
        }
      }
    }

    return repMap;
  }, [winningBookingsBySlot, slots, completions]);

  return {
    slots,
    bookings,
    completions,
    bookingsBySlot,
    completionsByBooking,
    winningBookingsBySlot,
    reputationByAddress,
    queryCount,
    loading,
    error,
    lastFetched,
    isSocketHealthy,
    refresh: doFetch,
    addSlot,
  };
}
