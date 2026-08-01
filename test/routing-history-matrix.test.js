import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 9I of the mock-data-removal plan: a focused routing/direct-link
   regression matrix.

   test/browser-history-restoration.test.js already covers (and actually
   executes, via new Function(...)) the Home-fallback and
   liveOpportunities category-filter cases. This file extends the same
   executable-harness technique to the id-restoration dispatch branch of
   syncStateFromUrl() for every entry in ID_LINKED_VIEWS — publicProfile,
   userProfile, listingDetail, businessClaim, liveOpportunityDetail,
   eventDetail — which had no direct test before. Each assertion
   exercises the real production function, not a paraphrase of it. */

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
  for (let i = paramsEnd; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`could not find end of function ${name}`);
}

function extractConst(source, name) {
  const marker = `const ${name} = `;
  const start = source.indexOf(marker);
  assert.ok(start !== -1, `const ${name} must exist`);
  const valueStart = start + marker.length;
  let depth = 0;
  for (let i = valueStart; i < source.length; i += 1) {
    const ch = source[i];
    if ("[{(".includes(ch)) depth += 1;
    else if ("]})".includes(ch)) depth -= 1;
    else if (ch === ";" && depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`could not find end of const ${name}`);
}

const main = await readRepoFile("src/main.js");

/** Executes the real syncStateFromUrl() (plus its real collaborators,
 * extracted verbatim from main.js) against a mocked window.location and
 * starting state — same technique as browser-history-restoration.test.js,
 * duplicated here per this repo's established per-file-self-contained
 * convention. openUserProfile/openPublicProfileById are stubbed to just
 * record their id argument, since the id-dispatch branch under test is
 * exactly what calls them — asserting on the call, not on their (network-
 * backed) internal behaviour, which is covered elsewhere. */
function runSyncStateFromUrl({ pathname = "/", search = "", hash = "", startingState }) {
  const state = startingState;
  const openUserProfileCalls = [];
  const openPublicProfileByIdCalls = [];
  const body = [
    extractConst(main, "DEEP_LINK_VIEWS"),
    extractConst(main, "ID_LINKED_VIEWS"),
    extractConst(main, "INTERNAL_URL_VIEWS"),
    "function orderedCategoryIds() { return ['delivery','transport','petCare','teaching','shopping','technology','cleaning','homeRepairs','gardening','fitness','food','creative','business','childcare','elderCare','events','legal','medical','other']; }",
    extractFunction(main, "resetToHomeFromUrl"),
    extractFunction(main, "syncOpportunityFilterFromUrl"),
    extractFunction(main, "syncStateFromUrl"),
    "function openUserProfile(id) { openUserProfileCalls.push(id); }",
    "function openPublicProfileById(id) { openPublicProfileByIdCalls.push(id); }",
    "syncStateFromUrl();",
    "return state;"
  ].join("\n");
  const fn = new Function("state", "window", "openUserProfileCalls", "openPublicProfileByIdCalls", body);
  const fakeWindow = { location: { pathname, search, hash } };
  return fn(state, fakeWindow, openUserProfileCalls, openPublicProfileByIdCalls);
}

function freshState() {
  return {
    activeView: "home",
    selectedListingId: null,
    selectedPlaceId: null,
    selectedOpportunityId: null,
    selectedEventId: null,
    publicProfile: null,
    userProfile: null,
    auth: { status: "signedOut", authError: null, authView: "login" },
    opportunityFilter: { categoryId: "all", surface: "earn", intent: "all", status: "active", distance: "all" }
  };
}

const REAL_UUID = "3f1c9a2e-6b7d-4e5f-8a9b-0c1d2e3f4a5b";

/* ---------------------------------------------------------------------
   1. Direct links restore the correct state for every ID_LINKED_VIEWS
      entry — the actual dispatch table, executed for real.
--------------------------------------------------------------------- */

test("direct link ?view=listingDetail&id=<uuid> sets state.selectedListingId to the real id", () => {
  const result = runSyncStateFromUrl({ search: `?view=listingDetail&id=${REAL_UUID}`, startingState: freshState() });
  assert.equal(result.activeView, "listingDetail");
  assert.equal(result.selectedListingId, REAL_UUID);
});

test("direct link ?view=businessClaim&id=<osm-id> sets state.selectedPlaceId to the real id (imported-business ids are not UUIDs, e.g. osm:node/123)", () => {
  const result = runSyncStateFromUrl({ search: "?view=businessClaim&id=osm%3Anode%2F31453209", startingState: freshState() });
  assert.equal(result.activeView, "businessClaim");
  assert.equal(result.selectedPlaceId, "osm:node/31453209");
});

test("direct link ?view=liveOpportunityDetail&id=<uuid> sets state.selectedOpportunityId to the real id", () => {
  const result = runSyncStateFromUrl({ search: `?view=liveOpportunityDetail&id=${REAL_UUID}`, startingState: freshState() });
  assert.equal(result.activeView, "liveOpportunityDetail");
  assert.equal(result.selectedOpportunityId, REAL_UUID);
});

test("direct link ?view=eventDetail&id=<id> sets state.selectedEventId to the real id", () => {
  const result = runSyncStateFromUrl({ search: "?view=eventDetail&id=summer-food-courtyard", startingState: freshState() });
  assert.equal(result.activeView, "eventDetail");
  assert.equal(result.selectedEventId, "summer-food-courtyard");
});

test("direct link ?view=publicProfile&id=<uuid> calls openPublicProfileById with the real id — never opened via any other path", () => {
  const state = freshState();
  const calls = [];
  const openUserProfileCalls = [];
  const body = [
    extractConst(main, "DEEP_LINK_VIEWS"),
    extractConst(main, "ID_LINKED_VIEWS"),
    extractConst(main, "INTERNAL_URL_VIEWS"),
    "function orderedCategoryIds() { return []; }",
    extractFunction(main, "resetToHomeFromUrl"),
    extractFunction(main, "syncOpportunityFilterFromUrl"),
    extractFunction(main, "syncStateFromUrl"),
    "function openUserProfile(id) { openUserProfileCalls.push(id); }",
    "function openPublicProfileById(id) { calls.push(id); }",
    "syncStateFromUrl();"
  ].join("\n");
  const fn = new Function("state", "window", "calls", "openUserProfileCalls", body);
  fn(state, { location: { pathname: "/", search: `?view=publicProfile&id=${REAL_UUID}`, hash: "" } }, calls, openUserProfileCalls);
  assert.deepEqual(calls, [REAL_UUID]);
  assert.equal(openUserProfileCalls.length, 0);
});

test("direct link /profile/:handle (path-based, the real SPA-fallback URL) calls openUserProfile with the decoded handle, not openPublicProfileById", () => {
  const state = freshState();
  const openPublicProfileByIdCalls = [];
  const calls = [];
  const body = [
    extractConst(main, "DEEP_LINK_VIEWS"),
    extractConst(main, "ID_LINKED_VIEWS"),
    extractConst(main, "INTERNAL_URL_VIEWS"),
    "function orderedCategoryIds() { return []; }",
    extractFunction(main, "resetToHomeFromUrl"),
    extractFunction(main, "syncOpportunityFilterFromUrl"),
    extractFunction(main, "syncStateFromUrl"),
    "function openUserProfile(id) { calls.push(id); }",
    "function openPublicProfileById(id) { openPublicProfileByIdCalls.push(id); }",
    "syncStateFromUrl();"
  ].join("\n");
  const fn = new Function("state", "window", "calls", "openPublicProfileByIdCalls", body);
  fn(state, { location: { pathname: "/profile/kalandar_n", search: "", hash: "" } }, calls, openPublicProfileByIdCalls);
  assert.deepEqual(calls, ["kalandar_n"]);
  assert.equal(openPublicProfileByIdCalls.length, 0);
});

/* ---------------------------------------------------------------------
   2. Missing/absent id on an ID_LINKED_VIEWS view is a safe no-op, not a
      crash or a silently-wrong state.
--------------------------------------------------------------------- */

test("?view=listingDetail with no id param sets activeView but leaves selectedListingId untouched — never crashes, never fabricates a ghost id", () => {
  const result = runSyncStateFromUrl({ search: "?view=listingDetail", startingState: freshState() });
  assert.equal(result.activeView, "listingDetail");
  assert.equal(result.selectedListingId, null);
});

/* ---------------------------------------------------------------------
   3. A view NOT in ID_LINKED_VIEWS never reads the id param even if one
      is present — e.g. a stray ?id= on a plain ?view=marketplace link
      must not leak into any selected-id field.
--------------------------------------------------------------------- */

test("?view=marketplace&id=<uuid> (marketplace is not id-linked) ignores the id entirely — no selected-id field is set from it", () => {
  const result = runSyncStateFromUrl({ search: `?view=marketplace&id=${REAL_UUID}`, startingState: freshState() });
  assert.equal(result.activeView, "marketplace");
  assert.equal(result.selectedListingId, null);
  assert.equal(result.selectedPlaceId, null);
  assert.equal(result.selectedOpportunityId, null);
  assert.equal(result.selectedEventId, null);
});

/* ---------------------------------------------------------------------
   4. Deleted routes (Phase 2's businesses/reservations/businessProfile)
      are not in DEEP_LINK_VIEWS and cannot be restored by a stale link —
      they fall back to Home like any other unrecognised view.
--------------------------------------------------------------------- */

test("stale links to deleted routes (businesses, reservations, businessProfile) fall back to Home, never resurrect the deleted view", () => {
  for (const staleView of ["businesses", "reservations", "businessProfile"]) {
    const result = runSyncStateFromUrl({ search: `?view=${staleView}`, startingState: { ...freshState(), activeView: "hire" } });
    assert.equal(result.activeView, "home", `?view=${staleView} must fall back to home, not stay on the previous view or restore ${staleView}`);
  }
});

/* ---------------------------------------------------------------------
   5. The internal Ops/city-import URLs still work (direct URL only, by
      design — see DEEP_LINK_VIEWS' own comment) without being restorable
      through the public DEEP_LINK_VIEWS registry.
--------------------------------------------------------------------- */

test("INTERNAL_URL_VIEWS (ops, cityImport) are restorable by direct URL but are not members of DEEP_LINK_VIEWS — never advertised as a shareable/public link", () => {
  const deepLinkViews = extractConst(main, "DEEP_LINK_VIEWS");
  const internalUrlViews = extractConst(main, "INTERNAL_URL_VIEWS");
  assert.doesNotMatch(deepLinkViews, /"ops"/);
  assert.doesNotMatch(deepLinkViews, /"cityImport"/);
  assert.match(internalUrlViews, /"ops"/);
  assert.match(internalUrlViews, /"cityImport"/);
  const result = runSyncStateFromUrl({ search: "?view=ops", startingState: freshState() });
  assert.equal(result.activeView, "ops");
});

/* ---------------------------------------------------------------------
   6. Auth callback route preservation — an auth error/callback param is
      resolved to the auth view before any view-based routing runs, and
      is not lost to the Home-fallback branch.
--------------------------------------------------------------------- */

test("an auth callback error param takes priority over view routing — never silently discarded on the fallback branch", () => {
  const result = runSyncStateFromUrl({ search: "?error=access_denied&error_description=Email+link+is+invalid+or+has+expired", startingState: freshState() });
  assert.equal(result.activeView, "auth");
  assert.equal(result.auth.authView, "login");
  assert.ok(result.auth.authError);
});

/* ---------------------------------------------------------------------
   7. Legal path routes (real, static /terms /privacy /cookies /safety
      pages, served via the SPA fallback) still resolve correctly and are
      not affected by any id-dispatch change.
--------------------------------------------------------------------- */

test("legal path routes resolve to their view with no id involved, unaffected by the ID_LINKED_VIEWS id-dispatch", () => {
  for (const [path, expectedView] of [["/terms", "legalTerms"], ["/privacy", "legalPrivacy"], ["/cookies", "legalCookies"], ["/safety", "legalSafety"]]) {
    const result = runSyncStateFromUrl({ pathname: path, startingState: freshState() });
    assert.equal(result.activeView, expectedView, `${path} must resolve to ${expectedView}`);
  }
});
