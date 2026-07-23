import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readRepoFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("DAC7 readiness migration adds a tax identifier distinct from VAT, without a filing pipeline", async () => {
  const sql = await readRepoFile("supabase/migrations/202607220003_dac7_readiness.sql");
  assert.match(sql, /alter table public\.trader_verifications[\s\S]*add column if not exists tax_identification_number text/);
  assert.match(sql, /add column if not exists tax_identification_country text/);
  assert.doesNotMatch(sql, /create (or replace )?function public\.(submit|export|generate|file)_dac7/i, "must not build a filing pipeline, only capture the data");
  assert.doesNotMatch(sql, /create table.*dac7_(filings|submissions|reports)/i);
});

test("DAC7 readiness migration does not touch the existing dac7_subject_boundaries gate", async () => {
  const sql = await readRepoFile("supabase/migrations/202607220003_dac7_readiness.sql");
  assert.doesNotMatch(sql, /alter table public\.dac7_subject_boundaries/);
  assert.doesNotMatch(sql, /create table.*dac7_subject_boundaries/);
});

test("listings gets a sold_at timestamp stamped only on first transition into sold", async () => {
  const sql = await readRepoFile("supabase/migrations/202607220003_dac7_readiness.sql");
  assert.match(sql, /alter table public\.listings[\s\S]*add column if not exists sold_at timestamptz/);
  assert.match(sql, /new\.status = 'sold' and \(old\.status is distinct from 'sold'\)/);
  assert.match(sql, /create trigger stamp_listing_sold_at/);
  assert.match(sql, /before update of status on public\.listings/);
});

test("trader_consideration_totals_yearly is a live view scoped by owner, year, and currency — not a synced table", async () => {
  const sql = await readRepoFile("supabase/migrations/202607220003_dac7_readiness.sql");
  assert.match(sql, /create or replace view public\.trader_consideration_totals_yearly as/);
  assert.match(sql, /group by owner_user_id, extract\(year from sold_at\), price_currency/);
  assert.match(sql, /where status = 'sold' and sold_at is not null/);
  assert.doesNotMatch(sql, /create table.*trader_consideration_totals_yearly/);
});

test("DAC7 readiness migration is additive only — no destructive SQL, no new required (not null) submission fields", async () => {
  const sql = await readRepoFile("supabase/migrations/202607220003_dac7_readiness.sql");
  assert.doesNotMatch(sql, /drop table|drop schema|truncate|delete from|drop column/i);
  assert.doesNotMatch(sql, /alter column tax_identification_number set not null/);
  assert.match(sql, /-- Rollback approach:/i);
});
