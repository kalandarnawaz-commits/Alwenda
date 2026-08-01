import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `function ${name} must exist`);
  let depth = 0;
  let bodyStart = -1;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") {
      if (bodyStart === -1) bodyStart = i;
      depth += 1;
    } else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find end of function ${name}`);
}

const MIGRATION_PATH = "supabase/migrations/202607240001_profile_social_identity.sql";

test("migration defines profile_follows, profile_reviews, trust_scores with RLS enabled", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  for (const table of ["profile_follows", "profile_reviews", "trust_scores"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`), `${table} table should exist`);
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `${table} should enable RLS`);
  }
});

test("self-follow is rejected at the database level, not just in the client", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /check \(follower_user_id <> followed_user_id\)/);
});

test("duplicate follows are rejected by the primary key, not application logic", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /primary key \(follower_user_id, followed_user_id\)/);
});

test("a user may only ever write a follow relationship as themselves", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /create policy "Users create own follow relationships" on public\.profile_follows\s*\n\s*for insert\s*\n\s*with check \(auth\.uid\(\) = follower_user_id and not public\.is_blocked_pair\(follower_user_id, followed_user_id\)\)/);
  assert.match(sql, /create policy "Users remove own follow relationships" on public\.profile_follows for delete using \(auth\.uid\(\) = follower_user_id\)/);
});

test("follow relationships and their counts are publicly readable, except between a blocked pair", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /create policy "Follow relationships are readable" on public\.profile_follows\s*\n\s*for select using \(not public\.is_blocked_pair\(follower_user_id, followed_user_id\)\)/);
});

test("blocking is checked in both directions — blocker cannot follow blocked user, and blocked user cannot follow blocker", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  const fnStart = sql.indexOf("create or replace function public.is_blocked_pair");
  const fnBody = sql.slice(fnStart, sql.indexOf("$$;", fnStart) + 3);
  assert.notEqual(fnStart, -1, "is_blocked_pair must exist");
  // Direction 1: user_a blocked user_b.
  assert.match(fnBody, /b\.blocker_user_id = user_a and b\.blocked_user_id = user_b/);
  // Direction 2: user_b blocked user_a — both must be present, joined by OR,
  // so neither "the follower blocked the target" nor "the target blocked
  // the follower" is missed.
  assert.match(fnBody, /b\.blocker_user_id = user_b and b\.blocked_user_id = user_a/);
  assert.match(fnBody, /security definer/);
  assert.match(fnBody, /set search_path = public/);
  // Both the insert (new follow) and select (existing follow visibility)
  // policies must call it — a follow between a blocked pair must be both
  // unwritable and, if it somehow predates the block, invisible.
  assert.match(sql, /with check \(auth\.uid\(\) = follower_user_id and not public\.is_blocked_pair\(follower_user_id, followed_user_id\)\)/);
  assert.match(sql, /for select using \(not public\.is_blocked_pair\(follower_user_id, followed_user_id\)\)/);
});

test("is_blocked_pair is granted to anon and authenticated so guests and signed-in users can both read follow lists", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /grant execute on function public\.is_blocked_pair\(uuid, uuid\) to anon, authenticated;/);
});

test("trust_scores has no client/owner write policy — only the SECURITY DEFINER refresh function may write it", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.doesNotMatch(sql, /on public\.trust_scores for (insert|update|delete|all)/);
  assert.match(sql, /create or replace function public\.refresh_trust_score/);
  assert.match(sql, /security definer/);
  assert.match(sql, /auth\.uid\(\) is distinct from p_user_id and not public\.is_trusted_admin\(\)/);
});

test("compute_trust_score cannot be executed directly by any client role", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  // Must be revoked from PUBLIC (Postgres's default grant for a newly
  // created function) — without this, SECURITY DEFINER would let
  // anon/authenticated call it directly for any user id and read
  // auth.users.email_confirmed_at/created_at, which client roles cannot
  // otherwise query at all.
  assert.match(sql, /revoke all on function public\.compute_trust_score\(uuid\) from public;/);
  // And it must never be re-granted to a client role anywhere else in
  // the file — only refresh_trust_score (which already runs as the
  // definer once entered) may call it internally.
  assert.doesNotMatch(sql, /grant execute on function public\.compute_trust_score/);
  assert.match(sql, /grant execute on function public\.refresh_trust_score\(uuid\) to authenticated;/);
});

test("both trust-score SECURITY DEFINER functions pin an explicit search_path", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  const computeFn = sql.slice(
    sql.indexOf("create or replace function public.compute_trust_score"),
    sql.indexOf("create or replace function public.refresh_trust_score")
  );
  const refreshFn = sql.slice(sql.indexOf("create or replace function public.refresh_trust_score"));
  assert.match(computeFn, /security definer\s*\nset search_path = public/);
  assert.match(refreshFn, /security definer\s*\nset search_path = public/);
});

test("handles are unique case-insensitively and reserved words are rejected", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /create unique index if not exists public_profiles_handle_unique_idx[\s\S]{0,80}lower\(handle\)/);
  assert.match(sql, /public_profiles_handle_not_reserved[\s\S]{0,80}is_reserved_handle/);
  assert.match(sql, /'admin'.*'ops'.*'alwenda'|'admin'/);
});

test("validateHandleFormat mirrors the DB's handle format constraint", async () => {
  const { validateHandleFormat } = await import("../src/services/auth/supabaseClient.js");
  assert.equal(validateHandleFormat("john_doe"), true);
  assert.equal(validateHandleFormat("a12"), true);
  assert.equal(validateHandleFormat("Jo"), false); // uppercase + too short
  assert.equal(validateHandleFormat("1abc"), false); // must start with a letter
  assert.equal(validateHandleFormat(""), false);
  assert.equal(validateHandleFormat(null), false);
  assert.equal(validateHandleFormat("a".repeat(25)), false); // over 24 chars
});

test("openUserProfile fetches a real row and never fabricates a profile for a missing handle/id", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "openUserProfile");
  assert.match(fn, /looksLikeUserId\(requested\) \? await fetchProfileById\(requested\) : await fetchProfileByHandle\(requested\)/);
  assert.match(fn, /if \(!profile\) \{/);
  assert.match(fn, /state\.userProfile\.status = "notFound"/);
});

test("toggleFollowUserProfile refuses to follow yourself or fire twice while pending", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "toggleFollowUserProfile");
  assert.match(fn, /if \(!profile \|\| !profile\.userId \|\| profile\.isOwn \|\| profile\.followActionPending\) return;/);
});

test("toggleFollowUserProfile mirrors the block check client-side, but the database policy stays the source of truth", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "toggleFollowUserProfile");
  // Client-visible direction: the viewer has blocked this profile.
  assert.match(fn, /if \(!profile\.isFollowing && profile\.isBlocked\) return;/);
  // The other direction (they blocked the viewer) isn't something the
  // client can query — the existing catch block below must still revert
  // the optimistic update on any failure, which is how that direction
  // fails safe via the RLS rejection.
  assert.match(fn, /catch \{\s*\n\s*profile\.isFollowing = wasFollowing;/);
});

test("follow counts come from a real fetchFollowCounts call, never computed client-side", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "loadUserProfileSocialData");
  assert.match(fn, /fetchFollowCounts\(userId\)/);
});

test("Saved is not a visible profile section anywhere — there is no real saved-listings query backing it yet", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /const USER_PROFILE_SECTIONS = \["listings", "reviews", "activity", "about"\];/);
  // Neither the data-loading logic nor the listing-grid/section render
  // logic references "saved" anymore — a dead section that always shows
  // an unrelated empty state must not ship. (Contribute's own, unrelated
  // "saved places" activity row elsewhere in this file is out of scope and
  // untouched — this checks only the userProfile functions.)
  const loadTabData = extractFunction(main, "loadUserProfileTabData");
  const listingGrid = extractFunction(main, "renderUserProfileListingGrid");
  const sections = extractFunction(main, "renderUserProfileSections");
  const tabLabelStart = main.indexOf("const USER_PROFILE_TAB_LABEL = {");
  const tabLabelBlock = main.slice(tabLabelStart, main.indexOf("};", tabLabelStart));
  for (const block of [loadTabData, listingGrid, sections, tabLabelBlock]) {
    assert.doesNotMatch(block, /"saved"/);
  }
});

test("profile_reviews is read-only to normal client roles — only a trusted admin can write it", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.doesNotMatch(sql, /create policy "Authors manage own profile reviews"/);
  assert.match(sql, /create policy "Only admins write profile reviews for now" on public\.profile_reviews\s*\n\s*for all using \(public\.is_trusted_admin\(\)\)\s*\n\s*with check \(public\.is_trusted_admin\(\)\)/);
  // Reading stays open — published reviews (or your own, either side, or
  // an admin) remain visible; only writing is withheld.
  assert.match(sql, /create policy "Published profile reviews are readable" on public\.profile_reviews/);
});

test("own-profile actions differ from another account's actions on the hero", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderUserProfile");
  assert.match(fn, /profile\.isOwn\s*\n?\s*\? `<button type="button" class="auth-primary-button" data-settings-edit-profile="true">/);
  assert.match(fn, /data-user-profile-follow="true"/);
  assert.match(fn, /data-user-profile-block="true"/);
});

test("profile sections are stacked and always visible — no tab-switching", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderUserProfileSections");
  // No tab-switching semantics remain — every section renders unconditionally,
  // driven by the fixed USER_PROFILE_SECTIONS order rather than one active tab.
  assert.doesNotMatch(fn, /role="tablist"/);
  assert.doesNotMatch(fn, /role="tab"/);
  assert.doesNotMatch(fn, /data-user-profile-tab/);
  assert.match(fn, /USER_PROFILE_SECTIONS\.map/);
  assert.match(fn, /class="settings-section"/);
  assert.match(fn, /USER_PROFILE_SECTION_RENDERER\[key\]\(profile\)/);

  const rendererStart = main.indexOf("const USER_PROFILE_SECTION_RENDERER = {");
  const rendererBlock = main.slice(rendererStart, main.indexOf("};", rendererStart));
  for (const key of ["listings", "reviews", "activity", "about"]) {
    assert.match(rendererBlock, new RegExp(`${key}: renderUserProfile`), `${key} must map to a real render function`);
  }

  assert.doesNotMatch(main, /function switchUserProfileTab\(/);
  assert.doesNotMatch(main, /data-user-profile-tab/);
});

test("each listing card in the grid navigates to its own real listing detail view", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderUserProfileListingCard");
  assert.match(fn, /data-view="listingDetail" data-listing-id="\$\{item\.id\}"/);
  assert.match(fn, /href="\?view=listingDetail&id=\$\{encodeURIComponent\(item\.id\)\}"/);
});

test("the listing grid is a real 2/3/4-column responsive CSS grid, not a fixed count", async () => {
  const css = await readRepoFile("src/styles.css");
  assert.match(css, /\.profile-listing-grid \{[\s\S]{0,80}grid-template-columns: repeat\(2, 1fr\);/);
  assert.match(css, /@media \(min-width: 640px\) \{\s*\.profile-listing-grid \{\s*grid-template-columns: repeat\(3, 1fr\);/);
  assert.match(css, /@media \(min-width: 1024px\) \{\s*\.profile-listing-grid \{\s*grid-template-columns: repeat\(4, 1fr\);/);
});

test("a blocked user can be blocked/unblocked through the real user_blocks table, not an in-memory list", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "toggleBlockUserProfilePerson");
  assert.match(fn, /await blockUser\(profile\.userId\)/);
  assert.match(fn, /await unblockUser\(profile\.userId\)/);
  const supabaseClient = await readRepoFile("src/services/auth/supabaseClient.js");
  assert.match(supabaseClient, /export async function fetchBlockedUserIds\(\)/);
  assert.match(supabaseClient, /\.from\("user_blocks"\)\.select\("blocked_user_id"\)\.eq\("blocker_user_id", user\.id\)/);
});

test("missing avatar falls back to an initials/icon placeholder, missing cover falls back to a styled gradient", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderUserProfile");
  assert.match(fn, /profile\.avatarUrl \? `<img class="profile-portrait"/);
  assert.match(fn, /class="profile-portrait profile-portrait-fallback"/);
  assert.match(fn, /profile\.coverUrl \? "" : "user-profile-cover-fallback"/);
});

test("routing: userProfile is id-linked and reachable at a real /profile/:handle path, not only a query param", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /const ID_LINKED_VIEWS = new Set\(\["publicProfile", "userProfile"/);
  assert.match(main, /const profilePathMatch = window\.location\.pathname\.match\(\/\^\\\/profile\\\/\(\[\^\/\]\+\)\\\/\?\$\/\);/);
  assert.match(main, /if \(state\.activeView === "userProfile" && id\) \{/);
});

test("404.html exists as the GitHub Pages SPA fallback so a hard refresh on /profile/:handle still boots the app", async () => {
  const notFoundPage = await readRepoFile("404.html");
  assert.match(notFoundPage, /<div id="app"><\/div>/);
  assert.match(notFoundPage, /src="\/src\/main\.js/);
});

test("clicking Profile (header avatar, sign-in prompts, etc.) opens the new social profile for a signed-in user, not the legacy account dashboard", async () => {
  const main = await readRepoFile("src/main.js");
  // The generic [data-view] click handler must redirect "profile" to
  // openUserProfile() for a signed-in user before render() ever consults
  // the profile: renderProfile dispatch-table entry.
  const clickHandlerStart = main.indexOf('document.querySelectorAll("[data-view]")');
  const clickHandlerBody = main.slice(clickHandlerStart, main.indexOf("if (button.dataset.category)", clickHandlerStart));
  assert.match(clickHandlerBody, /if \(button\.dataset\.view === "profile" && state\.auth\.status === "signedIn"\) \{\s*\n\s*openUserProfile\(state\.auth\.user\.publicProfile\?\.handle \|\| state\.auth\.user\.id\);/);
  // A direct load/refresh/back-forward of ?view=profile must do the same,
  // not just the click path.
  const syncFn = extractFunction(main, "syncStateFromUrl");
  assert.match(syncFn, /if \(view === "profile" && state\.auth\.status === "signedIn"\) \{\s*\n\s*openUserProfile\(state\.auth\.user\.publicProfile\?\.handle \|\| state\.auth\.user\.id\);/);
});

test("the legacy account dashboard (My Listings/Help Requests/Businesses/Saved Places) survives as a separate account route, not deleted", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /account: renderProfile/);
  assert.match(main, /const DEEP_LINK_VIEWS = new Set\(\[[\s\S]{0,400}"account"/);
  // And the new profile links back to it for the signed-in owner, so it's
  // not orphaned now that "profile" no longer routes there directly.
  const renderFn = extractFunction(main, "renderUserProfile");
  assert.match(renderFn, /data-view="account"/);
});
