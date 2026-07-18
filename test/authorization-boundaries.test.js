import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

test("one user cannot access another user's private profile records", async () => {
  const sql = await readRepoFile("supabase/migrations/202607150001_production_foundation.sql");
  assert.match(sql, /create table if not exists public\.private_profiles/);
  assert.match(sql, /alter table public\.private_profiles enable row level security/);
  assert.match(sql, /Users manage own private profile/);
  assert.match(sql, /auth\.uid\(\) = user_id or public\.is_trusted_admin\(\)/);
  assert.ok(!/Private profiles are readable/i.test(sql));
});

test("business claimants cannot approve their own claims", async () => {
  const sql = await readRepoFile("supabase/migrations/202607150001_production_foundation.sql");
  assert.match(sql, /Users create own business claims/);
  assert.match(sql, /status = 'pending'/);
  assert.match(sql, /reviewed_by is null and reviewed_at is null/);
  assert.match(sql, /Admins review business claims/);
  assert.match(sql, /public\.is_trusted_admin\(\)/);
  assert.ok(!/claimant.*approved/i.test(sql));
});

test("non-reviewers cannot access reviewer-only lifecycle records", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");
  assert.match(sql, /business_lifecycle_events/);
  assert.match(sql, /Admins append lifecycle events/);
  assert.match(sql, /Admins review ambassador visits/);
  assert.match(sql, /public\.is_trusted_admin\(\)/);
  assert.ok(!/for insert\s+with check\s+\(true\)/i.test(sql));
});

test("business evidence is not publicly readable", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180002_business_claim_evidence_storage.sql");
  assert.match(sql, /values \('business-claim-evidence', 'business-claim-evidence', false\)/);
  assert.match(sql, /Claimants and admins read claim evidence files/);
  assert.match(sql, /bc\.claimant_user_id = auth\.uid\(\)/);
  assert.match(sql, /public\.is_trusted_admin\(\)/);
  assert.ok(!/Public can view business claim evidence/i.test(sql));
});

test("client roles cannot bypass protected business lifecycle states", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");
  assert.match(sql, /guard_business_protected_fields/);
  assert.match(sql, /not public\.is_trusted_admin\(\)/);
  assert.match(sql, /raise exception 'Only trusted reviewers can change business ownership, claim, verification, or lifecycle state\.'/);
  assert.match(sql, /old_row\.lifecycle_state is distinct from new_row\.lifecycle_state/);
  assert.match(sql, /old_row\.owner_user_id is distinct from new_row\.owner_user_id/);
});
