import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 6 of the mock-data-removal plan: Hire converted from a mock
   serviceProfessionals array to an honest empty state. There is no real
   professional-listing concept in the schema yet, so filteredProfessionals()
   is now always honestly empty rather than fabricating a card, and every
   consumer of the deleted mock array either reuses an already-wired
   honest-empty-state branch or was removed outright as unreachable.

   Note: the separate, already-real "premium opportunity card" system
   (renderRealOpportunityCard, resolveHelpRequestImage, the Live Requests
   list from Phase 5 — see test/help-request-profile-connectors.test.js,
   test/help-requests-real-only.test.js) is untouched by this phase; it
   has never read from serviceProfessionals. */

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
let mockData;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  mockData = await readRepoFile("src/data/mockData.js");
});

/* ---------------------------------------------------------------------
   1. mockData.js no longer exports the fixture.
--------------------------------------------------------------------- */

test("mockData.js no longer exports serviceProfessionals", () => {
  assert.doesNotMatch(mockData, /export const serviceProfessionals/);
});

test("main.js no longer imports serviceProfessionals from mockData", () => {
  const importEnd = main.indexOf('from "./data/mockData.js');
  assert.ok(importEnd !== -1, "mockData import must still exist for other consumers");
  const importBlock = main.slice(0, importEnd);
  assert.doesNotMatch(importBlock, /\bserviceProfessionals\b/);
});

test("professionalCategories (static chip labels, not fake content) is preserved — Phase 6 only removes fabricated cards, not the real category taxonomy", () => {
  const importEnd = main.indexOf('from "./data/mockData.js');
  const importBlock = main.slice(0, importEnd);
  assert.match(importBlock, /\bprofessionalCategories\b/);
  assert.match(mockData, /export const professionalCategories/);
});

/* ---------------------------------------------------------------------
   2. professionalsForIntent() is always honestly empty — no fabricated
      card, no mock fallback. (filteredProfessionals() — Hire's own
      Phase 6 equivalent — was deleted outright in Phase 7 once its last
      caller, topMatches()'s proMatches branch, was removed; see
      test/alwen-conversation.test.js for that deletion coverage.)
--------------------------------------------------------------------- */

test("professionalsForIntent always returns an empty array too, so needHelpSummaryStats degrades to honest zeros/nulls rather than fabricated numbers", () => {
  const fn = extractFunction(main, "professionalsForIntent");
  assert.match(fn, /return \[\];/);
  assert.doesNotMatch(fn, /serviceProfessionals|hireCategoryMatches/);
});

test("renderInlineProSuggestions always reports zero instant matches honestly, with no dead found-matches rendering branch left behind", () => {
  const fn = extractFunction(main, "renderInlineProSuggestions");
  assert.match(fn, /t\("needHelp\.instantMatchesNone"\)/);
  assert.doesNotMatch(fn, /instantMatchesFound|instantMatchesSeeAll|serviceProfessionals|hireCategoryMatches/);
});

/* ---------------------------------------------------------------------
   3. Every render function that used to show fabricated pro cards now
      either reuses an already-wired honest empty state, or was removed.
--------------------------------------------------------------------- */

test("renderHire's pro-list is the empty state unconditionally — the mock fallback branch is gone, not just unreachable", () => {
  const fn = extractFunction(main, "renderHire");
  assert.match(fn, /renderEmptyState\(t\("common\.noResults"\), "people"\)/);
  assert.doesNotMatch(fn, /renderProfessional|filteredProfessionals\(\)/);
});

test("renderNeedHelpResults's post-submit matching-pros section is the same honest empty state, never a fabricated pro card", () => {
  const fn = extractFunction(main, "renderNeedHelpResults");
  assert.match(fn, /renderEmptyState\(t\("common\.noResults"\), "people"\)/);
  assert.doesNotMatch(fn, /renderProCard|professionalsForIntent\(intent\)/);
});

test("renderMarketplace's fake Verified Pros cross-sell section is fully removed, not converted to an empty state — Marketplace stays protected/untouched otherwise", () => {
  const fn = extractFunction(main, "renderMarketplace");
  assert.doesNotMatch(fn, /verifiedPros|requestQuote|pro-list|renderProfessional|filteredProfessionals/);
  // The rest of Marketplace (real listings grid, category chips, AI search) is untouched.
  assert.match(fn, /filteredListings\(\)/);
  assert.match(fn, /renderMarketplaceCollections\(items\)/);
});

test("renderProfessional, renderProCard, hireCategoryMatches, and startProfessionalConversation are fully deleted — not orphaned, not unreachable-but-present", () => {
  for (const name of ["renderProfessional", "renderProCard", "hireCategoryMatches", "startProfessionalConversation"]) {
    assert.doesNotMatch(main, new RegExp(`function ${name}\\(`), `${name} must be fully removed`);
  }
});

/* ---------------------------------------------------------------------
   4. findPersonById / the public profile viewer no longer branch on a
      fake professional identity — an old pro-<id> link now honestly
      resolves to nothing instead of resurrecting a mock person.
--------------------------------------------------------------------- */

test("findPersonById no longer has a pro-<id> branch — the real community/marketplace sources are unchanged (Phase 8 also removed the profileReviews branch as a separate, older, already-unreachable fixture — see test/repository-cleanup.test.js)", () => {
  const fn = extractFunction(main, "findPersonById");
  assert.doesNotMatch(fn, /serviceProfessionals|pro-\$\{item\.id\}|profileReviews/);
  assert.match(fn, /state\.communityFeed\.posts\.find/);
  assert.match(fn, /myListingsPool\.find/);
});

test("renderPublicProfile no longer renders a Book button or a hire-context badge branch — context can never be \"hire\" anymore", () => {
  const fn = extractFunction(main, "renderPublicProfile");
  assert.doesNotMatch(fn, /isHireContext|data-person-action="request-booking"/);
});

test("the request-booking bindEvents handler is fully removed, not left dangling with a reference to a deleted function", () => {
  const bindEvents = extractFunction(main, "bindEvents");
  assert.doesNotMatch(bindEvents, /request-booking/);
  assert.doesNotMatch(bindEvents, /start-pro-conversation/);
});

/* ---------------------------------------------------------------------
   5. Alwen chat's professional-search paths degrade honestly — no
      references to the deleted mock array or render function remain.
--------------------------------------------------------------------- */

test("Alwen's structured-result renderer no longer references the deleted renderProfessional for professional-type results", () => {
  const fn = extractFunction(main, "renderAlwenStructuredResultMessage");
  assert.doesNotMatch(fn, /renderProfessional/);
  assert.match(fn, /message\.resultType === "place"/);
});

test("Alwen's contextual actions for a professional result never construct fake view-profile/message buttons — always the honest 'see more in Hire' nudge", () => {
  const fn = extractFunction(main, "renderAlwenContextualActions");
  assert.doesNotMatch(fn, /start-pro-conversation|publicProfileAttrs\(\{ id: `pro-/);
  assert.match(fn, /alwen\.seeMoreInHire/);
});

test("mapAlwenMessageRow no longer references serviceProfessionals when re-hydrating a historical professional-type message", () => {
  const fn = extractFunction(main, "mapAlwenMessageRow");
  assert.doesNotMatch(fn, /serviceProfessionals/);
});
