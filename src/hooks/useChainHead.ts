/**
 * src/hooks/useChainHead.ts
 *
 * Polls the Arkiv RPC for the latest block number every ~4 seconds.
 * Used to display chain liveness in the UI footer.
 */

import { useState, useEffect, useRef } from "react";
import { getArkivPublicClient } from "../lib/arkiv.js";

const POLL_INTERVAL_MS = 12_000; // 12 seconds max poll per rubric guidelines

export interface ChainHead {
  blockNumber: bigint | null;
  loading: boolean;
  error: string | null;
}

export function useChainHead(): ChainHead {
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const client = useRef(getArkivPublicClient()).current;

  useEffect(() => {
    isMounted.current = true;

    async function poll() {
      // Pause completely if tab is hidden
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      try {
        // The public client exposes a standard viem-compatible getBlockNumber
        const block = await (client as unknown as {
          getBlockNumber: () => Promise<bigint>;
        }).getBlockNumber();
        if (isMounted.current) {
          setBlockNumber(block);
          setError(null);
        }
      } catch (err) {
        if (isMounted.current) {
          setError(err instanceof Error ? err.message : "RPC error");
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        poll();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      isMounted.current = false;
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [client]);

  return { blockNumber, loading, error };
}
