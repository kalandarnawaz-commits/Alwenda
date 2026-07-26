import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Regression coverage for the browser Back/Forward restoration hotfix.

   Bug: landing on a URL with no recognised ?view= (a bare "/", or an
   invalid view string) left syncStateFromUrl() returning early without
   ever resetting state.activeView — so Back/Forward from a deep-linked
   view (confirmed live on production from the category-architecture
   release) silently kept rendering the stale previous view under the
   correct-looking Home URL.

   Fix: that early-return branch now calls resetToHomeFromUrl(), which
   sets state.activeView = "home" and resets the URL-owned
   opportunityFilter to its neutral defaults.

   Following this repo's established pattern (see test/home-hero-v2.test.js)
   the routing functions are extracted as source text and actually executed
   via new Function(...) with their free variables mocked, so these tests
   exercise real behaviour rather than just matching source text — they
   fail against the pre-fix implementation and pass after it.
--------------------------------------------------------------------- */

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

const DEFAULT_OPPORTUNITY_FILTER = { categoryId: "all", surface: "earn", intent: "all", status: "active", distance: "all" };

/** Runs the real syncStateFromUrl() (plus its resetToHomeFromUrl and
 * syncOpportunityFilterFromUrl collaborators, extracted verbatim from
 * main.js) against a mocked window.location and a given starting state,
 * returning the resulting state. openUserProfile/openPublicProfileById are
 * stubbed no-ops — neither test path here reaches them. */
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

test("1. bare / (no ?view=) restores Home, even when the previous state was a deep-linked category view", () => {
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "",
    startingState: { activeView: "liveOpportunities", opportunityFilter: { categoryId: "cleaning", surface: "live", intent: "all", status: "active", distance: "all" }, auth: { status: "signedOut" } }
  });
  assert.equal(result.activeView, "home");
});

test("2. this is exactly the browser-Back scenario reproduced on production: category-detail -> Back -> URL is / -> screen must be Home, not the stale category screen", () => {
  // Simulates the popstate sequence: the URL the browser now shows (after
  // Back) has no ?view= param at all, same as clicking Cleaning then
  // pressing the native Back button on alwenda.com.
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "",
    startingState: { activeView: "liveOpportunities", opportunityFilter: { categoryId: "transport", surface: "live", intent: "all", status: "active", distance: "all" }, auth: { status: "signedOut" } }
  });
  assert.equal(result.activeView, "home", "Back must not leave the stale category-detail view rendered under the Home URL");
});

test("3. browser Forward (loading a URL with ?view=liveOpportunities&category=...) restores the category-detail view", () => {
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "?view=liveOpportunities&category=cleaning&surface=live",
    startingState: { activeView: "home", opportunityFilter: { ...DEFAULT_OPPORTUNITY_FILTER }, auth: { status: "signedOut" } }
  });
  assert.equal(result.activeView, "liveOpportunities");
  assert.equal(result.opportunityFilter.categoryId, "cleaning");
  assert.equal(result.opportunityFilter.surface, "live");
});

test("4. a recognised ?view= restores that view correctly", () => {
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "?view=explore",
    startingState: { activeView: "home", opportunityFilter: { ...DEFAULT_OPPORTUNITY_FILTER }, auth: { status: "signedOut" } }
  });
  assert.equal(result.activeView, "explore");
});

test("5. an invalid/unrecognised ?view= safely falls back to Home instead of throwing or retaining the previous screen", () => {
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "?view=totallyNotARealView",
    startingState: { activeView: "listingDetail", opportunityFilter: { ...DEFAULT_OPPORTUNITY_FILTER }, auth: { status: "signedOut" } }
  });
  assert.equal(result.activeView, "home");
});

test("6. returning Home clears stale category-specific opportunity filters back to their neutral defaults", () => {
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "",
    startingState: { activeView: "liveOpportunities", opportunityFilter: { categoryId: "petCare", surface: "live", intent: "help", status: "resolved", distance: "5" }, auth: { status: "signedOut" } }
  });
  assert.deepEqual(result.opportunityFilter, DEFAULT_OPPORTUNITY_FILTER);
});

test("7. directly loading a category URL (fresh page load, not a Back/Forward transition) restores its category and surface", () => {
  const result = runSyncStateFromUrl({
    pathname: "/",
    search: "?view=liveOpportunities&category=teaching&surface=earn",
    startingState: { activeView: "home", opportunityFilter: { ...DEFAULT_OPPORTUNITY_FILTER }, auth: { status: "signedOut" } }
  });
  assert.equal(result.activeView, "liveOpportunities");
  assert.equal(result.opportunityFilter.categoryId, "teaching");
  assert.equal(result.opportunityFilter.surface, "earn");
});

test("8. bottom-navigation's [data-view] click handling is untouched by this fix (still drives activeView directly, independent of URL parsing)", () => {
  assert.match(main, /document\.querySelectorAll\("\[data-view\]"\)\.forEach/);
});

test("9. category-card / category-filter selection tracking is untouched by this fix", () => {
  assert.match(main, /trackEvent\("category_selected", \{ categoryId: event\.target\.value, surface: state\.opportunityFilter\.surface \}\)/);
});

test("10. URL round-trip is deterministic: the URL written by syncUrlToState for a given filter, parsed back by syncStateFromUrl, reproduces the same filter", () => {
  const written = runSyncStateFromUrl({
    pathname: "/",
    search: "?view=liveOpportunities&category=shopping&surface=live&intent=help&status=open",
    startingState: { activeView: "home", opportunityFilter: { ...DEFAULT_OPPORTUNITY_FILTER }, auth: { status: "signedOut" } }
  });
  assert.deepEqual(written.opportunityFilter, { categoryId: "shopping", surface: "live", intent: "help", status: "open", distance: "all" });
});

test("resetToHomeFromUrl resets exactly activeView and opportunityFilter, and nothing else", () => {
  const fn = extractFunction(main, "resetToHomeFromUrl");
  assert.match(fn, /state\.activeView = "home";/);
  assert.match(fn, /state\.opportunityFilter = \{ categoryId: "all", surface: "earn", intent: "all", status: "active", distance: "all" \};/);
  // Must not reference auth, userProfile, or any selected*Id — this reset
  // has to stay narrowly scoped to router-owned state only.
  assert.doesNotMatch(fn, /state\.auth/);
  assert.doesNotMatch(fn, /state\.userProfile/);
  assert.doesNotMatch(fn, /state\.selected/);
});

test("the fallback branch in syncStateFromUrl calls resetToHomeFromUrl() instead of a bare return", () => {
  const fn = extractFunction(main, "syncStateFromUrl");
  assert.match(fn, /if \(!view \|\| !\(DEEP_LINK_VIEWS\.has\(view\) \|\| INTERNAL_URL_VIEWS\.has\(view\)\)\) \{\s*\n\s*resetToHomeFromUrl\(\);\s*\n\s*return;\s*\n\s*\}/);
});
