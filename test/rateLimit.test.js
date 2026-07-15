import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, pruneTimestamps } from "../src/utils/rateLimit.js";

test("pruneTimestamps drops entries older than the window", () => {
  const now = 100000;
  const result = pruneTimestamps([now - 1000, now - 400000, now - 10], now, 60000);
  assert.deepEqual(result, [now - 1000, now - 10]);
});

test("checkRateLimit allows attempts under the limit", () => {
  const now = 100000;
  const result = checkRateLimit([now - 1000, now - 2000], { now, windowMs: 60000, maxAttempts: 5 });
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterMs, 0);
  assert.equal(result.timestamps.length, 2);
});

test("checkRateLimit blocks once maxAttempts is reached within the window", () => {
  const now = 100000;
  const timestamps = [now - 1000, now - 2000, now - 3000, now - 4000, now - 5000];
  const result = checkRateLimit(timestamps, { now, windowMs: 60000, maxAttempts: 5 });
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs > 0);
});

test("checkRateLimit allows again once the oldest attempt ages out of the window", () => {
  const now = 100000;
  const timestamps = [now - 59999, now - 1000, now - 2000, now - 3000, now - 4000];
  const result = checkRateLimit(timestamps, { now, windowMs: 60000, maxAttempts: 5 });
  assert.equal(result.allowed, false);
  // Advance time past the oldest attempt's window.
  const later = now + 2;
  const result2 = checkRateLimit(timestamps, { now: later, windowMs: 60000, maxAttempts: 5 });
  assert.equal(result2.allowed, true);
});
