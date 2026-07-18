import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));

async function readRepoFile(path) {
  return readFile(`${rootDir}${path}`, "utf8");
}

test("business lifecycle migration represents every launch-readiness state distinctly", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");
  const requiredStates = [
    "imported",
    "unclaimed",
    "claim_pending",
    "owner_claimed",
    "verification_pending",
    "verified",
    "verification_rejected",
    "temporarily_closed",
    "permanently_closed",
    "suspended"
  ];

  assert.match(sql, /add column if not exists lifecycle_state text not null default 'imported'/);
  for (const state of requiredStates) {
    assert.match(sql, new RegExp(`'${state}'`), `${state} must be modeled explicitly`);
  }
  assert.ok(!/is_claimed boolean|is_verified boolean|unclaimed boolean/i.test(sql), "lifecycle cannot collapse to boolean fields");
});

test("business lifecycle migration records auditable actor, reviewer, reason, evidence, and state transitions", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");

  assert.match(sql, /create table if not exists public\.business_lifecycle_events/);
  assert.match(sql, /actor_user_id uuid references auth\.users/);
  assert.match(sql, /reviewer_user_id uuid references auth\.users/);
  assert.match(sql, /previous_state jsonb not null/);
  assert.match(sql, /new_state jsonb not null/);
  assert.match(sql, /supporting_evidence jsonb not null/);
  assert.match(sql, /review_outcome text/);
  assert.match(sql, /reason text/);
  assert.match(sql, /created_at timestamptz not null default now\(\)/);
  assert.match(sql, /create trigger record_business_lifecycle_event/);
});

test("business lifecycle migration prevents unauthorized verification and ownership changes", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");

  assert.match(sql, /create or replace function public\.guard_business_protected_fields/);
  assert.match(sql, /not public\.is_trusted_admin\(\)/);
  assert.match(sql, /Only trusted reviewers can change business ownership, claim, verification, or lifecycle state/);
  assert.match(sql, /old_row\.owner_user_id is distinct from new_row\.owner_user_id/);
  assert.match(sql, /old_row\.verification_status is distinct from new_row\.verification_status/);
  assert.match(sql, /old_row\.claim_status is distinct from new_row\.claim_status/);
  assert.match(sql, /old_row\.lifecycle_state is distinct from new_row\.lifecycle_state/);
});

test("ambassador ground-team workflow has auditable mobile visit and claim-link tables", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");

  assert.match(sql, /create table if not exists public\.business_ambassador_visits/);
  assert.match(sql, /duplicate_business_ids uuid\[\]/);
  assert.match(sql, /confirmed_fields jsonb/);
  assert.match(sql, /corrected_fields jsonb/);
  assert.match(sql, /consent_captured boolean/);
  assert.match(sql, /evidence jsonb/);
  assert.match(sql, /review_outcome text/);
  assert.match(sql, /create table if not exists public\.business_claim_links/);
  assert.match(sql, /claim_token_hash text not null unique/);
  assert.match(sql, /delivery_method text not null check/);
  assert.match(sql, /expires_at timestamptz not null/);
});

test("new business lifecycle tables have RLS and scoped policies", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180001_business_lifecycle_audit.sql");

  for (const table of ["business_lifecycle_events", "business_ambassador_visits", "business_claim_links"]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must enable RLS`);
  }

  assert.match(sql, /Admins append lifecycle events/);
  assert.match(sql, /Ambassadors create visit records/);
  assert.match(sql, /auth\.uid\(\) = ambassador_user_id/);
  assert.match(sql, /Admins create claim links/);
  assert.match(sql, /public\.is_trusted_admin\(\) and auth\.uid\(\) = created_by/);
});

test("business claim evidence storage is private and scoped to claimant or admin", async () => {
  const sql = await readRepoFile("supabase/migrations/202607180002_business_claim_evidence_storage.sql");

  assert.match(sql, /values \('business-claim-evidence', 'business-claim-evidence', false\)/);
  assert.match(sql, /Object path convention:/);
  assert.match(sql, /<claim_id>\/<uploader_user_id>/);
  assert.match(sql, /create or replace function public\.claim_id_from_storage_path/);
  assert.match(sql, /Claimants and admins read claim evidence files/);
  assert.match(sql, /Claimants upload evidence to their own claim folder/);
  assert.match(sql, /\(storage\.foldername\(name\)\)\[2\] = auth\.uid\(\)::text/);
  assert.match(sql, /bc\.claimant_user_id = auth\.uid\(\)/);
  assert.match(sql, /bc\.status = 'pending'/);
  assert.match(sql, /Admins manage all claim evidence files/);
});

test("pilot readiness report documents rollback and launch blockers", async () => {
  const report = await readRepoFile("docs/pilot-readiness-report.md");
  assert.match(report, /Critical before external pilot/);
  assert.match(report, /Business lifecycle and claim verification/);
  assert.match(report, /business-claim-evidence/);
  assert.match(report, /Rollback approach/);
  assert.match(report, /Pilot-readiness score/);
});
