import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 9M of the mock-data-removal plan: a single, consolidated
   "production honesty" regression suite. Phases 1-8 each guarded their
   own deletions in their own test files (community-real-only.test.js,
   help-requests-real-only.test.js, hire-honest-empty-state.test.js,
   search-real-data-cleanup.test.js, repository-cleanup.test.js, etc.) —
   this file is a second, independent line of defence: one place that
   greps the whole repository for every symbol/pattern this migration
   removed, so a future change can't silently reintroduce fabricated
   user-visible content without at least one test noticing, even if the
   phase-specific test file that originally caught it is ever weakened
   or deleted.

   This file distinguishes:
   - deleted mock arrays/functions that must never come back (checked
     against the whole file — main.js AND mockData.js)
   - legitimate static taxonomy/configuration that looks similar but is
     not fabricated entity data (categories, capability labels, static
     professional-category chip list, imported real business fields)
   - developer/internal-only content that is real production code but
     not customer-facing (Ops/city-import dashboard)
   It does not re-litigate every individual Phase 4-7 assertion — see
   this phase's own report for the full cross-reference. */

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

let main;
let mockData;
let en;
let lt;
let de;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  mockData = await readRepoFile("src/data/mockData.js");
  en = JSON.parse(await readRepoFile("locales/en.json"));
  lt = JSON.parse(await readRepoFile("locales/lt.json"));
  de = JSON.parse(await readRepoFile("locales/de.json"));
});

/* ---------------------------------------------------------------------
   1. Deleted mock arrays never come back, in either file.
--------------------------------------------------------------------- */

const DELETED_MOCK_ARRAYS = [
  "serviceProfessionals",
  "feedPosts",
  "helpRequests", // the deleted mock array specifically — real state.opportunityFeed.helpRequests/helpRequestPool() are unaffected by this check, see #2
  "businesses",
  "offers",
  "reservations",
  "reputationProfile",
  "profileReviews",
  "alwenListingDraft",
  "alwenBusinessDraft"
];

test("no deleted mock array is exported from mockData.js", () => {
  for (const name of DELETED_MOCK_ARRAYS) {
    assert.doesNotMatch(mockData, new RegExp(`export const ${name}\\b`), `mockData.js must not re-export ${name}`);
  }
});

test("main.js never imports a deleted mock array from mockData.js", () => {
  const importEnd = main.indexOf('from "./data/mockData.js');
  const importBlock = main.slice(0, importEnd);
  for (const name of DELETED_MOCK_ARRAYS) {
    assert.doesNotMatch(importBlock, new RegExp(`\\b${name}\\b`), `main.js must not import ${name}`);
  }
});

/* ---------------------------------------------------------------------
   2. Real, still-live state that shares a word with a deleted array is
      correctly distinguished — this check exists so #1's helpRequests
      entry can't accidentally be satisfied by deleting the real
      opportunityFeed.helpRequests state field instead of the mock array.
--------------------------------------------------------------------- */

test("state.opportunityFeed.helpRequests (the real cache field, unrelated to the deleted mock array) is still present and real", () => {
  assert.match(main, /opportunityFeed: \{ status: "idle", helpRequests: \[\], listings: \[\], loadedAt: null \}/);
  assert.match(main, /function helpRequestPool\(/);
  assert.match(main, /fetchOpenHelpRequests/);
});

/* ---------------------------------------------------------------------
   3. Deleted render/helper functions never come back.
--------------------------------------------------------------------- */

const DELETED_FUNCTIONS = [
  "renderBusinesses",
  "renderBusinessProfile",
  "renderReservations",
  "renderListings",
  "renderAlwenListingCreator",
  "renderAlwenBusinessCreator",
  "renderProfessional",
  "renderProCard",
  "hireCategoryMatches",
  "startProfessionalConversation",
  "filteredProfessionals",
  "hireCategoryForQuery",
  "filteredBusinesses"
];

test("no deleted render/helper function is defined anywhere in main.js", () => {
  for (const name of DELETED_FUNCTIONS) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`), `${name} must not be redefined`);
  }
});

/* ---------------------------------------------------------------------
   4. No fabricated engagement/trust signals on real entities. Each
      pattern below is checked in the specific function known to render
      that entity type, not as a blanket file-wide ban — real,
      legitimate uses of "rating" (imported businesses, which do have
      genuine third-party ratings) live in different functions and are
      explicitly exempted.
--------------------------------------------------------------------- */

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return null;
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
  if (paramsEnd === -1) return null;
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
  if (bodyStart === -1 || bodyEnd === -1) return null;
  return source.slice(start, bodyEnd + 1);
}

test("real Community post cards never render a helpful/reply/save counter — those toggles are non-durable local state, never a fabricated engagement number", () => {
  const fn = extractFunction(main, "renderCommunityPostCard");
  assert.ok(fn, "renderCommunityPostCard must exist");
  assert.doesNotMatch(fn, /\.helpful\b|\.replies\b|\.saves\b/);
});

test("real Marketplace listing cards never render a fabricated popularity/aiPrice/aiInsight value — those fields are always empty strings from the shapers, so the card must not format them as if genuine", () => {
  const fn = extractFunction(main, "renderMarketplaceListing");
  assert.ok(fn, "renderMarketplaceListing must exist");
  assert.doesNotMatch(fn, /item\.popularity \+|item\.aiPrice \+|item\.aiInsight \+/);
});

test("both real Help Request card renderers (Need Help's premium opportunity card and Community's embedded preview) never render a fabricated quote count or response count", () => {
  for (const name of ["renderRealOpportunityCard", "renderHelpRequest"]) {
    const fn = extractFunction(main, name);
    assert.ok(fn, `${name} must exist`);
    assert.doesNotMatch(fn, /\.quotes\b|\.responseCount\b|quotesReceived/);
  }
});

/* ---------------------------------------------------------------------
   5. mockData.js's current 17 exports are all accounted for as one of:
      static taxonomy/config, real imported data, or internal-only
      Ops-dashboard content — never fabricated user-visible entity data.
      This is the positive-list complement to #1's negative list.
--------------------------------------------------------------------- */

const ALLOWED_MOCKDATA_EXPORTS = new Set([
  "city", // static Vilnius identity config
  "categories", // static Marketplace category taxonomy
  "marketplaceCapabilities", // static capability-pill labels
  "importSources", // internal Ops/city-import dashboard only
  "importedBusinesses", // real OSM/Wikidata import pipeline
  "businessClaims", // internal Ops dashboard; real claims unshift in at runtime
  "cityGraph", // internal Ops dashboard summary numbers
  "neighbourhoods", // static Vilnius neighbourhood list
  "COMMUNITY_POST_TYPES", // static post-type taxonomy
  "livingCitySignals", // static label config for Home's real-count row
  "liveAroundYou", // Home-rail content, out of this migration's scope
  "earnToday", // Home-rail content, out of this migration's scope
  "professionalCategories", // static Hire category taxonomy (Phase 6 confirmed real)
  "notifications", // real, live Notification Centre feature, deferred conversion
  "NOTIFICATION_FILTERS", // static filter taxonomy
  "messageThreads", // real, live Inbox feature, deferred conversion
  "adminStats" // internal Ops dashboard only
]);

test("every mockData.js export is on the reviewed allow-list — a new export appearing here without updating this list is exactly the kind of silent reintroduction this suite exists to catch", () => {
  const names = [...mockData.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  assert.ok(names.length > 0);
  for (const name of names) {
    assert.ok(ALLOWED_MOCKDATA_EXPORTS.has(name), `mockData.js exports ${name}, which is not on the reviewed allow-list — classify it (static config / real data / internal-only / fabricated) and update this test`);
  }
});

test("the allow-list itself has no stale entries — every allowed name is still actually exported", () => {
  const names = new Set([...mockData.matchAll(/^export const (\w+)/gm)].map((m) => m[1]));
  for (const name of ALLOWED_MOCKDATA_EXPORTS) {
    assert.ok(names.has(name), `${name} is on the allow-list but mockData.js no longer exports it — remove it from the list`);
  }
});

/* ---------------------------------------------------------------------
   6. No fabricated ranking language ("Top", "Recommended", "Popular",
      "Trending", "Best rated") appears attached to a search/match result
      without a real basis — Search (Phase 7) and Alwen's structured
      results are the surfaces this migration made honest.
--------------------------------------------------------------------- */

test("renderMatch (topMatches' result renderer) and renderAlwenStructuredResultMessage never render a fabricated ranking label", () => {
  for (const name of ["renderMatch", "renderAlwenStructuredResultMessage"]) {
    const fn = extractFunction(main, name);
    assert.ok(fn, `${name} must exist`);
    assert.doesNotMatch(fn, /\bTop match\b|\bRecommended\b|\bPopular\b|\bTrending\b|\bBest rated\b|\bHighly rated\b/i);
  }
});

/* ---------------------------------------------------------------------
   7. Locale files carry no leftover mock-content namespace.
--------------------------------------------------------------------- */

test("no locale carries a mock.biz/offer/repProfile/listing/review namespace (Phase 8's removal stays removed)", () => {
  for (const [name, dict] of [["en", en], ["lt", lt], ["de", de]]) {
    const mock = dict.mock || {};
    for (const ns of ["biz", "offer", "repProfile", "listing", "review"]) {
      assert.equal(mock[ns], undefined, `locales/${name}.json regained mock.${ns}`);
    }
  }
});

/* ---------------------------------------------------------------------
   8. Phase 9 defect: every notification's primaryActionView must point
      at a real, currently-routable view. notif3 ("Dinner for six can be
      confirmed... Confirm") still pointed at "reservations" — deleted in
      Phase 2 — so clicking its Confirm button silently redirected to
      Home (views[state.activeView]?.() || renderHome() in renderView())
      instead of doing anything related to the notification. Not a
      crash, but a dangling reference to a deleted route reintroducing
      exactly the kind of stale-route debris this migration removes
      elsewhere. Found via this phase's own "grep for deleted mock
      symbols" validation step. */

test("every notification's primaryActionView (and messageThreads context routing, same shape) points at a view that is still in DEEP_LINK_VIEWS or INTERNAL_URL_VIEWS — no dangling reference to a route deleted earlier in this migration", () => {
  const deepLinkViewsMatch = main.match(/const DEEP_LINK_VIEWS = new Set\(\[([\s\S]*?)\]\);/);
  const internalUrlViewsMatch = main.match(/const INTERNAL_URL_VIEWS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(deepLinkViewsMatch && internalUrlViewsMatch, "DEEP_LINK_VIEWS/INTERNAL_URL_VIEWS must exist");
  const deepLinkViews = new Set(deepLinkViewsMatch[1].match(/"[\w]+"/g).map((s) => s.slice(1, -1)));
  const internalUrlViews = new Set(internalUrlViewsMatch[1].match(/"[\w]+"/g).map((s) => s.slice(1, -1)));
  const allowedViews = new Set([...deepLinkViews, ...internalUrlViews]);
  const primaryActionViews = [...mockData.matchAll(/primaryActionView: "([\w]+)"/g)].map((m) => m[1]);
  assert.ok(primaryActionViews.length > 0, "expected at least one primaryActionView in the notifications fixture");
  for (const view of primaryActionViews) {
    assert.ok(allowedViews.has(view), `notifications' primaryActionView: "${view}" is not a real, routable view — it will silently fall back to Home when clicked`);
  }
});
