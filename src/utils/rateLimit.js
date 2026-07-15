/**
 * Client-side rate limiting for auth attempts — defense-in-depth against
 * brute-forcing a password or a 6-digit verification code, even before any
 * server-side throttling exists. This is deliberately pure (no localStorage
 * access here) so it's testable without a browser; main.js supplies the
 * timestamp array from/to storage.
 */

export function pruneTimestamps(timestamps, now, windowMs) {
  return (timestamps || []).filter((timestamp) => now - timestamp < windowMs);
}

/**
 * @param {number[]} timestamps - prior attempt timestamps for this action
 * @param {{ now?: number, windowMs?: number, maxAttempts?: number }} [options]
 * @returns {{ allowed: boolean, retryAfterMs: number, timestamps: number[] }}
 *   `timestamps` is the pruned list — callers should persist it, and only
 *   append `now` to it themselves once the attempt actually proceeds.
 */
export function checkRateLimit(timestamps, { now = Date.now(), windowMs = 5 * 60 * 1000, maxAttempts = 5 } = {}) {
  const recent = pruneTimestamps(timestamps, now, windowMs);
  const allowed = recent.length < maxAttempts;
  const retryAfterMs = allowed ? 0 : windowMs - (now - recent[0]);
  return { allowed, retryAfterMs, timestamps: recent };
}
