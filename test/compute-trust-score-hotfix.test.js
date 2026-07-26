import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

const HOTFIX_MIGRATION_PATH = "supabase/migrations/202607250002_restrict_compute_trust_score.sql";
const DEFAULT_PRIVILEGES_PATH = "supabase/migrations/202607180005_default_privileges.sql";

// 202607240001_profile_social_identity.sql revoked EXECUTE on
// compute_trust_score(uuid) from PUBLIC, which normally locks a function
// down. But this repo's default-privileges migration grants EXECUTE on
// EVERY function created afterward directly to anon/authenticated/
// service_role, as a standing rule — independent of a `revoke ... from
// public` on any individual function. Confirmed live: a direct probe
// against the production database showed anon/authenticated still had
// EXECUTE despite the revoke. This test locks in the actual fix (explicit
// per-role revokes) so a future migration edit can't silently drop them
// and reintroduce the gap.
test("compute_trust_score explicitly revokes EXECUTE from anon and authenticated, not just PUBLIC", async () => {
  const sql = await readRepoFile(HOTFIX_MIGRATION_PATH);
  assert.match(sql, /revoke execute on function public\.compute_trust_score\(uuid\) from anon;/);
  assert.match(sql, /revoke execute on function public\.compute_trust_score\(uuid\) from authenticated;/);
});

test("the hotfix does not touch postgres/service_role execute rights, table structure, RLS, or refresh_trust_score's own permissions", async () => {
  const sql = await readRepoFile(HOTFIX_MIGRATION_PATH);
  assert.doesNotMatch(sql, /revoke execute on function public\.compute_trust_score\(uuid\) from (postgres|service_role)/);
  assert.doesNotMatch(sql, /create or replace function/);
  assert.doesNotMatch(sql, /alter table/);
  assert.doesNotMatch(sql, /create policy/);
  // refresh_trust_score is legitimately named in this file's explanatory
  // header comment (why it's unaffected) — what must NOT exist is an
  // actual grant/revoke statement touching its own permissions.
  assert.doesNotMatch(sql, /(grant|revoke)[\s\S]{0,80}function public\.refresh_trust_score/);
});

test("the hotfix's own header documents the root cause: revoke-from-PUBLIC alone was insufficient against a standing default-privileges grant", async () => {
  const sql = await readRepoFile(HOTFIX_MIGRATION_PATH);
  assert.match(sql, /default.privileges/i);
  assert.match(sql, /anon, authenticated, service_role/);
});

// Confirms the actual mechanism this hotfix exists to counteract is still
// present in the repo (i.e. this test would fail loudly, not silently, if
// that migration were ever removed or rewritten without updating this
// explanation).
test("the default-privileges migration this hotfix counteracts still grants EXECUTE on functions to anon/authenticated by default", async () => {
  const sql = await readRepoFile(DEFAULT_PRIVILEGES_PATH);
  assert.match(sql, /alter default privileges in schema public grant all on functions to anon, authenticated, service_role;/);
});
