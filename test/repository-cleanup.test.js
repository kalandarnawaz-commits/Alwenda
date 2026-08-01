import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 8 of the mock-data-removal plan: conservative repository cleanup
   after Phases 1-7. Removes debris the migration left behind — dead CSS
   selectors tied to deleted UI (Businesses/Reservations/Offers from
   Phase 2, the professional-listing "pro" system from Phase 6), and two
   older, already-unreachable fixtures found during the mockData.js
   export audit (profileReviews, and the locale-key namespaces that only
   ever fed the deleted mock arrays). No user-visible behaviour changes —
   every removal here is confirmed dead by exhaustive grep, not merely
   suspected. */

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
let styles;
let en;
let lt;
let de;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  mockData = await readRepoFile("src/data/mockData.js");
  styles = await readRepoFile("src/styles.css");
  en = JSON.parse(await readRepoFile("locales/en.json"));
  lt = JSON.parse(await readRepoFile("locales/lt.json"));
  de = JSON.parse(await readRepoFile("locales/de.json"));
});

/* ---------------------------------------------------------------------
   1. Dead CSS selectors tied to Phase 2 (Businesses/Reservations/Offers)
      and Phase 6 (the deleted "pro" professional-card system) are gone.
      .pro-list (Hire's still-live empty-state wrapper) is untouched.
--------------------------------------------------------------------- */

test("no dead .pro-card/.pro-stat/.business-card/.offer-card/.reservation*/.opportunity-cover-avatar selectors remain in styles.css", () => {
  for (const selector of [
    "\\.pro-card\\b",
    "\\.pro-stat",
    "\\.business-card",
    "\\.offer-card",
    "\\.reservation",
    "\\.opportunity-cover-avatar",
    "\\.businesses-hero-photo",
    "\\.reservations-hero-photo",
    "\\.status-badge-amber",
    "\\.status-badge-sky",
    "\\.status-badge-muted",
    "\\.status-badge-green"
  ]) {
    assert.doesNotMatch(styles, new RegExp(selector), `dead selector ${selector} should be removed`);
  }
});

test(".pro-list (Hire's real, still-used empty-state wrapper) is untouched by the .pro-card cleanup", () => {
  assert.match(styles, /\.pro-list\s*\{/);
});

/* ---------------------------------------------------------------------
   2. profileReviews — an older, already-unreachable fixture predating
      Phases 1-7 (nothing ever constructed a matching "review-N" id to
      look it up) — is fully deleted, not just emptied.
--------------------------------------------------------------------- */

test("mockData.js no longer exports profileReviews", () => {
  assert.doesNotMatch(mockData, /export const profileReviews/);
});

test("main.js no longer imports profileReviews, and findPersonById has no review branch left", () => {
  const importEnd = main.indexOf('from "./data/mockData.js');
  const importBlock = main.slice(0, importEnd);
  assert.doesNotMatch(importBlock, /\bprofileReviews\b/);
  const fn = extractFunction(main, "findPersonById");
  assert.doesNotMatch(fn, /profileReviews/);
  assert.match(fn, /state\.communityFeed\.posts\.find/);
  assert.match(fn, /myListingsPool\.find/);
});

test("PUBLIC_PROFILE_CONTEXT_HINT only has the two real contexts left (community, marketplace) — hire and review can never occur since nothing sets those contexts anymore", () => {
  const start = main.indexOf("const PUBLIC_PROFILE_CONTEXT_HINT = {");
  assert.ok(start !== -1, "PUBLIC_PROFILE_CONTEXT_HINT must exist");
  const end = main.indexOf("};", start);
  const block = main.slice(start, end);
  assert.match(block, /community:/);
  assert.match(block, /marketplace:/);
  assert.doesNotMatch(block, /hire:|review:/);
});

/* ---------------------------------------------------------------------
   3. Orphaned locale namespaces are removed from all 3 locales — the
      mock.biz/offer/repProfile/listing namespaces only ever fed the
      Phase 2/3-deleted businesses/offers/listings mock arrays, and
      mock.review/profile.public.publicProfileContextHire/Review only
      ever fed the now-deleted profileReviews fixture and hire context.
--------------------------------------------------------------------- */

test("mock.biz, mock.offer, mock.repProfile, mock.listing, and mock.review are removed from every locale", () => {
  for (const [name, dict] of [["en", en], ["lt", lt], ["de", de]]) {
    const mock = dict.mock || {};
    for (const ns of ["biz", "offer", "repProfile", "listing", "review"]) {
      assert.equal(mock[ns], undefined, `locales/${name}.json still has mock.${ns}`);
    }
  }
});

test("profile.public.publicProfileContextHire and publicProfileContextReview are removed from every locale", () => {
  for (const [name, dict] of [["en", en], ["lt", lt], ["de", de]]) {
    const pub = dict.profile?.public || {};
    assert.equal(pub.publicProfileContextHire, undefined, `locales/${name}.json still has publicProfileContextHire`);
    assert.equal(pub.publicProfileContextReview, undefined, `locales/${name}.json still has publicProfileContextReview`);
    assert.ok(pub.publicProfileContextCommunity, `locales/${name}.json missing the still-real publicProfileContextCommunity`);
    assert.ok(pub.publicProfileContextMarketplace, `locales/${name}.json missing the still-real publicProfileContextMarketplace`);
  }
});

test("mock.notif and other still-consumed mock namespaces are untouched — this cleanup only removed namespaces with zero remaining readers", () => {
  for (const dict of [en, lt, de]) {
    assert.ok(dict.mock?.notif, "mock.notif must remain — feeds the still-real notifications inbox");
  }
});

test("mock.thread is fully removed — messageThreads (its sole consumer) was converted to real, persisted Supabase conversations, not deferred", () => {
  for (const dict of [en, lt, de]) {
    assert.equal(dict.mock?.thread, undefined, "mock.thread must not remain — the mock Inbox it fed was replaced by real conversations");
  }
});

/* ---------------------------------------------------------------------
   4. mockData.js's remaining exports are all accounted for — no export
      is silently unreferenced by main.js.
--------------------------------------------------------------------- */

test("every remaining mockData.js export has at least one consumer in main.js", () => {
  const names = [...mockData.matchAll(/^export const (\w+)/gm)].map((m) => m[1]);
  assert.ok(names.length > 0);
  const importEnd = main.indexOf('from "./data/mockData.js');
  const importBlock = main.slice(0, importEnd);
  for (const name of names) {
    assert.match(importBlock, new RegExp(`\\b${name}\\b`), `${name} must still be imported by main.js`);
  }
});
