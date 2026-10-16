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
  type SlotEntity,
  type BookingEntity,
  type CompletionEntity,
  type ReputationResult,
  type ReputationProof,
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
  liveCount: number;
  lastAppliedBlock: bigint | null;
  pendingLocalCount: number;
  lastUpdateSource: "poll" | "websocket" | "local" | null;
  refreshFailed: boolean;
}

export function useLiveSlots(): UseLiveSlotsResult {
  const [slots, setSlots] = useState<SlotEntity[]>([]);
  const [bookings, setBookings] = useState<BookingEntity[]>([]);
  const [completions, setCompletions] = useState<CompletionEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Debug overlay & data flow tracking state
  const [lastAppliedBlock, setLastAppliedBlock] = useState<bigint | null>(null);
  const [pendingLocalCount, setPendingLocalCount] = useState<number>(0);
  const [lastUpdateSource, setLastUpdateSource] = useState<"poll" | "websocket" | "local" | null>(null);
  const [refreshFailed, setRefreshFailed] = useState<boolean>(false);

  const client = useRef(getArkivPublicClient()).current;
  const isMounted = useRef(true);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const lastAppliedBlockRef = useRef<bigint | null>(null);
  const currentSlotsRef = useRef<SlotEntity[]>([]);
  const pendingLocalSlotsRef = useRef<Map<string, { slot: SlotEntity; txBlock?: bigint }>>(new Map());

  const addSlot = useCallback((newSlot: SlotEntity) => {
    const normKey = newSlot.key.toLowerCase();
    pendingLocalSlotsRef.current.set(normKey, { slot: newSlot, txBlock: newSlot.createdAtBlock });
    setPendingLocalCount(pendingLocalSlotsRef.current.size);
    setLastUpdateSource("local");

    const nowSec = Math.floor(Date.now() / 1000);
    const pendingList = Array.from(pendingLocalSlotsRef.current.values()).map((p) => p.slot);
    const reconciled = reconcileSlots({
      authoritativeSlots: undefined,
      pendingSlots: pendingList,
      cachedSlots: currentSlotsRef.current,
      nowSec,
    });
    currentSlotsRef.current = reconciled;
    setSlots(reconciled);
  }, []);

  const addBooking = useCallback((newBooking: BookingEntity) => {
    setBookings((prev) => reconcileBookings({ authoritativeBookings: undefined, cachedBookings: [newBooking, ...prev] }));
  }, []);

  const updateSlotOwner = useCallback((key: Hex, newOwner: Address) => {
    const normKey = key.toLowerCase();
    const cOwner = checksumAddress(newOwner);

    const updated = currentSlotsRef.current.map((s) =>
      s.key.toLowerCase() === normKey ? { ...s, owner: cOwner } : s
    );
    currentSlotsRef.current = updated;
    setSlots(updated);
  }, []);

  // Fixed 3 queries per refresh cycle: 1 slots + 1 bookings + 1 completions
  const queryCount = 3;

  const doFetch = useCallback(async (force = false, source: "poll" | "websocket" = "poll") => {
    if (isFetchingRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
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

        if (slotsRes.status === "fulfilled") {
          const freshSlotsResult = slotsRes.value;
          const freshBlock = freshSlotsResult.blockNumber;

          // Monotonic guard: ignore any result with a block number lower than last applied; retry once after 1s
          if (lastAppliedBlockRef.current !== null && freshBlock < lastAppliedBlockRef.current) {
            console.warn(`[useLiveSlots] Stale block response ignored: got #${freshBlock} < lastApplied #${lastAppliedBlockRef.current}. Retrying in 1s.`);
            setTimeout(() => {
              if (isMounted.current) {
                doFetch(true, "poll");
              }
            }, 1000);
            return;
          }

          lastAppliedBlockRef.current = freshBlock;
          setLastAppliedBlock(freshBlock);
          setRefreshFailed(false);
          setError(null);

          // Reconcile pending local additions: remove if included in fresh results
          const authoritativeMap = new Set(freshSlotsResult.map((s: SlotEntity) => s.key.toLowerCase()));
          for (const [k] of pendingLocalSlotsRef.current.entries()) {
            if (authoritativeMap.has(k)) {
              pendingLocalSlotsRef.current.delete(k);
            }
          }
          setPendingLocalCount(pendingLocalSlotsRef.current.size);

          const pendingList = Array.from(pendingLocalSlotsRef.current.values()).map((p) => p.slot);
          const reconciledSlots = reconcileSlots({
            authoritativeSlots: freshSlotsResult,
            pendingSlots: pendingList,
            nowSec,
          });

          currentSlotsRef.current = reconciledSlots;
          setSlots(reconciledSlots);
          setLastUpdateSource(source);
        } else {
          // Timeout or error: keep the previous list intact; never clear or shrink silently
          const reason = slotsRes.reason instanceof Error ? slotsRes.reason.message : String(slotsRes.reason);
          console.warn("Live slots query failed; preserving previous verified list:", reason);
          setRefreshFailed(true);
          setError(
            /429|cost limit/i.test(reason)
              ? "Arkiv RPC rate limit active — serving last verified state."
              : "Arkiv refresh failed — displaying last verified on-chain state."
          );
        }

        // Reconcile bookings
        if (bookingsRes.status === "fulfilled") {
          setBookings(bookingsRes.value);
        }

        // Reconcile completions
        if (completionsRes.status === "fulfilled") {
          setCompletions(completionsRes.value);
        }

        setLastFetched(new Date());
      }
    } catch (err) {
      if (isMounted.current) {
        setRefreshFailed(true);
        setError(err instanceof Error ? err.message : "Arkiv indexer slow — displaying last verified on-chain state.");
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
  const triggerDebouncedFetch = useCallback((source: "poll" | "websocket" = "websocket") => {
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
      doFetch(false, source);
    } else if (!trailingScheduledRef.current) {
      // Cooldown window: schedule exactly one trailing fetch
      trailingScheduledRef.current = true;
      const delay = Math.max(COOLDOWN_MS - timeSinceLast, 1000);
      trailingTimerRef.current = setTimeout(() => {
        trailingScheduledRef.current = false;
        trailingTimerRef.current = null;
        doFetch(false, source);
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
          currentSlotsRef.current = remaining;
          triggerDebouncedFetch("poll");
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
    refresh: () => doFetch(true, "poll"),
    addSlot,
    updateSlotOwner,
    addBooking,
    liveCount: slots.length,
    lastAppliedBlock,
    pendingLocalCount,
    lastUpdateSource,
    refreshFailed,
  };
}
