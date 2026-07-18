import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("trader workflow has explicit states, controlled transitions, and human decisions", async () => {
  const sql = await read("supabase/migrations/202607180004_trader_verification.sql");
  for (const state of ["not_started", "draft", "submitted", "under_review", "more_information_required", "verified", "rejected", "suspended", "expired"]) assert.match(sql, new RegExp(`'${state}'`));
  assert.match(sql, /trader_transition_allowed/);
  assert.match(sql, /has_trader_permission\('verification_decide'\)/);
  assert.match(sql, /source_unavailable/);
  assert.doesNotMatch(sql, /source_unavailable[^\n]+verified/i);
});

test("classification and listing status are server-derived and verified traders are enforced", async () => {
  const sql = await read("supabase/migrations/202607180004_trader_verification.sql");
  assert.match(sql, /set_offeror_status/);
  assert.match(sql, /new\.offeror_status:=classification/);
  assert.match(sql, /Current trader verification is required before publishing/);
  assert.match(sql, /commercial_review_required=true/);
});

test("verification documents are private, constrained, and reviewers only access clean files", async () => {
  const sql = await read("supabase/migrations/202607180004_trader_verification.sql");
  assert.match(sql, /public\s*:=\s*false|false\s*,\s*10485760/i);
  assert.match(sql, /image\/jpeg/);
  assert.match(sql, /application\/pdf/);
  assert.match(sql, /malware_scan_status='clean'/);
  assert.match(sql, /trader_document_access_events/);
});

test("public trader disclosure is separated from private verification evidence", async () => {
  const sql = await read("supabase/migrations/202607180004_trader_verification.sql");
  assert.match(sql, /create table if not exists public\.trader_public_profiles/);
  assert.match(sql, /create table if not exists public\.trader_verification_documents/);
  assert.doesNotMatch(sql.match(/create table if not exists public\.trader_public_profiles[\s\S]+?\);/)?.[0] || "", /storage_path|identity|internal_notes/);
});

test("client uses private storage without generating public document URLs", async () => {
  const client = await read("src/services/auth/supabaseClient.js");
  assert.match(client, /trader-verification-documents/);
  assert.doesNotMatch(client, /trader-verification-documents[\s\S]{0,500}getPublicUrl/);
  assert.match(client, /10 \* 1024 \* 1024/);
});

test("policy explains trader processing, ranking, review integrity, and human review", async () => {
  const policy = await read("src/legal/ALWENDA_LEGAL_POLICIES_EN.md");
  assert.match(policy, /## 1\.19 Ranking transparency/);
  assert.match(policy, /does not currently sell promoted placement/);
  assert.match(policy, /## 1\.20 Reviews/);
  assert.match(policy, /## 2\.13 Trader verification and traceability/);
  assert.match(policy, /do not by themselves reclassify/i);
});

