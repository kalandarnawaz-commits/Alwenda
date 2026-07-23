import { test } from "node:test";
import assert from "node:assert/strict";

// Must be set before anything imports src/config.js in this process —
// APP_ENV is resolved once into a frozen module-level const on first
// import, so this only works as the very first thing in a fresh file.
process.env.APP_ENV = "development";

test("development fixtures still work when explicitly enabled via APP_ENV=development", async () => {
  const { isFixturesAllowed, APP_ENV } = await import("../src/config.js");
  assert.equal(APP_ENV, "development");
  assert.equal(isFixturesAllowed(), true);

  const mod = await import("../src/data/mockData.js");
  assert.ok(mod.listings.length > 0, "listings should be populated in development");
  assert.ok(mod.serviceProfessionals.length > 0, "serviceProfessionals should be populated in development");
  assert.ok(mod.businesses.length > 0, "businesses should be populated in development");
  assert.ok(mod.notifications.length > 0, "notifications should be populated in development");
  assert.equal(mod.reputationProfile.name, "Alex Walker");
  // Real imported data must still be present alongside fixtures in dev.
  assert.ok(mod.importedBusinesses.length > 50);
});
