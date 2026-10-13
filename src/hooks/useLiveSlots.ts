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

const POLL_INTERVAL_MS = 8_000;

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
  refresh: () => void;
}

export function useLiveSlots(): UseLiveSlotsResult {
  const [slots, setSlots] = useState<SlotEntity[]>([]);
  const [bookings, setBookings] = useState<BookingEntity[]>([]);
  const [completions, setCompletions] = useState<CompletionEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const client = useRef(getArkivPublicClient()).current;
  const isMounted = useRef(true);

  // Fixed 3 queries per refresh cycle: 1 slots + 1 bookings + 1 completions
  const queryCount = 3;

  const doFetch = useCallback(async () => {
    try {
      setError(null);
      // Batch fetch with Promise.all: exactly 3 queries
      const [freshSlots, freshBookings, freshCompletions] = await Promise.all([
        fetchLiveSlots(client),
        fetchAllBookings(client),
        fetchAllCompletions(client),
      ]);

      if (isMounted.current) {
        setSlots(freshSlots);
        setBookings(freshBookings);
        setCompletions(freshCompletions);
        setLastFetched(new Date());
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to load market data from Arkiv.");
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [client]);

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
    refresh: doFetch,
  };
}
