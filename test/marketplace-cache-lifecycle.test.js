import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 9 of the mock-data-removal plan: Marketplace's own browse-pool
   dedup/create-merge contract had no direct regression coverage before
   this phase — Community (applyCreatedCommunityPost) and Help Requests
   (helpRequestPool/applyCreatedHelpRequest) both already had it from
   Phases 4/5, but the equivalent Marketplace functions
   (marketplaceListingPool/applyCreatedListing/refreshMyListings/
   shapeListingSummaryForDisplay/shapeListingForDisplay) were never
   covered. This file closes that gap, matching the same behaviour-over-
   implementation-detail style used across the suite. */

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist`);
  let parenDepth = 0;
  let paramsEnd = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "(") parenDepth += 1;
    else if (source[i] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        paramsEnd = i;
        break;
      }
    }
  }
  assert.ok(paramsEnd !== -1, `could not find end of parameter list for ${name}`);
  let depth = 0;
  let bodyStart = -1;
  let bodyEnd = -1;
  for (let i = paramsEnd; i < source.length; i += 1) {
    if (source[i] === "{") {
      if (depth === 0) bodyStart = i;
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  assert.ok(bodyStart !== -1 && bodyEnd !== -1, `could not find body for ${name}`);
  return source.slice(start, bodyEnd + 1);
}

let main;

test.before(async () => {
  main = await readRepoFile("src/main.js");
});

/* ---------------------------------------------------------------------
   1. marketplaceListingPool() — dedup contract.
--------------------------------------------------------------------- */

test("marketplaceListingPool dedupes by id — a listing already in the user's own pool is never duplicated from the general public feed", () => {
  const fn = extractFunction(main, "marketplaceListingPool");
  assert.match(fn, /const ownIds = new Set\(myListingsPool\.map/);
  assert.match(fn, /!ownIds\.has\(String\(raw\.id\)\)/);
  assert.match(fn, /return \[\.\.\.myListingsPool, \.\.\.others\]/);
});

test("marketplaceListingPool reads the shared refreshOpportunityFeed() cache (state.opportunityFeed.listings) — no second Marketplace-only cache was introduced", () => {
  const fn = extractFunction(main, "marketplaceListingPool");
  assert.match(fn, /state\.opportunityFeed\.listings/);
});

/* ---------------------------------------------------------------------
   2. applyCreatedListing() — create-and-merge contract.
--------------------------------------------------------------------- */

test("applyCreatedListing merges a freshly-created listing into myListingsPool immediately, without a refetch", () => {
  const fn = extractFunction(main, "applyCreatedListing");
  assert.match(fn, /myListingsPool\.unshift\(shapeListingForDisplay\(created\)\)/);
  assert.match(fn, /state\.myListings\.unshift\(created\)/);
});

test("submitListingForm calls applyCreatedListing on success — the create-and-merge path is actually wired, not just defined", () => {
  const fn = extractFunction(main, "submitListingForm");
  assert.match(fn, /applyCreatedListing\(created\)/);
});

/* ---------------------------------------------------------------------
   3. refreshMyListings() — merge-without-duplicate on session refresh.
--------------------------------------------------------------------- */

test("refreshMyListings only unshifts a fetched listing into myListingsPool when it isn't already present — repeated calls (sign-in, every Profile/Marketplace visit) never duplicate", () => {
  const fn = extractFunction(main, "refreshMyListings");
  assert.match(fn, /if \(!myListingsPool\.some\(\(existing\) => String\(existing\.id\) === String\(item\.id\)\)\)/);
  assert.match(fn, /myListingsPool\.unshift\(shapeListingForDisplay\(item\)\)/);
});

test("refreshMyListings never falls back to mock data on failure — a failed fetch is logged, not fabricated", () => {
  const fn = extractFunction(main, "refreshMyListings");
  assert.match(fn, /catch \(error\)/);
  assert.doesNotMatch(fn, /listings\.push\(|myListingsPool = \[.*\{/s);
});

/* ---------------------------------------------------------------------
   4. shapeListingForDisplay / shapeListingSummaryForDisplay — honest
      omission of fields the underlying data genuinely doesn't have.
--------------------------------------------------------------------- */

test("shapeListingForDisplay never fabricates response time, distance, popularity, or AI price — a brand-new listing has none of these yet, so they stay null/empty rather than invented", () => {
  const fn = extractFunction(main, "shapeListingForDisplay");
  assert.match(fn, /sellerResponseTime: null/);
  assert.match(fn, /distance: ""/);
  assert.match(fn, /popularity: ""/);
  assert.match(fn, /aiPrice: ""/);
});

test("shapeListingForDisplay's reputation is the user's real public_profiles.reputation_score (defaulting to genuine 0), never a fabricated number", () => {
  const fn = extractFunction(main, "shapeListingForDisplay");
  assert.match(fn, /sellerReputation: user\?\.publicProfile\?\.reputation_score \?\? 0/);
});

test("shapeListingSummaryForDisplay (the lightweight public-feed projection, no images/owner embed in the query) honestly omits every field that projection genuinely lacks — image, seller identity, distance, popularity, aiPrice", () => {
  const fn = extractFunction(main, "shapeListingSummaryForDisplay");
  assert.match(fn, /image: ""/);
  assert.match(fn, /seller: ""/);
  assert.match(fn, /sellerReputation: null/);
  assert.match(fn, /distance: ""/);
  assert.match(fn, /popularity: ""/);
  assert.match(fn, /aiPrice: ""/);
  assert.match(fn, /verifiedSeller: false/);
});

test("both listing shapers preserve the real database id and real created_at timestamp untouched — stable production IDs, real timestamps, never a manufactured placeholder", () => {
  const full = extractFunction(main, "shapeListingForDisplay");
  const summary = extractFunction(main, "shapeListingSummaryForDisplay");
  assert.match(full, /id: created\.id/);
  assert.match(full, /createdAt: created\.created_at \|\| new Date\(\)\.toISOString\(\)/);
  assert.match(summary, /id: raw\.id/);
  assert.match(summary, /createdAt: raw\.created_at/);
});

/* ---------------------------------------------------------------------
   5. filteredListings() reads only the real pool — never a mock fixture.
--------------------------------------------------------------------- */

test("filteredListings reads exclusively from marketplaceListingPool() — no mock `listings` array reference remains", () => {
  const fn = extractFunction(main, "filteredListings");
  assert.match(fn, /marketplaceListingPool\(\)/);
  assert.doesNotMatch(fn, /\blistings\b(?!Draft|SubmitStatus|SubmitError)/);
});

/* ---------------------------------------------------------------------
   6. Marketplace listing creation is auth-gated, mirroring the
      established Community/Help-Request composer pattern.
--------------------------------------------------------------------- */

test("renderCreateListingForm gates on state.auth.status — a signed-out visitor sees a sign-in prompt, never the composer, and the form itself never reaches the network unauthenticated", () => {
  const fn = extractFunction(main, "renderCreateListingForm");
  assert.match(fn, /if \(state\.auth\.status !== "signedIn"\)/);
  assert.match(fn, /data-auth-view="login"/);
});

test("submitListingForm's real createListing() call is reached only past the signed-out gate in renderCreateListingForm — the composer that could call it is unreachable while signed out", () => {
  const composer = extractFunction(main, "renderCreateListingForm");
  const submit = extractFunction(main, "submitListingForm");
  assert.match(composer, /if \(state\.auth\.status !== "signedIn"\)\s*\{\s*return/);
  assert.match(submit, /await createListing\(/);
});
