-- Real analytics destination for the typed client event schema
-- (src/services/analytics.js) — replaces the old localStorage-only ring
-- buffer, which never left the device and couldn't answer basic product
-- questions ("was an onboarded business viewed/contacted", "did a user
-- come back in week 2"). No third-party analytics account/key is
-- introduced — events are written straight into this project's own
-- Supabase, queryable with plain SQL.
--
-- Rollback approach: stop writing from the client (revert
-- src/services/analytics.js) first; the table can then be dropped in a
-- separate, reviewed forward migration once nothing depends on it. No
-- other table is altered by this migration, so nothing else is affected.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid not null,
  session_id uuid not null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  app_release text,
  app_env text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_idx on public.analytics_events (name, occurred_at);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id, occurred_at) where user_id is not null;
create index if not exists analytics_events_anonymous_idx on public.analytics_events (anonymous_id, occurred_at);

alter table public.analytics_events enable row level security;

-- Insert-own only: a signed-in user may only attribute events to their own
-- user_id (or leave it null for pre-login/anonymous activity); nobody may
-- insert an event claiming to be a different user.
create policy "Users record their own analytics events" on public.analytics_events
  for insert
  with check (user_id is null or user_id = auth.uid());

-- No update/delete policy exists for anyone but admins — an analytics
-- event is an immutable fact once recorded.
create policy "Admins manage analytics events" on public.analytics_events
  for all
  using (public.is_trusted_admin())
  with check (public.is_trusted_admin());

-- No general select policy for regular users — event data (even a user's
-- own) isn't exposed back to the client; only admins query it, e.g.:
--
--   -- Was an onboarded business viewed/contacted?
--   select props->>'businessId' as business_id,
--          count(*) filter (where name = 'business_viewed') as views,
--          count(*) filter (where name = 'business_contacted') as contacts
--   from public.analytics_events
--   where name in ('business_viewed', 'business_contacted')
--   group by props->>'businessId';
--
--   -- Week-2 retention: users whose first session_started was in week W
--   -- and who have at least one session_started 7-13 days later.
--   with first_session as (
--     select coalesce(user_id::text, anonymous_id::text) as identity,
--            min(occurred_at) as first_seen
--     from public.analytics_events
--     where name = 'session_started'
--     group by 1
--   )
--   select date_trunc('week', f.first_seen) as cohort_week,
--          count(distinct f.identity) as cohort_size,
--          count(distinct e.user_id::text || e.anonymous_id::text) filter (
--            where e.occurred_at between f.first_seen + interval '7 days' and f.first_seen + interval '13 days'
--          ) as returned_week_2
--   from first_session f
--   join public.analytics_events e on coalesce(e.user_id::text, e.anonymous_id::text) = f.identity and e.name = 'session_started'
--   group by 1;
