import { test } from "node:test";
import assert from "node:assert/strict";

// Same isolation requirement as production-data-safety-development-env —
// must be the first thing set in this process, before any import of
// src/config.js.
process.env.APP_ENV = "test";

test("test-environment fixtures also work when explicitly enabled via APP_ENV=test", async () => {
  const { isFixturesAllowed, APP_ENV } = await import("../src/config.js");
  assert.equal(APP_ENV, "test");
  assert.equal(isFixturesAllowed(), true);

  const mod = await import("../src/data/mockData.js");
  assert.ok(mod.notifications.length > 0, "notifications should be populated when APP_ENV=test");
  assert.ok(mod.listings.length > 0, "listings should be populated when APP_ENV=test");
});
