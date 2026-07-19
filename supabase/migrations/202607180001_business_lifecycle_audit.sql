-- Alwenda business lifecycle and ambassador audit foundation.
-- Non-destructive forward migration. Review before applying to a live project.
--
-- Rollback approach:
-- 1. Drop policies created in this file.
-- 2. Drop triggers/functions created in this file.
-- 3. Drop the new audit/link/visit tables.
-- 4. Drop lifecycle columns from public.businesses only after exporting audit data.

alter table public.businesses
  add column if not exists lifecycle_state text not null default 'imported'
    check (lifecycle_state in (
      'imported',
      'unclaimed',
      'claim_pending',
      'owner_claimed',
      'verification_pending',
      'verified',
      'verification_rejected',
      'temporarily_closed',
      'permanently_closed',
      'suspended'
    )),
  add column if not exists last_transition_reason text,
  add column if not exists last_transition_evidence jsonb not null default '{}'::jsonb,
  add column if not exists last_verified_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists closed_at timestamptz;

create index if not exists businesses_lifecycle_state_idx on public.businesses(lifecycle_state);

create table if not exists public.business_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  claim_id uuid references public.business_claims(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'business_created',
    'claim_started',
    'claim_submitted',
    'claim_reviewed',
    'verification_started',
    'verification_reviewed',
    'lifecycle_changed',
    'ambassador_visit_recorded',
    'owner_invited',
    'business_suspended',
    'business_closed',
    'business_reopened'
  )),
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  supporting_evidence jsonb not null default '{}'::jsonb,
  review_outcome text check (review_outcome is null or review_outcome in ('approved', 'rejected', 'needs_more_info', 'withdrawn', 'recorded')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists business_lifecycle_events_business_idx on public.business_lifecycle_events(business_id, created_at desc);
create index if not exists business_lifecycle_events_actor_idx on public.business_lifecycle_events(actor_user_id, created_at desc);

create table if not exists public.business_ambassador_visits (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ambassador_user_id uuid not null references auth.users(id) on delete cascade,
  visit_status text not null default 'recorded' check (visit_status in ('planned', 'recorded', 'submitted_for_review', 'accepted', 'rejected')),
  duplicate_business_ids uuid[] not null default '{}'::uuid[],
  confirmed_fields jsonb not null default '{}'::jsonb,
  corrected_fields jsonb not null default '{}'::jsonb,
  consent_captured boolean not null default false,
  consent_method text check (consent_method is null or consent_method in ('verbal', 'signed_form', 'qr_acceptance', 'email_confirmation')),
  evidence jsonb not null default '{}'::jsonb,
  notes text,
  visited_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_outcome text check (review_outcome is null or review_outcome in ('approved', 'rejected', 'needs_more_info')),
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_ambassador_visits_business_idx on public.business_ambassador_visits(business_id, visited_at desc);
create index if not exists business_ambassador_visits_ambassador_idx on public.business_ambassador_visits(ambassador_user_id, visited_at desc);

create table if not exists public.business_claim_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  claim_token_hash text not null unique,
  delivery_method text not null check (delivery_method in ('qr_code', 'sms', 'email', 'printed_card', 'manual')),
  status text not null default 'active' check (status in ('active', 'used', 'expired', 'revoked')),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists business_claim_links_business_idx on public.business_claim_links(business_id, created_at desc);
create index if not exists business_claim_links_creator_idx on public.business_claim_links(created_by, created_at desc);

drop trigger if exists set_business_ambassador_visits_updated_at on public.business_ambassador_visits;
create trigger set_business_ambassador_visits_updated_at
before update on public.business_ambassador_visits
for each row execute function public.set_updated_at();

create or replace function public.business_protected_fields_changed(old_row public.businesses, new_row public.businesses)
returns boolean
language sql
stable
as $$
  select
    old_row.claim_status is distinct from new_row.claim_status
    or old_row.verification_status is distinct from new_row.verification_status
    or old_row.lifecycle_state is distinct from new_row.lifecycle_state
    or old_row.owner_user_id is distinct from new_row.owner_user_id
    or old_row.last_verified_at is distinct from new_row.last_verified_at
    or old_row.suspended_at is distinct from new_row.suspended_at
    or old_row.closed_at is distinct from new_row.closed_at;
$$;

create or replace function public.guard_business_protected_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.business_protected_fields_changed(old, new) and not public.is_trusted_admin() then
    raise exception 'Only trusted reviewers can change business ownership, claim, verification, or lifecycle state.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_business_protected_fields on public.businesses;
create trigger guard_business_protected_fields
before update on public.businesses
for each row execute function public.guard_business_protected_fields();

create or replace function public.record_business_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.business_protected_fields_changed(old, new) then
    insert into public.business_lifecycle_events (
      business_id,
      actor_user_id,
      reviewer_user_id,
      event_type,
      previous_state,
      new_state,
      supporting_evidence,
      review_outcome,
      reason
    )
    values (
      new.id,
      auth.uid(),
      case when public.is_trusted_admin() then auth.uid() else null end,
      case
        when old.lifecycle_state is distinct from new.lifecycle_state then 'lifecycle_changed'
        when old.claim_status is distinct from new.claim_status then 'claim_reviewed'
        when old.verification_status is distinct from new.verification_status then 'verification_reviewed'
        else 'lifecycle_changed'
      end,
      jsonb_build_object(
        'claim_status', old.claim_status,
        'verification_status', old.verification_status,
        'lifecycle_state', old.lifecycle_state,
        'owner_user_id', old.owner_user_id
      ),
      jsonb_build_object(
        'claim_status', new.claim_status,
        'verification_status', new.verification_status,
        'lifecycle_state', new.lifecycle_state,
        'owner_user_id', new.owner_user_id
      ),
      coalesce(new.last_transition_evidence, '{}'::jsonb),
      case
        when new.verification_status = 'verified' or new.claim_status = 'claimed' or new.lifecycle_state = 'verified' then 'approved'
        when new.verification_status = 'rejected' or new.claim_status = 'rejected' or new.lifecycle_state = 'verification_rejected' then 'rejected'
        else 'recorded'
      end,
      new.last_transition_reason
    );
  end if;
  return new;
end;
$$;

drop trigger if exists record_business_lifecycle_event on public.businesses;
create trigger record_business_lifecycle_event
after update on public.businesses
for each row execute function public.record_business_lifecycle_event();

alter table public.business_lifecycle_events enable row level security;
alter table public.business_ambassador_visits enable row level security;
alter table public.business_claim_links enable row level security;

create policy "Public can read non-sensitive lifecycle events"
on public.business_lifecycle_events
for select
using (
  public.is_trusted_admin()
  or exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_user_id = auth.uid()
  )
  or actor_user_id = auth.uid()
);

create policy "Admins append lifecycle events"
on public.business_lifecycle_events
for insert
with check (public.is_trusted_admin());

create policy "Ambassadors create visit records"
on public.business_ambassador_visits
for insert
with check (auth.uid() = ambassador_user_id);

create policy "Ambassadors and owners view relevant visits"
on public.business_ambassador_visits
for select
using (
  public.is_trusted_admin()
  or auth.uid() = ambassador_user_id
  or exists (
    select 1 from public.businesses b
    where b.id = business_id and b.owner_user_id = auth.uid()
  )
);

create policy "Ambassadors update own unreviewed visits"
on public.business_ambassador_visits
for update
using (auth.uid() = ambassador_user_id and reviewed_at is null)
with check (auth.uid() = ambassador_user_id and reviewed_at is null);

create policy "Admins review ambassador visits"
on public.business_ambassador_visits
for update
using (public.is_trusted_admin())
with check (public.is_trusted_admin());

create policy "Admins create claim links"
on public.business_claim_links
for insert
with check (public.is_trusted_admin() and auth.uid() = created_by);

create policy "Claim link creators and admins read claim links"
on public.business_claim_links
for select
using (public.is_trusted_admin() or auth.uid() = created_by or auth.uid() = used_by);

create policy "Admins manage claim links"
on public.business_claim_links
for update
using (public.is_trusted_admin())
with check (public.is_trusted_admin());
