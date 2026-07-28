import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 5 of the mock-data-removal plan: Need Help's "Live Requests"
   list converted from the mock helpRequests fixture to production-only
   data (state.opportunityFeed.helpRequests + state.myHelpRequests,
   merged/deduped through the new helpRequestPool()). Following this
   repo's established convention (see test/community-real-only.test.js,
   test/home-feed.test.js): small pure-data functions are extracted as
   source text and actually executed via new Function(...); render/
   write-path functions with a large DOM/i18n/network dependency tree
   are asserted on structurally instead.

   The separate, already-real "premium opportunity card" system
   (renderRealOpportunityCard, shapeHelpRequestOpportunityForDisplay,
   resolveHelpRequestImage, category imagery, public-profile connectors —
   see test/help-request-profile-connectors.test.js) is a distinct data
   path over the same state.opportunityFeed.helpRequests cache and is
   deliberately NOT touched by this phase; a couple of guard tests below
   confirm it stays intact. */

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

function extractEventListenerCall(source, markerText) {
  const markerStart = source.indexOf(markerText);
  assert.ok(markerStart !== -1, `marker "${markerText}" must exist`);
  const braceStart = source.indexOf("{", markerStart);
  assert.ok(braceStart !== -1, `no opening brace found after marker "${markerText}"`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(markerStart, i + 1);
    }
  }
  throw new Error(`unterminated block after marker "${markerText}"`);
}

let main;
let mockData;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  mockData = await readRepoFile("src/data/mockData.js");
});

/* ---------------------------------------------------------------------
   1. mockData.js no longer exports the fixture.
--------------------------------------------------------------------- */

test("mockData.js no longer exports helpRequests", () => {
  assert.doesNotMatch(mockData, /export const helpRequests/);
});

test("main.js no longer imports helpRequests from mockData", () => {
  const importEnd = main.indexOf('from "./data/mockData.js');
  assert.ok(importEnd !== -1, "mockData import must still exist for other consumers");
  const importBlock = main.slice(0, importEnd);
  assert.doesNotMatch(importBlock, /\bhelpRequests\b/);
});

/* ---------------------------------------------------------------------
   2. helpRequestPool() merges the current user's own real requests with
      the public real feed, deduplicated by real id, own pool first.
--------------------------------------------------------------------- */

function runHelpRequestPool(myHelpRequests, feedHelpRequests) {
  const professionalCategories = [];
  const city = { name: "Vilnius" };
  const HELP_URGENCY_OPTIONS = [["flexible", "needHelp.urgencyFlexible"]];
  const state = { myHelpRequests, opportunityFeed: { helpRequests: feedHelpRequests } };
  const t = (key) => key;
  const body = [
    extractFunction(main, "shapeHelpRequestForDisplay"),
    extractFunction(main, "helpRequestPool"),
    "return helpRequestPool();"
  ].join("\n");
  const fn = new Function("professionalCategories", "city", "HELP_URGENCY_OPTIONS", "state", "t", body);
  return fn(professionalCategories, city, HELP_URGENCY_OPTIONS, state, t);
}

test("helpRequestPool includes the current user's own real request even when the public feed hasn't caught up yet", () => {
  const own = [{ id: "own-1", description: "Assemble a wardrobe", area: "Užupis", status: "open", category: "moving" }];
  const pool = runHelpRequestPool(own, []);
  assert.equal(pool.length, 1);
  assert.equal(pool[0].id, "own-1");
  assert.equal(pool[0].title, "Assemble a wardrobe");
});

test("helpRequestPool deduplicates by real id — a request already in the user's own pool is not duplicated from the public feed", () => {
  const shared = { id: "shared-uuid", description: "Deep clean apartment", area: "Žvėrynas", status: "open", category: "cleaning" };
  const pool = runHelpRequestPool([shared], [shared, { id: "other-uuid", description: "Airport pickup", area: "Naujamiestis", status: "open", category: "transport" }]);
  const ids = pool.map((item) => item.id);
  assert.deepEqual(ids, ["shared-uuid", "other-uuid"], "own pool wins for the shared id, public feed contributes only the genuinely new one");
});

test("helpRequestPool returns real production ids untouched, never manufactured placeholder ids", () => {
  const pool = runHelpRequestPool([], [{ id: "3f6a2e10-uuid-example", description: "Translate a document", area: "Senamiestis", status: "open", category: "translation" }]);
  assert.equal(pool[0].id, "3f6a2e10-uuid-example");
});

/* ---------------------------------------------------------------------
   3. filteredHelpRequests()/renderHelpRequest() never fall back to a
      mock fixture and never fabricate engagement (pro-response quotes).
--------------------------------------------------------------------- */

test("filteredHelpRequests reads from helpRequestPool(), never from a mock fixture", () => {
  const fn = extractFunction(main, "filteredHelpRequests");
  assert.match(fn, /helpRequestPool\(\)/);
  assert.doesNotMatch(fn, /\bhelpRequests\.(filter|find|map)/);
});

test("renderHelpRequest exposes no fabricated pro-response quotes and no dead mock-fallback branches", () => {
  const fn = extractFunction(main, "renderHelpRequest");
  assert.doesNotMatch(fn, /\.quotes\b/);
  assert.doesNotMatch(fn, /titleKey|urgencyKey|statusKey/);
  assert.match(fn, /request\.urgency/);
  assert.match(fn, /request\.title/);
  assert.match(fn, /request\.status/);
});

test("shapeHelpRequestForDisplay no longer produces a quotes field — there is no real pro-response/quote concept", () => {
  const fn = extractFunction(main, "shapeHelpRequestForDisplay");
  assert.doesNotMatch(fn, /quotes/);
});

test("budget stays an honest, permanent null (help_requests has no budget column) rather than a fabricated figure", () => {
  const fn = extractFunction(main, "shapeHelpRequestForDisplay");
  assert.match(fn, /budget: null/);
});

/* ---------------------------------------------------------------------
   4. Loading / error / zero-record / loaded states on Need Help's Live
      Requests section, all sharing state.opportunityFeed — no second
      cache, no per-render refetch.
--------------------------------------------------------------------- */

test("renderNeedHelp triggers refreshOpportunityFeed only from idle, the same shared cache Marketplace/Home already use", () => {
  const fn = extractFunction(main, "renderNeedHelp");
  assert.match(fn, /state\.opportunityFeed\.status === "idle"\) refreshOpportunityFeed\(\)/);
});

test("renderNeedHelpLiveRequestsSection shows a loading skeleton for idle/loading, an honest retryable error state, and never falls back to fixture content", () => {
  const fn = extractFunction(main, "renderNeedHelpLiveRequestsSection");
  assert.match(fn, /state\.opportunityFeed\.status === "idle" \|\| state\.opportunityFeed\.status === "loading"/);
  assert.match(fn, /profile-listing-grid-loading/);
  assert.match(fn, /state\.opportunityFeed\.status === "error"/);
  assert.match(fn, /data-action="retry-opportunity-feed"/);
  assert.doesNotMatch(fn, /LIVE_OPPORTUNITIES|fixtureOpportunitiesForSurface/, "must never fall back to fixture/demo content on a genuine failure or empty state");
});

test("retry-opportunity-feed handler re-triggers the same shared refresh — no separate retry mechanism was invented for Need Help", () => {
  const handler = extractEventListenerCall(main, 'document.querySelectorAll(\'[data-action="retry-opportunity-feed"]\')');
  assert.match(handler, /refreshOpportunityFeed\(\)/);
});

test("refreshOpportunityFeed's own re-render trigger includes needHelp and community — without these, the fetch resolves but their pages never re-render (caught live: Need Help's loading skeleton hung forever, and Community's own embedded Live Requests preview silently stayed empty on a direct-link landing, until these views were added)", () => {
  const fn = extractFunction(main, "refreshOpportunityFeed");
  assert.match(fn, /\["home", "liveOpportunities", "needHelp", "community"\]\.includes\(state\.activeView\)\) render\(\)/);
});

test("renderCommunity also idle-guards state.opportunityFeed — its own embedded Live Requests preview reads the same real filteredHelpRequests() now, so it needs the same trigger Need Help/Marketplace already have", () => {
  const fn = extractFunction(main, "renderCommunity");
  assert.match(fn, /state\.opportunityFeed\.status === "idle"\) refreshOpportunityFeed\(\)/);
});

test("zero-request empty state renders the exact requested copy and reuses the existing composer as its CTA — no second form", () => {
  const fn = extractFunction(main, "renderNeedHelpLiveRequestsSection");
  assert.match(fn, /renderEmptyState\(t\("needHelp\.needHelpTitle"\)/);
  assert.match(fn, /t\("needHelp\.emptyRequestsHint"\)/);
  assert.match(fn, /data-action="focus-help-request-composer"/);
});

test("needHelp.needHelpTitle/emptyRequestsHint locale copy matches the requested strings, in every shipped locale", async () => {
  for (const locale of ["en", "lt", "de"]) {
    const json = JSON.parse(await readRepoFile(`locales/${locale}.json`));
    assert.ok(json.needHelp.needHelpTitle, `${locale} must define needHelp.needHelpTitle`);
    assert.ok(json.needHelp.emptyRequestsHint, `${locale} must define needHelp.emptyRequestsHint`);
  }
  const en = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(en.needHelp.needHelpTitle, "Need Help?");
  assert.equal(en.needHelp.emptyRequestsHint, "No requests have been posted nearby yet. Be the first to ask your community.");
});

test("focus-help-request-composer handler reuses the existing inline composer (need-help-composer), never opening a second form", () => {
  const handler = extractEventListenerCall(main, 'document.querySelectorAll(\'[data-action="focus-help-request-composer"]\')');
  assert.match(handler, /getElementById\("need-help-composer"\)/);
  assert.match(handler, /\.focus\(\)/);
});

/* ---------------------------------------------------------------------
   5. Real write path — createHelpRequest already exists; this phase
      only verifies applyCreatedHelpRequest/refreshMyHelpRequests no
      longer mutate the deleted mock array, and that submission stays
      auth-gated.
--------------------------------------------------------------------- */

test("applyCreatedHelpRequest updates state.myHelpRequests directly — the mock array mutation is gone", () => {
  const fn = extractFunction(main, "applyCreatedHelpRequest");
  assert.doesNotMatch(fn, /\bhelpRequests\.unshift/);
  assert.match(fn, /state\.myHelpRequests\.unshift\(created\)/);
  assert.match(fn, /shapeHelpRequestForDisplay\(created\)/);
});

test("refreshMyHelpRequests wholesale-replaces state.myHelpRequests from the real fetch, with no leftover mock-array sync loop", () => {
  const fn = extractFunction(main, "refreshMyHelpRequests");
  assert.match(fn, /state\.myHelpRequests = await fetchMyHelpRequests\(\)/);
  assert.doesNotMatch(fn, /\bhelpRequests\.(unshift|some)/);
});

test("submitHelpRequest gates on auth before calling the real createHelpRequest — unauthenticated composer never reaches the network", () => {
  const start = main.indexOf("async function submitHelpRequest()");
  assert.ok(start !== -1, "submitHelpRequest must exist");
  const fn = extractFunction(main, "submitHelpRequest");
  assert.match(fn, /if \(state\.auth\.status !== "signedIn"\)/);
  assert.match(fn, /t\("needHelp\.signInToPost"\)/);
  const authGateIndex = fn.search(/if \(state\.auth\.status !== "signedIn"\)/);
  const createCallIndex = fn.indexOf("await createHelpRequest(");
  assert.ok(authGateIndex !== -1 && createCallIndex !== -1 && authGateIndex < createCallIndex, "the auth gate must run before the real network call");
});

/* ---------------------------------------------------------------------
   6. The separate, already-real "premium opportunity card" system
      (category imagery, public-profile connectors, detail navigation)
      stays untouched — this phase did not modify it.
--------------------------------------------------------------------- */

test("the premium real-opportunity-card system (category imagery, public-profile connectors, detail routing) still exists untouched", () => {
  for (const name of [
    "renderRealOpportunityCard",
    "shapeHelpRequestOpportunityForDisplay",
    "publicHelpRequestAuthor",
    "renderHelpRequestAuthorRow",
    "resolveHelpRequestImage",
    "renderRealHelpRequestDetail",
    "renderLiveOpportunityDetail"
  ]) {
    assert.match(main, new RegExp(`function ${name}\\(`), `${name} must still exist — Phase 5 does not touch the premium opportunity-card system`);
  }
});

test("realOpportunityRecordsForSurface still reads state.opportunityFeed.helpRequests directly — Phase 5 did not fork a second cache for it", () => {
  const fn = extractFunction(main, "realOpportunityRecordsForSurface");
  assert.match(fn, /state\.opportunityFeed/);
  assert.match(fn, /feed\.helpRequests/);
});
