import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Home screen redesign: AI Hero -> Live Around You (premium single-card
   carousel) -> Unified Home Feed (real Marketplace + Community only).

   Following this repo's established pattern (see test/home-hero-v2.test.js,
   test/browser-history-restoration.test.js): pure data functions with a
   small, reconstructable dependency tree (buildUnifiedHomeFeed,
   findCommunityPostById, shapeCommunityPostForDisplay) are extracted as
   source text and actually executed via new Function(...) with their free
   variable (state) mocked — real behavioural coverage, not just text
   matching. Render functions with a large DOM/i18n dependency
   tree (renderHomeFeedListingItem, renderHomeFeedCommunityItem,
   renderLiveAroundYou) are asserted on structurally instead.
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
const styles = await readRepoFile("src/styles.css");

const LEGACY_HOME_RAIL_FUNCTIONS = [
  "renderTrendingMarketplace",
  "renderEarnToday",
  "renderExploreHighlights",
  "renderEatingAroundYou",
  "renderNightlifeNearYou",
  "renderCareNearYou",
  "renderHealthcareNearYou",
  "renderPlacesToStay",
  "renderAttractionsNearYou",
  "renderBanksAtmsNearYou",
  "renderPublicServicesNearYou",
  "renderTransportNearYou",
  "renderGroceriesNearYou",
  "renderShopsAroundYou",
  "renderShoppingMallsNearYou",
  "renderBeautyWellnessNearYou",
  "renderHealthFitnessNearYou",
  "renderAutomobileNearYou",
  "renderFuelPetrolNearYou",
  "renderProfessionalsNearYou",
  "renderNeighbourhoodFeed",
  "renderAlwenRecommendations",
  "renderCategoryHubGrid",
  "renderCategoryHubCard"
];

/* ---------------------------------------------------------------------
   1 & 2. Home structure: exactly AI Hero + Live Around You + Unified Home
   Feed, and all legacy rails are gone.
--------------------------------------------------------------------- */

test("Home's assembled output is exactly AI hero + Live Around You + Unified Home Feed", () => {
  const homeFn = extractFunction(main, "renderHome");
  assert.match(homeFn, /\$\{renderLiveAroundYou\(\)\}/);
  assert.match(homeFn, /\$\{renderHomeFeed\(\)\}/);
  for (const name of LEGACY_HOME_RAIL_FUNCTIONS) {
    assert.doesNotMatch(homeFn, new RegExp(`${name}\\(`), `renderHome must no longer call ${name}`);
  }
});

test("all 19 legacy Home rail functions (plus their now-dead grid/card helpers) are fully removed, not just uncalled", () => {
  for (const name of LEGACY_HOME_RAIL_FUNCTIONS) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`), `function ${name} must be deleted, not just unused`);
  }
});

/* ---------------------------------------------------------------------
   3. Explore retains its discovery rails and shared place helpers.
--------------------------------------------------------------------- */

test("Explore's discovery rails and shared real-place helpers survive the Home rail cleanup", () => {
  for (const name of [
    "renderPlaceCardCompact",
    "renderPlaceCoverflowTrack",
    "renderExploreDiscoveryRail",
    "renderExploreDiscoveryRails",
    "renderLivingSection"
  ]) {
    assert.match(main, new RegExp(`function ${name}\\(`), `${name} must still exist — Explore depends on it`);
  }
  const discoveryRails = extractFunction(main, "renderExploreDiscoveryRails");
  assert.match(discoveryRails, /renderExploreDiscoveryRail\(/);
  // realPlacesByCategory/renderRealPlacesSection were the 15 deleted
  // "NearYou" Home rails' shared per-category wrapper — Explore's own
  // Discovery rails never called through it (they build directly on
  // renderPlaceCoverflowTrack with their own bespoke item lists), so once
  // every Home rail using it was removed, the wrapper itself became
  // genuinely dead code and was deleted too (confirmed via `npm run lint`
  // catching it as an unused function before this cleanup).
  assert.doesNotMatch(main, /function realPlacesByCategory\(/, "realPlacesByCategory must stay removed — it has no remaining caller");
  assert.doesNotMatch(main, /function renderRealPlacesSection\(/, "renderRealPlacesSection must stay removed — it has no remaining caller");
});

/* ---------------------------------------------------------------------
   4 & 5. Live Around You: horizontal scroll-snap carousel, final card
   reachable (centered snap + symmetric side padding, not a hard-clipped
   edge).
--------------------------------------------------------------------- */

test("the opportunity carousel uses native horizontal scroll-snap, not a CSS grid", () => {
  const shellRule = styles.match(/\.carousel-shell-opportunity \.carousel-track\.opportunity-rail\s*\{[^}]*\}/)[0];
  assert.match(shellRule, /scroll-snap-type:\s*x mandatory/);
  assert.match(shellRule, /scroll-padding-inline/);
  const cardRule = styles.match(/\.carousel-shell-opportunity \.carousel-track\.opportunity-rail > \*\s*\{[^}]*\}/)[0];
  assert.match(cardRule, /scroll-snap-align:\s*center/);
});

test("the final carousel card is reachable — centered snap-align with matching side padding lets it scroll fully into view instead of being clipped at the edge", () => {
  const shellRule = styles.match(/\.carousel-shell-opportunity \.carousel-track\.opportunity-rail\s*\{[^}]*\}/)[0];
  // Symmetric padding-inline + scroll-padding-inline on both the track and
  // its children is what lets the FIRST and LAST cards center under
  // scroll-snap-align, giving the "next card partially visible" peek on
  // both edges without ever clipping the final card off-screen.
  assert.match(shellRule, /padding:\s*4px 7vw 22px/);
  assert.match(shellRule, /scroll-padding-inline:\s*7vw/);
});

/* ---------------------------------------------------------------------
   6 & 7. Only categories with real activity render; one honest empty
   state, never a per-category zero tile or an empty section.
--------------------------------------------------------------------- */

test("Live Around You filters to only categories with genuine current activity", () => {
  const fn = extractFunction(main, "renderLiveAroundYou");
  assert.match(fn, /categoryHubIdsSortedByCount\("live"\)\.filter\(\(id\) => categoryHubCardSummary\(id, "live"\)\.count > 0\)/);
});

test("Live Around You renders one honest empty state when nothing is currently live, never an empty section", () => {
  const fn = extractFunction(main, "renderLiveAroundYou");
  assert.match(fn, /activeCategoryIds\.length\s*\?[\s\S]*?:\s*renderOpportunityCarouselEmptyState\(\)/);
});

/* ---------------------------------------------------------------------
   8. Mixed Marketplace + Community chronological ordering — actually
   executed, not just pattern-matched.
--------------------------------------------------------------------- */

function runBuildUnifiedHomeFeed(opportunityListings, communityPosts) {
  const state = { opportunityFeed: { listings: opportunityListings }, communityFeed: { posts: communityPosts } };
  const body = [
    extractConst(main, "HOME_FEED_SOURCE_ADAPTERS"),
    extractFunction(main, "buildUnifiedHomeFeed"),
    "return buildUnifiedHomeFeed();"
  ].join("\n");
  const fn = new Function("state", body);
  return fn(state);
}

test("buildUnifiedHomeFeed merges Marketplace + Community and sorts strictly by descending real timestamp, regardless of source", () => {
  const listings = [
    { id: "listing-old", created_at: "2026-01-01T00:00:00Z" },
    { id: "listing-newest", created_at: "2026-01-05T00:00:00Z" }
  ];
  const posts = [
    { id: "post-middle", createdAt: "2026-01-03T00:00:00Z" },
    { id: "post-oldest", createdAt: "2025-12-01T00:00:00Z" }
  ];
  const items = runBuildUnifiedHomeFeed(listings, posts);
  assert.deepEqual(
    items.map((item) => item.id),
    ["listing-newest", "post-middle", "listing-old", "post-oldest"]
  );
  // Source type is preserved on every merged item, so the renderer can
  // dispatch to the right card without re-inspecting shape.
  assert.deepEqual(items.map((item) => item.type), ["marketplace", "community", "marketplace", "community"]);
});

test("buildUnifiedHomeFeed returns an empty array when both real sources are empty — no fixture fallback exists to fill it", () => {
  assert.deepEqual(runBuildUnifiedHomeFeed([], []), []);
});

/* ---------------------------------------------------------------------
   9. UUID Community post routing — the Number() cast bug is gone, and the
   shared lookup helper actually resolves both a real UUID id and a mock
   numeric id.
--------------------------------------------------------------------- */

function runFindCommunityPostById(realPosts, id) {
  const state = { communityFeed: { posts: realPosts } };
  const body = [extractFunction(main, "findCommunityPostById"), `return findCommunityPostById(${JSON.stringify(id)});`].join("\n");
  const fn = new Function("state", body);
  return fn(state);
}

test("findCommunityPostById resolves a real UUID post id, coerces id types via String(), and returns null when nothing matches — no fixture fallback exists", () => {
  const realPosts = [{ id: "3f6a2e10-uuid-example", authorName: "Real User" }, { id: 42, authorName: "Numeric Id User" }];
  assert.equal(runFindCommunityPostById(realPosts, "3f6a2e10-uuid-example").authorName, "Real User");
  assert.equal(runFindCommunityPostById(realPosts, 42).authorName, "Numeric Id User");
  assert.equal(runFindCommunityPostById(realPosts, "42").authorName, "Numeric Id User");
  assert.equal(runFindCommunityPostById(realPosts, "does-not-exist"), null);
  assert.equal(runFindCommunityPostById(realPosts, null), null);
});

test("no Community post-id lookup anywhere in bindEvents still casts through Number() — the UUID bug is fixed at every call site, not just one", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.doesNotMatch(bindEvents, /Number\(button\.dataset\.postId\)/);
  assert.doesNotMatch(bindEvents, /Number\(form\.dataset\.postId\)/);
});

/* ---------------------------------------------------------------------
   13. Nullable Community fields (author, neighbourhood, media) never
   crash the mapping and never leak "undefined" into a displayed field.
--------------------------------------------------------------------- */

function runShapeCommunityPostForDisplay(row) {
  const body = [extractFunction(main, "shapeCommunityPostForDisplay"), `return shapeCommunityPostForDisplay(${JSON.stringify(row)});`].join("\n");
  const fn = new Function(body);
  return fn();
}

test("shapeCommunityPostForDisplay never crashes and never leaks undefined for a row with no author embed, no neighbourhood, no media", () => {
  const minimalRow = { id: "post-1", title: "Hello", body: "Body text", category: "discussion", created_at: "2026-01-01T00:00:00Z" };
  const shaped = runShapeCommunityPostForDisplay(minimalRow);
  assert.equal(shaped.authorName, "");
  assert.equal(shaped.authorAvatar, "");
  assert.equal(shaped.authorVerified, false);
  assert.equal(shaped.neighbourhood, "");
  assert.equal(shaped.mediaUrl, null);
  assert.equal(shaped.isRealRecord, true);
  for (const value of Object.values(shaped)) {
    assert.notEqual(value, undefined, "no field should ever be literally undefined");
  }
});

test("shapeCommunityPostForDisplay maps a fully-populated row (author embed, neighbourhood, media) without loss", () => {
  const fullRow = {
    id: "post-2",
    title: "Found a lost cat",
    body: "Near the park",
    category: "lostFound",
    neighbourhood: "Užupis",
    media: [{ url: "https://example.com/photo.jpg" }],
    created_at: "2026-01-02T00:00:00Z",
    author: { display_name: "Rūta", avatar_url: "https://example.com/avatar.jpg", verification_status: "verified" }
  };
  const shaped = runShapeCommunityPostForDisplay(fullRow);
  assert.equal(shaped.authorName, "Rūta");
  assert.equal(shaped.authorAvatar, "https://example.com/avatar.jpg");
  assert.equal(shaped.authorVerified, true);
  assert.equal(shaped.neighbourhood, "Užupis");
  assert.equal(shaped.mediaUrl, "https://example.com/photo.jpg");
  assert.equal(shaped.type, "lostFound");
});

/* ---------------------------------------------------------------------
   10. Unsupported sources (TYT, Events, Explore, Businesses, User
   activity) stay disabled and are never aggregated, even though their
   adapter entries exist for documentation/future-readiness purposes.
--------------------------------------------------------------------- */

test("TYT/Events/Explore/Businesses/User-activity adapters all stay disabled and are excluded from the merged feed", () => {
  const adaptersSrc = extractConst(main, "HOME_FEED_SOURCE_ADAPTERS");
  for (const key of ["tyt", "events", "explore", "businesses", "userActivity"]) {
    const entryMatch = adaptersSrc.match(new RegExp(`${key}:\\s*\\{[\\s\\S]*?readiness:`));
    assert.ok(entryMatch, `${key} adapter entry must exist with a readiness checklist`);
    assert.match(entryMatch[0], /enabled:\s*false/, `${key} must be enabled: false`);
  }
  // Only marketplace/community declare enabled: true.
  const enabledMatches = adaptersSrc.match(/enabled:\s*true/g) || [];
  assert.equal(enabledMatches.length, 2, "exactly two sources (marketplace, community) may be enabled: true");
});

/* ---------------------------------------------------------------------
   11. Unsupported interactions (like/comment/save/helpful) are never
   rendered on a Home Feed card — Open + Share only, per the empirically
   verified non-durability of savedListingIds/savedPostIds/helpfulPostIds.
--------------------------------------------------------------------- */

test("Home Feed cards render only Open + Share — no like/comment/save/helpful affordance, no zeroed-out counts", () => {
  const listingItem = extractFunction(main, "renderHomeFeedListingItem");
  const communityItem = extractFunction(main, "renderHomeFeedCommunityItem");
  for (const fn of [listingItem, communityItem]) {
    assert.doesNotMatch(fn, /toggle-listing-save|toggle-helpful|toggle-post-save/, "must not render a non-durable engagement toggle");
    assert.doesNotMatch(fn, /post\.helpful|post\.saves|post\.replies\b/, "must not surface a fabricated/zeroed engagement count");
  }
  assert.match(listingItem, /data-action="share-listing"/);
  assert.match(communityItem, /data-action="share-post"/);
  const adaptersSrc = extractConst(main, "HOME_FEED_SOURCE_ADAPTERS");
  assert.match(adaptersSrc, /interactions:\s*\{\s*open:\s*true,\s*share:\s*true,\s*like:\s*false,\s*comment:\s*false,\s*save:\s*false\s*\}/g);
});

/* ---------------------------------------------------------------------
   12. No fixture content path exists in the Home feed's own aggregation/
   rendering functions — by construction, not by a runtime host check.
--------------------------------------------------------------------- */

test("no fixture data source is reachable from the Home feed's aggregation or card-rendering functions", () => {
  for (const name of ["buildUnifiedHomeFeed", "renderHomeFeed", "renderHomeFeedListingItem", "renderHomeFeedCommunityItem"]) {
    const fn = extractFunction(main, name);
    assert.doesNotMatch(fn, /LIVE_OPPORTUNITIES|fixtureOpportunitiesForSurface|feedPosts\b/, `${name} must not reach into any fixture/mock data source`);
  }
});

/* ---------------------------------------------------------------------
   Layout guards: bottom-nav clearance and no whole-page horizontal
   overflow from the new carousel/feed sections.
--------------------------------------------------------------------- */

test("the app shell's bottom padding (bottom-nav clearance) and horizontal-overflow guard are untouched by this redesign", () => {
  assert.match(styles, /\.app-shell\s*\{[^}]*padding:\s*14px 18px calc\(156px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.app-shell\s*\{[^}]*overflow-x:\s*clip/);
});

test("the opportunity carousel's own horizontal scroll is contained to its shell, not leaking into page-level overflow", () => {
  assert.match(styles, /\.carousel-shell-opportunity\s*\{\s*overflow:\s*hidden;\s*\}/);
});

/* ---------------------------------------------------------------------
   Browser back/forward regression spot-check (full coverage already in
   test/browser-history-restoration.test.js) — Home stays the fallback
   target for a bare "/" after this redesign.
--------------------------------------------------------------------- */

test("Home remains the resetToHomeFromUrl fallback target — unaffected by the Home content redesign", () => {
  const fn = extractFunction(main, "resetToHomeFromUrl");
  assert.match(fn, /state\.activeView = "home";/);
});
