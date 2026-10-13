/**
 * src/lib/time.ts
 *
 * Time formatting utilities for slot countdown timers.
 */

/**
 * Returns a human-readable time-left string for a slot.
 * e.g. "3h 45m", "54m 12s", "Expired"
 */
export function formatTimeLeft(endsAt: number, nowSec: number): string {
  const diffSec = endsAt - nowSec;
  if (diffSec <= 0) return "Expired";

  const hours   = Math.floor(diffSec / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;

  if (hours >= 1) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes >= 1) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Returns a CSS color class identifier based on how much time remains.
 *   "critical"   — < 5 minutes  (red)
 *   "urgent"     — < 30 minutes (orange)
 *   "standard"   — otherwise    (teal)
 */
export type UrgencyLevel = "critical" | "urgent" | "standard";

export function getUrgency(endsAt: number, nowSec: number): UrgencyLevel {
  const diff = endsAt - nowSec;
  if (diff <= 0)    return "critical";
  if (diff < 300)   return "critical";   // < 5 min
  if (diff < 1800)  return "urgent";     // < 30 min
  return "standard";
}

/**
 * Returns a short human-readable timestamp like "Oct 13, 14:30"
 */
export function formatDateTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}
