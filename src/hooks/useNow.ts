/**
 * src/hooks/useNow.ts
 *
 * Provides a live "now" timestamp (unix seconds), ticking every second.
 * Used to compute remaining time-to-live for slot cards.
 */

import { useState, useEffect } from "react";

export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return now;
}
