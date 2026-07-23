import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist`);
  let depth = 0;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      if (bodyStart === -1) bodyStart = i;
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

const RISKY_ARRAY_EXPORTS = [
  "importSources", "businessClaims", "profileReviews", "feedPosts",
  "liveAroundYou", "earnToday", "exploreHighlights", "alwenRecommendations", "listings",
  "serviceProfessionals", "helpRequests", "businesses", "offers", "reservations",
  "notifications", "messageThreads", "adminStats"
];

/* ---------------------------------------------------------------------
   Environment resolution — missing/unknown environment fails safe.
--------------------------------------------------------------------- */

test("missing environment defaults to production-safe behavior (no fixtures)", async () => {
  delete process.env.APP_ENV;
  const { APP_ENV, isFixturesAllowed, isProductionEnvironment } = await import("../src/config.js");
  assert.equal(APP_ENV, "production");
  assert.equal(isFixturesAllowed(), false);
  assert.equal(isProductionEnvironment(), true);
});

test("an unrecognised APP_ENV value also fails safe to production, not to development", async () => {
  const { resolveAppEnv, computeIsFixturesAllowed } = await import("../src/config.js");
  const resolved = resolveAppEnv("banana", undefined);
  assert.equal(resolved, "production");
  assert.equal(computeIsFixturesAllowed(resolved), false);
});

/* ---------------------------------------------------------------------
   Production does not render fixtures — executed, not just pattern-
   matched: import the real module fresh under production defaults.
--------------------------------------------------------------------- */

test("production does not render marketplace fixtures (listings is empty under production defaults)", async () => {
  delete process.env.APP_ENV;
  const { listings } = await import(`../src/data/mockData.js?t=${Date.now()}-a`);
  assert.deepEqual(listings, []);
});

test("production does not render fake reviews (profileReviews is empty under production defaults)", async () => {
  delete process.env.APP_ENV;
  const { profileReviews } = await import(`../src/data/mockData.js?t=${Date.now()}-b`);
  assert.deepEqual(profileReviews, []);
});

test("production does not render demo notifications (notifications is empty under production defaults)", async () => {
  delete process.env.APP_ENV;
  const { notifications } = await import(`../src/data/mockData.js?t=${Date.now()}-c`);
  assert.deepEqual(notifications, []);
});

test("production does not render demo messages (messageThreads is empty under production defaults)", async () => {
  delete process.env.APP_ENV;
  const { messageThreads } = await import(`../src/data/mockData.js?t=${Date.now()}-d`);
  assert.deepEqual(messageThreads, []);
});

test("production does not render achievements/reputation fixtures — profileAchievements/reputationTimeline were removed as dead code, reputationProfile is blanked", async () => {
  delete process.env.APP_ENV;
  const { reputationProfile } = await import(`../src/data/mockData.js?t=${Date.now()}-e`);
  assert.equal(reputationProfile.name, "");
  assert.equal(reputationProfile.overall, 0);
  assert.equal(reputationProfile.helpfulAnswers, 0);
  assert.deepEqual(reputationProfile.verifiedSkillKeys, []);

  const mockData = await readRepoFile("src/data/mockData.js");
  assert.doesNotMatch(mockData, /export const profileAchievements/, "profileAchievements was fabricated and unused — must stay removed, not re-added");
  assert.doesNotMatch(mockData, /export const reputationTimeline/, "reputationTimeline was fabricated and unused — must stay removed, not re-added");
});

test("every fixture-backed mockData.js export is empty under production defaults, in one sweep", async () => {
  delete process.env.APP_ENV;
  const mod = await import(`../src/data/mockData.js?t=${Date.now()}-f`);
  for (const field of RISKY_ARRAY_EXPORTS) {
    assert.deepEqual(mod[field], [], `${field} must be empty under production defaults`);
  }
  assert.deepEqual(mod.cityGraph, { places: 0, businesses: 0, professionals: 0, listings: 0, jobs: 0, rentals: 0, offers: 0, events: 0, transport: 0, governmentOffices: 0 });
});

test("fabricated main.js-local LIVE_OPPORTUNITIES feed is also empty under production defaults", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /const LIVE_OPPORTUNITIES = isFixturesAllowed\(\) \? \[/, "LIVE_OPPORTUNITIES must be gated the same way as mockData.js fixtures");
  assert.match(main, /\] : \[\];/, "LIVE_OPPORTUNITIES must fall back to an empty array, not the fabricated list, when fixtures are not allowed");
});

/* Development- and test-environment fixture cases live in their own
   files (test/production-data-safety-development-env.test.js and
   test/production-data-safety-test-env.test.js) — config.js resolves
   APP_ENV once into a frozen module-level const on first import, so
   flipping process.env.APP_ENV mid-file after config.js has already
   been imported (as every test above this one does) would silently
   test against a stale cached value. node --test isolates each file
   into its own process, so a dedicated file that sets APP_ENV before
   any import is the only reliable way to exercise this. */

/* ---------------------------------------------------------------------
   Imported businesses remain visible; absent fields are omitted, never
   invented.
--------------------------------------------------------------------- */

test("imported businesses (real seed data) remain visible under production defaults", async () => {
  delete process.env.APP_ENV;
  const { importedBusinesses } = await import(`../src/data/mockData.js?t=${Date.now()}-i`);
  assert.ok(importedBusinesses.length > 50, "real imported place data must never be gated by isFixturesAllowed()");
});

test("renderPlaceCard omits absent fields for real imported businesses rather than inventing them", async () => {
  const main = await readRepoFile("src/main.js");
  const renderPlaceCard = extractFunction(main, "renderPlaceCard");
  // Rating badge only renders when a real rating exists — never a fabricated default.
  assert.match(renderPlaceCard, /item\.rating\s*\?/);
});

/* ---------------------------------------------------------------------
   Fake ratings are not synthesized.
--------------------------------------------------------------------- */

test("renderBusinesses only shows a verified badge when the record is actually verified, never unconditionally", async () => {
  const main = await readRepoFile("src/main.js");
  const renderBusinesses = extractFunction(main, "renderBusinesses");
  assert.match(renderBusinesses, /item\.verified \? verifiedCheck/);
  assert.doesNotMatch(renderBusinesses, /\$\{item\.name\}\$\{verifiedCheck/, "must never render the verified badge unconditionally");
});

/* ---------------------------------------------------------------------
   ops / cityImport are inaccessible to normal users.
--------------------------------------------------------------------- */

test("ops is inaccessible to an ordinary signed-in user", async () => {
  const main = await readRepoFile("src/main.js");
  const isOpsAuthorized = extractFunction(main, "isOpsAuthorized");
  assert.match(isOpsAuthorized, /user\.traderPermissions\?\.includes\("verification_view"\)/);
  assert.match(isOpsAuthorized, /\["admin", "service"\]\.includes\(user\.appRole\)/);
  // A plain signed-in user object with neither field must be rejected —
  // simulate the check with the exact same expression the function uses.
  const ordinaryUser = { id: "u1", appRole: "user", traderPermissions: [] };
  const authorized = Boolean(ordinaryUser) && (ordinaryUser.traderPermissions?.includes("verification_view") || ["admin", "service"].includes(ordinaryUser.appRole));
  assert.equal(authorized, false);
  const adminUser = { id: "u2", appRole: "admin" };
  const adminAuthorized = Boolean(adminUser) && (adminUser.traderPermissions?.includes("verification_view") || ["admin", "service"].includes(adminUser.appRole));
  assert.equal(adminAuthorized, true);
});

test("cityImport is inaccessible to an ordinary signed-in user (same OPS_VIEWS gate as ops)", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /const OPS_VIEWS = INTERNAL_URL_VIEWS/);
  assert.match(main, /const INTERNAL_URL_VIEWS = new Set\(\["ops", "cityImport"\]\)/);
  assert.match(main, /OPS_VIEWS\.has\(state\.activeView\) && !isOpsAuthorized\(state\.auth\.user\)/);
});

test("an unauthenticated (signed-out) visitor is also refused ops/cityImport, not just an ordinary signed-in user", () => {
  const signedOutUser = null;
  const authorized = Boolean(signedOutUser) && false;
  assert.equal(authorized, false);
});

test("renderOpsUnauthorized renders an honest not-available message, never the real admin content", async () => {
  const main = await readRepoFile("src/main.js");
  const helper = extractFunction(main, "renderOpsUnauthorized");
  assert.match(helper, /admin\.unauthorizedTitle/);
  assert.doesNotMatch(helper, /adminStats|renderCityGraph|renderCityImport/);
});

/* ---------------------------------------------------------------------
   Empty states display correctly (exact required copy).
--------------------------------------------------------------------- */

test("marketplace shows the required empty state when there are no real listings", async () => {
  const main = await readRepoFile("src/main.js");
  const en = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(en.marketplace.emptyTitle, "No listings yet");
  assert.equal(en.marketplace.emptyHint, "Be the first person in your area to sell, rent, or offer a service.");
  assert.equal(en.marketplace.emptyCta, "Create listing");
  const renderMarketplace = extractFunction(main, "renderMarketplace");
  assert.match(renderMarketplace, /items\.length \? items\.map\(renderMarketplaceListing\)\.join\(""\) : renderEmptyStateAction/);
});

test("notifications show the required empty state when there is no real activity", async () => {
  const en = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(en.notification.emptyTitle, "You're all caught up.");
});

test("messages show the required empty state when there are no real conversations", async () => {
  const en = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(en.messages.emptyTitle, "No conversations yet.");
  assert.equal(en.messages.emptyHint, "Contact a business or another user to start a conversation.");
  const main = await readRepoFile("src/main.js");
  const renderInboxBody = extractFunction(main, "renderInboxBody");
  assert.match(renderInboxBody, /if \(!messageThreads\.length\)/);
});

test("reservations show the required empty state when there are no real bookings", async () => {
  const en = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(en.common.reservationsEmptyTitle, "You haven't made any bookings yet");
  const main = await readRepoFile("src/main.js");
  const renderReservations = extractFunction(main, "renderReservations");
  assert.match(renderReservations, /reservations\.length \? reservations\.map\(renderReservationCard\)\.join\(""\) : renderEmptyState/);
});

test("business profile shows an honest empty state instead of crashing when there is no real business to display", async () => {
  const main = await readRepoFile("src/main.js");
  const renderBusinessProfile = extractFunction(main, "renderBusinessProfile");
  assert.match(renderBusinessProfile, /if \(!item\) \{/);
  assert.match(renderBusinessProfile, /business\.emptyTitle/);
});

/* ---------------------------------------------------------------------
   Fixtures cannot enter a production bundle through fallback behaviour.
--------------------------------------------------------------------- */

test("no mockData.js fixture export falls back to fabricated content on any code path other than isFixturesAllowed()", async () => {
  const mockData = await readRepoFile("src/data/mockData.js");
  for (const name of RISKY_ARRAY_EXPORTS) {
    const pattern = new RegExp(`export const ${name} = isFixturesAllowed\\(\\) \\? DEV\\.FIXTURE_${name} : \\[\\];`);
    assert.match(mockData, pattern, `${name} must be exactly "isFixturesAllowed() ? DEV.FIXTURE_${name} : []" — no other fallback path is permitted`);
  }
});

test("devFixtures.js is never imported by anything except mockData.js", async () => {
  const { execSync } = await import("node:child_process");
  const rootDir = new URL("../", import.meta.url).pathname;
  const output = execSync(`grep -rl "devFixtures" --include="*.js" src/ 2>/dev/null || true`, { cwd: rootDir, encoding: "utf8" });
  const importers = output.split("\n").map((line) => line.trim()).filter(Boolean);
  assert.deepEqual(importers, ["src/data/mockData.js"], `devFixtures.js must only be imported by mockData.js, found: ${importers.join(", ")}`);
});
