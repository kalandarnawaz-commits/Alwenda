#!/usr/bin/env node
/**
 * Production data-safety gate.
 *
 * Alwenda is a zero-bundler static site (no build step strips unused
 * code, and GitHub Pages serves the repository root directly — see
 * docs/qa/production-data-policy.md for why `dist/` is not literally what
 * alwenda.com serves). That means fixture *string content* physically
 * exists in the shipped files regardless of environment — there is no
 * tree-shaking to remove it. The real, load-bearing guarantee this
 * project relies on is the runtime gate in src/config.js
 * (isFixturesAllowed()): fixture arrays/objects are only ever assigned
 * into a rendered value when APP_ENV is explicitly "development" or
 * "test". This script proves that gate actually works — by building the
 * app and then *executing* its data layer under production-default
 * conditions (no APP_ENV set at all, the fail-safe case) — rather than
 * making the weaker and, for this architecture, false claim that no
 * fixture bytes exist anywhere in the build output.
 */
import { execSync } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const distMockDataPath = path.join(rootDir, "dist/src/data/mockData.js");

const failures = [];
function fail(message) {
  failures.push(message);
  console.error(`[production-data-safety] FAIL: ${message}`);
}
function ok(message) {
  console.log(`[production-data-safety] OK: ${message}`);
}

async function ensureBuilt() {
  try {
    await access(distMockDataPath);
  } catch {
    console.log("[production-data-safety] dist/ not found — running `npm run build` first.");
    execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
  }
}

async function readRepoFile(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

/** Every export in mockData.js that represents fabricated/seeded demo
 * activity must be gated behind isFixturesAllowed() — never a bare
 * literal. This is a structural check (every risky export uses the
 * ternary), independent of the executable check below. */
async function checkMockDataGating() {
  const source = await readRepoFile("src/data/mockData.js");
  if (!/import\s*\{\s*isFixturesAllowed\s*\}\s*from\s*"\.\.\/config\.js"/.test(source)) {
    fail("src/data/mockData.js must import isFixturesAllowed from ../config.js");
    return;
  }
  const riskyExports = [
    "importSources", "businessClaims", "profileReviews", "feedPosts",
    "liveAroundYou", "earnToday", "exploreHighlights", "alwenRecommendations", "listings",
    "serviceProfessionals", "helpRequests", "businesses", "offers", "reservations",
    "notifications", "messageThreads", "adminStats", "cityGraph", "reputationProfile",
    "alwenListingDraft", "alwenBusinessDraft"
  ];
  for (const name of riskyExports) {
    const pattern = new RegExp(`export const ${name} = isFixturesAllowed\\(\\) \\? DEV\\.FIXTURE_${name} :`);
    if (!pattern.test(source)) {
      fail(`src/data/mockData.js: "${name}" is not gated behind isFixturesAllowed() — check for a bare/unconditional export.`);
    }
  }
  if (failures.length === 0) ok(`all ${riskyExports.length} fixture-backed mockData.js exports are gated behind isFixturesAllowed()`);
}

/** Same check for the fabricated arrays declared directly inside
 * src/main.js (not every fixture in this app lives in mockData.js —
 * LIVE_OPPORTUNITIES is a fully-invented paid-task feed declared inline). */
async function checkMainJsLocalFixtureGating() {
  const source = await readRepoFile("src/main.js");
  if (!/const LIVE_OPPORTUNITIES = isFixturesAllowed\(\) \? \[/.test(source)) {
    fail("src/main.js: LIVE_OPPORTUNITIES must be gated behind isFixturesAllowed() (fabricated paid-task listings with invented trust scores).");
  } else {
    ok("LIVE_OPPORTUNITIES in src/main.js is gated behind isFixturesAllowed()");
  }
}

/** The load-bearing check: actually run the built app's data layer with
 * no APP_ENV configured at all — the exact "missing environment" case —
 * and confirm every fixture-backed value comes back empty. This is
 * proof by execution, not by pattern-matching source text. */
async function checkExecutedProductionDefaults() {
  delete process.env.APP_ENV;
  const cacheBust = `?t=${Date.now()}`;
  const mod = await import(`${distMockDataPath}${cacheBust}`);

  const arrayFields = [
    "importSources", "businessClaims", "profileReviews", "feedPosts",
    "liveAroundYou", "earnToday", "exploreHighlights", "alwenRecommendations", "listings",
    "serviceProfessionals", "helpRequests", "businesses", "offers", "reservations",
    "notifications", "messageThreads", "adminStats"
  ];
  for (const field of arrayFields) {
    const value = mod[field];
    if (!Array.isArray(value) || value.length !== 0) {
      fail(`dist/src/data/mockData.js: "${field}" is not empty under production-default APP_ENV (got ${Array.isArray(value) ? `${value.length} items` : typeof value}).`);
    }
  }
  if (mod.reputationProfile?.name !== "" || mod.reputationProfile?.overall !== 0) {
    fail("dist/src/data/mockData.js: reputationProfile carries non-empty fabricated values under production defaults.");
  }
  if (mod.alwenListingDraft?.title !== "" || mod.alwenBusinessDraft?.name !== "") {
    fail("dist/src/data/mockData.js: alwenListingDraft/alwenBusinessDraft carry non-empty fabricated values under production defaults.");
  }
  if (!Array.isArray(mod.importedBusinesses) || mod.importedBusinesses.length < 50) {
    fail(`dist/src/data/mockData.js: importedBusinesses (real seed data) unexpectedly missing or too small (${mod.importedBusinesses?.length ?? "undefined"}) — production must still show real imported places.`);
  }
  if (failures.length === 0) {
    ok(`executed dist/src/data/mockData.js under production-default APP_ENV: all ${arrayFields.length} fixture arrays empty, reputationProfile/alwenListingDraft/alwenBusinessDraft blank, importedBusinesses (${mod.importedBusinesses.length} real places) intact`);
  }
}

/** ops/cityImport must require real authorization (a server-issued
 * app_metadata.role), not merely being absent from navigation. */
async function checkOpsAuthorization() {
  const source = await readRepoFile("src/main.js");
  if (!/function isOpsAuthorized\(user\)/.test(source)) {
    fail("src/main.js: isOpsAuthorized(user) helper not found.");
    return;
  }
  if (!/OPS_VIEWS\.has\(state\.activeView\) && !isOpsAuthorized\(state\.auth\.user\)/.test(source)) {
    fail("src/main.js: renderView() does not gate OPS_VIEWS behind isOpsAuthorized().");
    return;
  }
  ok("ops/cityImport are gated behind isOpsAuthorized() in renderView()");
}

async function main() {
  await ensureBuilt();
  await checkMockDataGating();
  await checkMainJsLocalFixtureGating();
  await checkOpsAuthorization();
  await checkExecutedProductionDefaults();

  if (failures.length > 0) {
    console.error(`\n[production-data-safety] ${failures.length} check(s) failed.`);
    process.exit(1);
  }
  console.log("\n[production-data-safety] All checks passed — no fabricated activity reaches production under default (missing) APP_ENV.");
}

main().catch((error) => {
  console.error("[production-data-safety] Unexpected error:", error);
  process.exit(1);
});
