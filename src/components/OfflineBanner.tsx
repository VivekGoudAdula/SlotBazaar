/**
 * src/components/OfflineBanner.tsx
 *
 * Real-time offline detection banner via navigator.onLine and window event listeners.
 * Alerts users non-blockingly when internet connectivity is interrupted.
 */

import React, { useState, useEffect } from "react";

export function OfflineBanner(): React.ReactElement | null {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      id="offline-banner"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#dc2626",
        color: "#ffffff",
        textAlign: "center",
        padding: "0.5rem 1rem",
        fontSize: "0.85rem",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
      }}
    >
      <span>📡</span>
      <span>
        <strong>You are offline:</strong> Displaying cached on-chain state. Live Arkiv updates will resume when your connection is restored.
      </span>
    </div>
  );
}
