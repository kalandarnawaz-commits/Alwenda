import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/* ---------------------------------------------------------------------
   Phase 4 of the mock-data-removal plan: Community converted from
   mock-primary rendering (the local feedPosts fixture) to production-only
   rendering (state.communityFeed, backed by fetchCommunityPosts()/
   createCommunityPost()). Following this repo's established convention
   (see test/home-feed.test.js): small pure-data functions are extracted
   as source text and actually executed via new Function(...); render/
   write-path functions with a large DOM/i18n/network dependency tree are
   asserted on structurally instead.
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

/* Extracts a bindEvents `.addEventListener(...)` call body by brace-
   matching from the marker's opening `{`, so the extraction isn't fooled
   by an earlier unrelated `});` inside the handler (e.g. the object
   literal passed to createCommunityPost({...}) closing before the real
   end of the arrow function). */
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
let supabaseClient;
let mockData;

test.before(async () => {
  main = await readRepoFile("src/main.js");
  supabaseClient = await readRepoFile("src/services/auth/supabaseClient.js");
  mockData = await readRepoFile("src/data/mockData.js");
});

/* ---------------------------------------------------------------------
   1. mockData.js no longer exports the fixture — nothing left to fabricate
      Community content from.
--------------------------------------------------------------------- */

test("mockData.js no longer exports feedPosts", () => {
  assert.doesNotMatch(mockData, /export const feedPosts/);
});

test("main.js no longer imports feedPosts from mockData", () => {
  const importEnd = main.indexOf('from "./data/mockData.js');
  assert.ok(importEnd !== -1, "mockData import must still exist for other consumers");
  const importBlock = main.slice(0, importEnd);
  assert.doesNotMatch(importBlock, /\bfeedPosts\b/);
});

/* ---------------------------------------------------------------------
   2. Every Community data-source consumer reads the real cache
      (state.communityFeed), never the old mock fixture.
--------------------------------------------------------------------- */

test("filteredCommunityPosts/visibleFeedPosts/renderCommunity/renderCommunityRail/renderCommunitySignalStrip never reference feedPosts", () => {
  for (const name of ["filteredCommunityPosts", "visibleFeedPosts", "renderCommunity", "renderCommunityRail", "renderCommunitySignalStrip", "contributeRealActivityBreakdown"]) {
    const fn = extractFunction(main, name);
    assert.doesNotMatch(fn, /\bfeedPosts\b/, `${name} must not reach into the deleted mock fixture`);
  }
});

test("visibleFeedPosts and filteredCommunityPosts read from state.communityFeed.posts", () => {
  assert.match(extractFunction(main, "visibleFeedPosts"), /state\.communityFeed\.posts/);
  const filtered = extractFunction(main, "filteredCommunityPosts");
  assert.match(filtered, /visibleFeedPosts\(\)/);
});

test("findCommunityPostById resolves purely from state.communityFeed.posts, no fixture fallback", () => {
  const fn = extractFunction(main, "findCommunityPostById");
  assert.match(fn, /state\.communityFeed\.posts\.find/);
  assert.doesNotMatch(fn, /\bfeedPosts\b/);
});

test("renderCommunity() uses the idle/loading/loaded/error cache convention, matching refreshOpportunityFeed's established pattern", () => {
  const fn = extractFunction(main, "renderCommunity");
  assert.match(fn, /state\.communityFeed\.status === "idle"/);
  assert.match(fn, /refreshCommunityFeed\(\)/);
  assert.match(fn, /state\.communityFeed\.status === "loading"/);
  assert.match(fn, /state\.communityFeed\.status === "error"/);
  assert.match(fn, /data-action="retry-community-feed"/);
});

/* ---------------------------------------------------------------------
   3. Zero-post state renders the intentional premium empty state, not a
      blank feed and not fabricated example posts.
--------------------------------------------------------------------- */

test("renderCommunityFeedEmptyState renders the exact requested copy and CTA for a genuinely empty production feed", () => {
  const fn = extractFunction(main, "renderCommunityFeedEmptyState");
  assert.match(fn, /renderEmptyState\(t\("community\.emptyFeedTitle"\)/);
  assert.match(fn, /t\("community\.emptyFeedHint"\)/);
  assert.match(fn, /data-sheet="communityComposer"/);
  assert.match(fn, /t\("community\.createPost"\)/);
});

test("community.emptyFeedTitle/emptyFeedHint locale copy matches the requested strings, in every shipped locale", async () => {
  for (const locale of ["en", "lt", "de"]) {
    const json = JSON.parse(await readRepoFile(`locales/${locale}.json`));
    assert.ok(json.community.emptyFeedTitle, `${locale} must define community.emptyFeedTitle`);
    assert.ok(json.community.emptyFeedHint, `${locale} must define community.emptyFeedHint`);
  }
  const en = JSON.parse(await readRepoFile("locales/en.json"));
  assert.equal(en.community.emptyFeedTitle, "Be the first to post");
  assert.equal(en.community.emptyFeedHint, "Share something useful with your community.");
});

test("renderCommunity never falls back to fabricated example posts when the feed is empty", () => {
  const fn = extractFunction(main, "renderCommunity");
  assert.match(fn, /posts\.length \? posts\.map\(renderCommunityPostCard\)\.join\(""\) : renderCommunityFeedEmptyState\(\)/);
});

/* ---------------------------------------------------------------------
   4. Interaction honesty — real post cards expose only Open + Share, no
      fabricated helpful/saved/reply counts.
--------------------------------------------------------------------- */

test("renderCommunityPostCard exposes only Open and Share actions, no fabricated engagement counts", () => {
  const fn = extractFunction(main, "renderCommunityPostCard");
  assert.match(fn, /data-action="open-post-detail"/);
  assert.match(fn, /data-action="share-post"/);
  assert.doesNotMatch(fn, /post\.helpful/);
  assert.doesNotMatch(fn, /post\.replies/);
  assert.doesNotMatch(fn, /post\.saves/);
  assert.doesNotMatch(fn, /data-action="toggle-helpful"/);
});

test("the toggle-helpful handler and its dead state field are fully removed, not just hidden", () => {
  assert.doesNotMatch(main, /data-action="toggle-helpful"/);
  assert.doesNotMatch(main, /helpfulPostIds/);
  assert.doesNotMatch(main, /COMMUNITY_PRIMARY_ACTION_KIND/);
});

test("the post-detail sheet's reply composer (fabricated, non-durable replyList/replies counter) is fully removed, not just hidden", () => {
  assert.doesNotMatch(main, /data-action="reply-to-post"/);
  assert.doesNotMatch(main, /replyList/);
  assert.doesNotMatch(main, /post\.replies = /);
});

test("renderPostDetailSheet renders only real fields (title/body) and the same Share action as the card — no dead titleKey/bodyKey mock-fallback branches", () => {
  const fn = extractFunction(main, "renderPostDetailSheet");
  assert.doesNotMatch(fn, /titleKey/);
  assert.doesNotMatch(fn, /bodyKey/);
  assert.match(fn, /escapeHtml\(post\.title \|\| ""\)/);
  assert.match(fn, /escapeHtml\(post\.body \|\| ""\)/);
  assert.match(fn, /data-action="share-post"/);
});

test("sharePost no longer branches on the deleted mock titleKey/bodyKey fields", () => {
  const fn = extractFunction(main, "sharePost");
  assert.doesNotMatch(fn, /titleKey/);
  assert.doesNotMatch(fn, /bodyKey/);
});

/* ---------------------------------------------------------------------
   5. Real write path — createCommunityPost() in supabaseClient.js.
--------------------------------------------------------------------- */

test("createCommunityPost inserts a published row into community_posts, reusing existing auth, with no new migration/RLS bypass", () => {
  const start = supabaseClient.indexOf("export async function createCommunityPost(");
  assert.ok(start !== -1, "createCommunityPost must exist in supabaseClient.js");
  const fn = supabaseClient.slice(start, supabaseClient.indexOf("\n}", start) + 2);
  assert.match(fn, /if \(!user\) throw new AuthNotConfiguredError\(\);/);
  assert.match(fn, /\.from\("community_posts"\)/);
  assert.match(fn, /\.insert\(/);
  assert.match(fn, /status: "published"/);
  assert.match(fn, /author_user_id: user\.id/);
  assert.match(fn, /throwIfError\(error, "createCommunityPost"\)/);
});

/* ---------------------------------------------------------------------
   6. Composer submission — authenticated success path, unauthenticated
      gate, and failure path all update state.communityPostSubmitStatus
      correctly and never mutate a mock array directly.
--------------------------------------------------------------------- */

test("submit-community-post handler no longer mutates feedPosts directly (feedPosts.unshift is gone)", () => {
  assert.doesNotMatch(main, /feedPosts\.unshift/);
});

test("submit-community-post handler gates on auth, calling createCommunityPost only when signed in — unauthenticated composer never reaches the network", () => {
  const handler = extractEventListenerCall(main, 'document.querySelector(\'[data-action="submit-community-post"]\')');
  assert.match(handler, /if \(state\.auth\.status !== "signedIn"\)/);
  assert.match(handler, /state\.communityPostSubmitStatus = "error"/);
  assert.match(handler, /t\("community\.composerSignInHint"\)/);
});

test("submit-community-post handler's authenticated success path calls createCommunityPost then applyCreatedCommunityPost, and closes the sheet", () => {
  const handler = extractEventListenerCall(main, 'document.querySelector(\'[data-action="submit-community-post"]\')');
  assert.match(handler, /const created = await createCommunityPost\(\{/);
  assert.match(handler, /applyCreatedCommunityPost\(created\)/);
  assert.match(handler, /state\.activeSheet = null/);
  assert.match(handler, /state\.communityPostSubmitStatus = "idle"/);
});

test("submit-community-post handler's failure path sets an error status and message without crashing, preserving the draft for retry", () => {
  const handler = extractEventListenerCall(main, 'document.querySelector(\'[data-action="submit-community-post"]\')');
  assert.match(handler, /catch \(error\) \{/);
  assert.match(handler, /state\.communityPostSubmitStatus = "error";\s*\n\s*state\.communityPostSubmitError = error\?\.message \|\| t\("community\.postError"\);/);
});

test("applyCreatedCommunityPost merges the created post into the cached feed via shapeCommunityPostForDisplay, without refetching the whole page", () => {
  const fn = extractFunction(main, "applyCreatedCommunityPost");
  assert.match(fn, /shapeCommunityPostForDisplay\(/);
  assert.match(fn, /state\.communityFeed = \{ \.\.\.state\.communityFeed, posts: \[shaped, \.\.\.state\.communityFeed\.posts\] \}/);
});

test("the composer sheet shows a disabled/loading submit button and surfaces the submission error, mirroring the listing composer's established pattern", () => {
  const fn = extractFunction(main, "renderCommunityComposerSheet");
  assert.match(fn, /state\.communityPostSubmitStatus === "loading"/);
  assert.match(fn, /state\.communityPostSubmitStatus === "error"/);
  assert.match(fn, /state\.communityPostSubmitError/);
  assert.match(fn, /t\("community\.composerSubmitting"\)/);
});

/* ---------------------------------------------------------------------
   7. UUID navigation — data-post-id carries the real id through, and the
      moderation handlers (report/block) key off the real authorName
      field, not the deleted mock `author` field.
--------------------------------------------------------------------- */

test("renderCommunityPostCard's data-post-id and open-post-detail both carry post.id through untouched (no Number() cast)", () => {
  const fn = extractFunction(main, "renderCommunityPostCard");
  assert.match(fn, /data-post-id="\$\{post\.id\}"/);
});

test("report-post-author/block-post-author bindEvents handlers key off post.authorName, not the deleted mock post.author field", () => {
  const reportHandler = extractEventListenerCall(main, 'document.querySelector(\'[data-action="report-post-author"]\')');
  const blockHandler = extractEventListenerCall(main, 'document.querySelector(\'[data-action="block-post-author"]\')');
  assert.doesNotMatch(reportHandler, /post\.author\)/);
  assert.doesNotMatch(blockHandler, /post\.author\)/);
  assert.match(reportHandler, /post\.authorName/);
  assert.match(blockHandler, /post\.authorName/);
});

test("renderPostActionsSheet's isReported/isBlocked checks key off post.authorName, not post.author", () => {
  const fn = extractFunction(main, "renderPostActionsSheet");
  assert.doesNotMatch(fn, /post\.author\)/);
  assert.match(fn, /post\.authorName/);
});
