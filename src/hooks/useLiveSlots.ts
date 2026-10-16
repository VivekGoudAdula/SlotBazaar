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
  reconcileSlots,
  reconcileBookings,
  reconcileCompletions,
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
  type ReputationResult,
  type ReputationProof,
  getKnownTransferredOwner,
  recordTransferredOwner,
} from "../lib/arkiv.js";
import { checksumAddress, type Address, type Hex } from "viem";

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
  updateSlotOwner: (key: Hex, newOwner: Address) => void;
  addBooking: (booking: BookingEntity) => void;
}

const LOCAL_STORAGE_KEY = "slotbazaar_recent_slots";

export function getBaseOnChainSlots(): SlotEntity[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      key: "0x6aa50234086b2db6b70562e021f0e8cef293127e2742b0a7d0220fc72a961d53",
      creator: "0xf48e7802a97781cca58750a6e5f1f1ab93763225",
      owner: (getKnownTransferredOwner("0x6aa50234086b2db6b70562e021f0e8cef293127e2742b0a7d0220fc72a961d53") || "0x53491aA366E086C19da948669b340317eE6eA6e9") as Address,
      category: "transport",
      cluster: "jeedimetla",
      title: "Test - Express Mini Truck",
      description: "",
      sellerLabel: "0xf48e…3225",
      priceBand: "mid",
      lat: 17.4897,
      lon: 78.5650,
      startsAt: now - 3600,
      endsAt: now + 4 * 3600,
      synthetic: false,
    },
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
    const hydrated = parsed.map((s) => ({
      ...s,
      createdAtBlock: s.createdAtBlock ? BigInt(s.createdAtBlock) : undefined,
      expiresAtBlock: s.expiresAtBlock ? BigInt(s.expiresAtBlock) : undefined,
    }));
    return reconcileSlots({
      authoritativeSlots: undefined,
      cachedSlots: hydrated,
      baseSlots: base,
      nowSec: Math.floor(Date.now() / 1000),
    });
  } catch {
    return reconcileSlots({
      authoritativeSlots: undefined,
      cachedSlots: [],
      baseSlots: base,
      nowSec: Math.floor(Date.now() / 1000),
    });
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

const LOCAL_BOOKINGS_STORAGE_KEY = "slotbazaar_recent_bookings";

function loadLocalRecentBookings(): BookingEntity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as BookingEntity[]) : [];
    const hydrated = parsed.map((b) => ({
      ...b,
      createdAtBlock: b.createdAtBlock ? BigInt(b.createdAtBlock) : undefined,
      expiresAtBlock: b.expiresAtBlock ? BigInt(b.expiresAtBlock) : undefined,
    }));
    return reconcileBookings({
      authoritativeBookings: undefined,
      cachedBookings: hydrated,
    });
  } catch {
    return [];
  }
}

function saveLocalRecentBookings(bookings: BookingEntity[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(bookings, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
    localStorage.setItem(LOCAL_BOOKINGS_STORAGE_KEY, serialized);
  } catch (err) {
    console.error("Failed to persist bookings to localStorage:", err);
  }
}

const LOCAL_COMPLETIONS_STORAGE_KEY = "slotbazaar_recent_completions";

function loadLocalRecentCompletions(): CompletionEntity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_COMPLETIONS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CompletionEntity[]) : [];
    const hydrated = parsed.map((c) => ({
      ...c,
      createdAtBlock: c.createdAtBlock ? BigInt(c.createdAtBlock) : undefined,
      expiresAtBlock: c.expiresAtBlock ? BigInt(c.expiresAtBlock) : undefined,
    }));
    return reconcileCompletions({
      authoritativeCompletions: undefined,
      cachedCompletions: hydrated,
    });
  } catch {
    return [];
  }
}

function saveLocalRecentCompletions(completions: CompletionEntity[]): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(completions, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
    localStorage.setItem(LOCAL_COMPLETIONS_STORAGE_KEY, serialized);
  } catch (err) {
    console.error("Failed to persist completions to localStorage:", err);
  }
}

export function useLiveSlots(): UseLiveSlotsResult {
  const [slots, setSlots] = useState<SlotEntity[]>(() => loadLocalRecentSlots());
  const [bookings, setBookings] = useState<BookingEntity[]>(() => loadLocalRecentBookings());
  const [completions, setCompletions] = useState<CompletionEntity[]>(() => loadLocalRecentCompletions());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const client = useRef(getArkivPublicClient()).current;
  const isMounted = useRef(true);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const localSlotsRef = useRef<SlotEntity[]>(loadLocalRecentSlots());
  const localBookingsRef = useRef<BookingEntity[]>(loadLocalRecentBookings());
  const localCompletionsRef = useRef<CompletionEntity[]>(loadLocalRecentCompletions());

  const addSlot = useCallback((newSlot: SlotEntity) => {
    const baseSlots = getBaseOnChainSlots();
    const nowSec = Math.floor(Date.now() / 1000);
    const reconciled = reconcileSlots({
      authoritativeSlots: undefined,
      cachedSlots: [newSlot, ...localSlotsRef.current],
      baseSlots,
      nowSec,
    });
    localSlotsRef.current = reconciled;
    saveLocalRecentSlots(reconciled);
    setSlots(reconciled);
  }, []);

  const addBooking = useCallback((newBooking: BookingEntity) => {
    const reconciled = reconcileBookings({
      authoritativeBookings: undefined,
      cachedBookings: [newBooking, ...localBookingsRef.current],
    });
    localBookingsRef.current = reconciled;
    saveLocalRecentBookings(reconciled);
    setBookings(reconciled);
  }, []);

  const updateSlotOwner = useCallback((key: Hex, newOwner: Address) => {
    const normKey = key.toLowerCase();
    const cOwner = checksumAddress(newOwner);
    recordTransferredOwner(key, cOwner);

    const updated = localSlotsRef.current.map((s) =>
      s.key.toLowerCase() === normKey ? { ...s, owner: cOwner } : s
    );
    localSlotsRef.current = updated;
    saveLocalRecentSlots(updated);

    setSlots((prev) =>
      prev.map((s) =>
        s.key.toLowerCase() === normKey ? { ...s, owner: cOwner } : s
      )
    );
  }, []);

  // Fixed 3 queries per refresh cycle: 1 slots + 1 bookings + 1 completions
  const queryCount = 3;

  const doFetch = useCallback(async (force = false) => {
    // Shared fetch lock: prevent duplicate concurrent requests
    if (isFetchingRef.current) return;
    // Pause network queries completely if tab is hidden
    if (typeof document !== "undefined" && document.hidden) return;
    // Cooldown throttle: don't fetch more often than every 10s unless forced,
    // and even if forced (e.g. wallet change), require at least 2.5s between network calls to prevent 429 rate limit
    const now = Date.now();
    const minInterval = force ? 2500 : 10_000;
    if (now - lastFetchTimeRef.current < minInterval) return;

    isFetchingRef.current = true;
    try {
      const withTimeout = <T>(p: Promise<T>, ms = 15_000): Promise<T> =>
        Promise.race([
          p,
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("RPC query timed out")), ms)
          ),
        ]);

      // Batch fetch with Promise.allSettled: independent failure isolation across queries
      const [slotsRes, bookingsRes, completionsRes] = await Promise.allSettled([
        withTimeout(fetchLiveSlots(client)),
        withTimeout(fetchAllBookings(client)),
        withTimeout(fetchAllCompletions(client)),
      ]);

      if (isMounted.current) {
        const nowSec = Math.floor(Date.now() / 1000);
        const baseSlots = getBaseOnChainSlots();

        let queryError: string | null = null;
        let freshSlots: SlotEntity[] | undefined = undefined;

        if (slotsRes.status === "fulfilled") {
          freshSlots = slotsRes.value;
        } else {
          const reason = slotsRes.reason instanceof Error ? slotsRes.reason.message : String(slotsRes.reason);
          console.warn("Live slots query failed, preserving verified cached state:", reason);
          queryError = /429|cost limit/i.test(reason)
            ? "Arkiv RPC rate limit active — serving verified local state."
            : "Arkiv indexer slow — displaying cached on-chain state.";
        }

        // Reconcile slots deterministically
        const reconciledSlots = reconcileSlots({
          authoritativeSlots: freshSlots,
          cachedSlots: localSlotsRef.current,
          baseSlots,
          nowSec,
        });

        localSlotsRef.current = reconciledSlots;
        saveLocalRecentSlots(reconciledSlots);
        setSlots(reconciledSlots);

        // Reconcile bookings
        let freshBookings: BookingEntity[] | undefined = undefined;
        if (bookingsRes.status === "fulfilled") {
          freshBookings = bookingsRes.value;
        }
        const reconciledBookings = reconcileBookings({
          authoritativeBookings: freshBookings,
          cachedBookings: localBookingsRef.current,
        });
        localBookingsRef.current = reconciledBookings;
        saveLocalRecentBookings(reconciledBookings);
        setBookings(reconciledBookings);

        // Reconcile completions
        let freshCompletions: CompletionEntity[] | undefined = undefined;
        if (completionsRes.status === "fulfilled") {
          freshCompletions = completionsRes.value;
        }
        const reconciledCompletions = reconcileCompletions({
          authoritativeCompletions: freshCompletions,
          cachedCompletions: localCompletionsRef.current,
        });
        localCompletionsRef.current = reconciledCompletions;
        saveLocalRecentCompletions(reconciledCompletions);
        setCompletions(reconciledCompletions);

        setError(queryError);
        setLastFetched(new Date());
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Arkiv indexer slow — displaying cached on-chain state.");
      }
    } finally {
      isFetchingRef.current = false;
      lastFetchTimeRef.current = Date.now();
      if (isMounted.current) setLoading(false);
    }
  }, [client]);

  const [isSocketHealthy, setIsSocketHealthyState] = useState(false);
  const isSocketHealthyRef = useRef(false);
  const setSocketHealthy = useCallback((healthy: boolean) => {
    isSocketHealthyRef.current = healthy;
    setIsSocketHealthyState(healthy);
  }, []);

  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trailingScheduledRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffDelayRef = useRef(1000);
  const unwatchRef = useRef<(() => void) | null>(null);

  // WebSocket-triggered refetches: LEADING EDGE + single trailing fetch
  // Fires immediately if cooldown window has passed; coalesces subsequent events into at most 1 trailing fetch.
  const triggerDebouncedFetch = useCallback(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    const now = Date.now();
    const timeSinceLast = now - lastFetchTimeRef.current;
    const COOLDOWN_MS = 10_000;

    if (timeSinceLast >= COOLDOWN_MS && !isFetchingRef.current) {
      // Leading edge: fire immediately
      if (trailingTimerRef.current) {
        clearTimeout(trailingTimerRef.current);
        trailingTimerRef.current = null;
      }
      trailingScheduledRef.current = false;
      doFetch();
    } else if (!trailingScheduledRef.current) {
      // Cooldown window: schedule exactly one trailing fetch
      trailingScheduledRef.current = true;
      const delay = Math.max(COOLDOWN_MS - timeSinceLast, 1000);
      trailingTimerRef.current = setTimeout(() => {
        trailingScheduledRef.current = false;
        trailingTimerRef.current = null;
        doFetch();
      }, delay);
    }
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
            setSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onEntityPatched: () => {
            setSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onExpiryExtended: () => {
            setSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onOwnershipTransferred: (event) => {
            setSocketHealthy(true);
            backoffDelayRef.current = 1000;
            if (event?.entityKey && event?.newOwner) {
              updateSlotOwner(event.entityKey as Hex, event.newOwner as Address);
            }
            triggerDebouncedFetch();
          },
          onEntityDeleted: () => {
            setSocketHealthy(true);
            backoffDelayRef.current = 1000;
            triggerDebouncedFetch();
          },
          onError: (err) => {
            console.warn("WebSocket entity subscription warning/disconnect:", err.message);
            setSocketHealthy(false);
            scheduleReconnect();
          },
        });

        unwatchRef.current = unwatch;
        setSocketHealthy(true);
      } catch (err) {
        console.warn("Failed to connect WebSocket entity watcher:", err);
        setSocketHealthy(false);
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
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
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
          localSlotsRef.current = remaining;
          saveLocalRecentSlots(remaining);
          triggerDebouncedFetch();
          return remaining;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [triggerDebouncedFetch]);

  // Polling backoff tracking for 429/5xx responses
  const pollingDelayRef = useRef(POLL_INTERVAL_MS);

  // Self-scheduling polling loop (pauses when tab is hidden, jittered backoff on 429/5xx)
  useEffect(() => {
    isMounted.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      if (!isMounted.current) return;
      timer = setTimeout(async () => {
        if (!isMounted.current) return;
        // Pause network requests completely if browser tab is hidden
        if (typeof document !== "undefined" && document.visibilityState === "hidden") {
          scheduleNext();
          return;
        }

        // Fallback polling: runs every 30 seconds regardless of WebSocket socket state
        // to guarantee that any dropped or missed WebSocket event heals within 30 seconds at most.
        try {
          await doFetch();
          // Reset backoff delay on successful fetch
          pollingDelayRef.current = POLL_INTERVAL_MS;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          // Check for rate limit or server errors
          if (/429|500|502|503|504|rate limit|too many/i.test(msg)) {
            const jitter = Math.floor(Math.random() * 3000);
            pollingDelayRef.current = Math.min(pollingDelayRef.current * 1.5 + jitter, 120_000);
            console.warn(`RPC rate-limited (429/5xx). Backing off polling to ${Math.round(pollingDelayRef.current / 1000)}s.`);
          }
        }
        scheduleNext();
      }, pollingDelayRef.current);
    };

    doFetch();
    scheduleNext();

    // Trigger immediate refetch as soon as tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        doFetch(true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted.current = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
    refresh: () => doFetch(true),
    addSlot,
    updateSlotOwner,
    addBooking,
  };
}
