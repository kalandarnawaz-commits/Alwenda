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
  assert.match(sql, /create policy "Users create own follow relationships" on public\.profile_follows for insert with check \(auth\.uid\(\) = follower_user_id\)/);
  assert.match(sql, /create policy "Users remove own follow relationships" on public\.profile_follows for delete using \(auth\.uid\(\) = follower_user_id\)/);
});

test("follow relationships and their counts are publicly readable (visibility)", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.match(sql, /create policy "Follow relationships are readable" on public\.profile_follows for select using \(true\)/);
});

test("trust_scores has no client/owner write policy — only the SECURITY DEFINER refresh function may write it", async () => {
  const sql = await readRepoFile(MIGRATION_PATH);
  assert.doesNotMatch(sql, /on public\.trust_scores for (insert|update|delete|all)/);
  assert.match(sql, /create or replace function public\.refresh_trust_score/);
  assert.match(sql, /security definer/);
  assert.match(sql, /auth\.uid\(\) is distinct from p_user_id and not public\.is_trusted_admin\(\)/);
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

test("follow counts come from a real fetchFollowCounts call, never computed client-side", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "loadUserProfileSocialData");
  assert.match(fn, /fetchFollowCounts\(userId\)/);
});

test("own profile shows Listings/Saved/Reviews/Activity/About; a public profile never exposes Saved", async () => {
  const main = await readRepoFile("src/main.js");
  assert.match(main, /const OWN_USER_PROFILE_TABS = \["listings", "saved", "reviews", "activity", "about"\];/);
  assert.match(main, /const PUBLIC_USER_PROFILE_TABS = \["listings", "reviews", "activity", "about"\];/);
  assert.doesNotMatch(main, /const PUBLIC_USER_PROFILE_TABS = \[[^\]]*"saved"/);
});

test("own-profile actions differ from another account's actions on the hero", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderUserProfile");
  assert.match(fn, /profile\.isOwn\s*\n?\s*\? `<button type="button" class="auth-primary-button" data-settings-edit-profile="true">/);
  assert.match(fn, /data-user-profile-follow="true"/);
  assert.match(fn, /data-user-profile-block="true"/);
});

test("profile tabs are a real WAI-ARIA tablist with keyboard-reachable, labelled tabs", async () => {
  const main = await readRepoFile("src/main.js");
  const fn = extractFunction(main, "renderUserProfileTabs");
  assert.match(fn, /role="tablist"/);
  assert.match(fn, /role="tab"/);
  assert.match(fn, /aria-selected="\$\{profile\.activeTab === tab\}"/);
  assert.match(fn, /aria-controls="profile-tabpanel"/);
  assert.match(fn, /role="tabpanel"/);
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
