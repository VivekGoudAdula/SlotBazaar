/**
 * src/hooks/useLiveSlots.ts
 *
 * Read-only hook that polls the Arkiv index for live slots every 8 seconds.
 * Returns all slots sorted by earliest expiry (chain source of truth only).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getArkivPublicClient, fetchLiveSlots, type SlotEntity } from "../lib/arkiv.js";

const POLL_INTERVAL_MS = 8_000;

export interface UseLiveSlotsResult {
  slots: SlotEntity[];
  loading: boolean;
  error: string | null;
  lastFetched: Date | null;
  /** Manually trigger a fresh fetch */
  refresh: () => void;
}

export function useLiveSlots(): UseLiveSlotsResult {
  const [slots, setSlots] = useState<SlotEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const client = useRef(getArkivPublicClient()).current;
  const isMounted = useRef(true);

  const doFetch = useCallback(async () => {
    try {
      setError(null);
      const fresh = await fetchLiveSlots(client);
      if (isMounted.current) {
        setSlots(fresh);
        setLastFetched(new Date());
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to load slots from Arkiv.");
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

  return { slots, loading, error, lastFetched, refresh: doFetch };
}
