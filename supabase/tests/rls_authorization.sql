-- Runtime RLS authorization probes for the disposable local Supabase database.
-- This file is intentionally test-only and must run only against a local stack.

\set ON_ERROR_STOP on

do $$
begin
  if current_database() <> 'postgres' then
    raise exception 'Refusing to run RLS probes outside the local Supabase postgres database.';
  end if;
end;
$$;

create or replace function pg_temp.set_test_claims(test_user_id uuid, test_role text default null)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', test_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', test_user_id::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('role', coalesce(test_role, 'user'))
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not condition then
    raise exception 'RLS assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.assert_error(statement text, message text)
returns void
language plpgsql
as $$
begin
  execute statement;
  raise exception 'RLS assertion failed: expected error for %', message;
exception
  when others then
    if sqlerrm like 'RLS assertion failed:%' then
      raise;
    end if;
end;
$$;

create or replace function pg_temp.exec_row_count(statement text)
returns integer
language plpgsql
as $$
declare
  affected_rows integer;
begin
  execute statement;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'alice@example.test', '', now(), now(), now(), '{"role":"user"}', '{}'),
  ('00000000-0000-4000-8000-000000000002', 'bob@example.test', '', now(), now(), now(), '{"role":"user"}', '{}'),
  ('00000000-0000-4000-8000-000000000003', 'reviewer@example.test', '', now(), now(), now(), '{"role":"moderator"}', '{}')
on conflict (id) do nothing;

insert into public.public_profiles (user_id, display_name)
values
  ('00000000-0000-4000-8000-000000000001', 'Alice'),
  ('00000000-0000-4000-8000-000000000002', 'Bob')
on conflict (user_id) do nothing;

insert into public.private_profiles (user_id, contact_email, onboarding_complete)
values
  ('00000000-0000-4000-8000-000000000001', 'alice@example.test', true),
  ('00000000-0000-4000-8000-000000000002', 'bob@example.test', true)
on conflict (user_id) do nothing;

insert into public.businesses (id, name, category, owner_user_id, claim_status, verification_status, lifecycle_state)
values
  ('10000000-0000-4000-8000-000000000001', 'Alice Cafe', 'restaurant', '00000000-0000-4000-8000-000000000001', 'unclaimed', 'unverified', 'unclaimed'),
  ('10000000-0000-4000-8000-000000000002', 'Unclaimed Repair', 'repair', null, 'unclaimed', 'unverified', 'imported')
on conflict (id) do nothing;

insert into public.user_offeror_status (user_id, offeror_status, accuracy_confirmed, confirmed_at, terms_version)
values
  ('00000000-0000-4000-8000-000000000001', 'private', true, now(), 'RLS-TEST-FIXTURE'),
  ('00000000-0000-4000-8000-000000000002', 'private', true, now(), 'RLS-TEST-FIXTURE')
on conflict (user_id) do nothing;

insert into public.listings (id, owner_user_id, title, category, status)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Alice bicycle', 'buy_sell', 'published'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Bob laptop', 'buy_sell', 'draft')
on conflict (id) do nothing;

insert into public.business_claims (
  id,
  business_id,
  claimant_user_id,
  owner_name,
  contact_email,
  role,
  verification_method,
  status
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Alice Owner',
  'alice@example.test',
  'Owner',
  'manual_review',
  'pending'
)
on conflict (id) do nothing;

insert into public.business_claim_evidence (id, claim_id, claimant_user_id, evidence_type, storage_path, notes)
values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'document',
  '30000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/proof.pdf',
  'private evidence'
)
on conflict (id) do nothing;

begin;
  select pg_temp.set_test_claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;

  select pg_temp.assert_true(
    (select count(*) = 1 from public.private_profiles where user_id = '00000000-0000-4000-8000-000000000001'),
    'user reads own private profile'
  );

  select pg_temp.assert_true(
    (select count(*) = 0 from public.private_profiles where user_id = '00000000-0000-4000-8000-000000000002'),
    'user cannot read another private profile'
  );

  update public.private_profiles
  set contact_phone = '+37060000001'
  where user_id = '00000000-0000-4000-8000-000000000001';

  select pg_temp.assert_true(
    pg_temp.exec_row_count($statement$
      update public.private_profiles
      set contact_phone = '+37060000099'
      where user_id = '00000000-0000-4000-8000-000000000002'
    $statement$) = 0,
    'user cannot update another private profile'
  );
rollback;

begin;
  select pg_temp.set_test_claims('00000000-0000-4000-8000-000000000001');
  set local role authenticated;

  select pg_temp.assert_error(
    $statement$
      update public.business_claims
      set status = 'approved', reviewed_by = '00000000-0000-4000-8000-000000000001', reviewed_at = now()
      where id = '30000000-0000-4000-8000-000000000001'
    $statement$,
    'claimant cannot approve own business claim'
  );

  select pg_temp.assert_error(
    $statement$
      update public.businesses
      set lifecycle_state = 'verified', verification_status = 'verified', claim_status = 'claimed'
      where id = '10000000-0000-4000-8000-000000000002'
    $statement$,
    'client cannot directly create verified business state'
  );

  select pg_temp.assert_true(
    (select count(*) = 1 from public.business_claim_evidence where claimant_user_id = '00000000-0000-4000-8000-000000000001'),
    'claimant reads own evidence metadata'
  );
rollback;

begin;
  select pg_temp.set_test_claims('00000000-0000-4000-8000-000000000002');
  set local role authenticated;

  select pg_temp.assert_true(
    (select count(*) = 0 from public.business_claim_evidence),
    'another user cannot read private claim evidence metadata'
  );

  select pg_temp.assert_true(
    pg_temp.exec_row_count($statement$
      update public.listings
      set title = 'Tampered title'
      where id = '20000000-0000-4000-8000-000000000001'
    $statement$) = 0,
    'user cannot edit another user listing'
  );
rollback;

begin;
  select pg_temp.set_test_claims('00000000-0000-4000-8000-000000000003', 'moderator');
  set local role authenticated;

  update public.business_claims
  set status = 'approved',
      reviewed_by = '00000000-0000-4000-8000-000000000003',
      reviewed_at = now(),
      review_notes = 'Approved in local RLS probe.'
  where id = '30000000-0000-4000-8000-000000000001';

  update public.businesses
  set lifecycle_state = 'verified',
      verification_status = 'verified',
      claim_status = 'claimed',
      owner_user_id = '00000000-0000-4000-8000-000000000001',
      last_transition_reason = 'Local RLS probe approval',
      last_verified_at = now()
  where id = '10000000-0000-4000-8000-000000000002';

  select pg_temp.assert_true(
    (select count(*) >= 1 from public.business_lifecycle_events where business_id = '10000000-0000-4000-8000-000000000002'),
    'reviewer approval creates auditable lifecycle event'
  );
rollback;

select 'RLS authorization probes passed.' as result;
