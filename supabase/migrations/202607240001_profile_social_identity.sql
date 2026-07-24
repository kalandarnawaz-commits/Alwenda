-- Alwenda profile social identity: handles, cover images, bio, follow
-- relationships, person-directed reviews, and a server-owned trust score.
-- Forward-only migration for Supabase Postgres. Review before applying to a
-- live project.
--
-- Rollback approach:
-- 1. Export any production data that must be retained (profile_follows,
--    profile_reviews, trust_scores, and the new public_profiles columns).
-- 2. Drop policies/triggers/functions created by this migration.
-- 3. Drop public.trust_scores, public.profile_reviews, public.profile_follows.
-- 4. Drop the public_profiles.handle/cover_url/bio columns and their
--    constraints/index if reverting the identity fields specifically.

-- ---------------------------------------------------------------------
-- 1. Identity fields on public_profiles: handle, cover image, bio.
-- ---------------------------------------------------------------------

alter table public.public_profiles add column if not exists handle text;
alter table public.public_profiles add column if not exists cover_url text;
alter table public.public_profiles add column if not exists bio text not null default '';

-- URL-safe format: lowercase, starts with a letter, 3-24 chars total,
-- letters/digits/underscore only. Enforced here (not just client-side) so
-- no write path — including a future admin tool or a bug in the client
-- validator — can ever get an unsafe handle into the database.
alter table public.public_profiles drop constraint if exists public_profiles_handle_format;
alter table public.public_profiles add constraint public_profiles_handle_format
  check (handle is null or handle ~ '^[a-z][a-z0-9_]{2,23}$');

-- Reserved words a user must never be able to claim as a handle — route
-- names, system/staff terms, and brand terms. Kept as a function (not an
-- inline check list) so the reserved set can be extended in a future
-- migration without rewriting the constraint definition.
create or replace function public.is_reserved_handle(p_handle text)
returns boolean
language sql
immutable
as $$
  select lower(p_handle) in (
    'admin', 'administrator', 'root', 'support', 'help', 'api', 'www', 'app', 'alwenda',
    'settings', 'profile', 'profiles', 'login', 'logout', 'signup', 'signin', 'auth',
    'ops', 'system', 'staff', 'moderator', 'mod', 'official', 'null', 'undefined',
    'me', 'user', 'users', 'business', 'businesses', 'marketplace', 'explore', 'hire',
    'community', 'contribute', 'translate', 'tyt', 'alwen', 'notifications', 'messages',
    'legal', 'terms', 'privacy', 'cookies', 'safety'
  );
$$;

alter table public.public_profiles drop constraint if exists public_profiles_handle_not_reserved;
alter table public.public_profiles add constraint public_profiles_handle_not_reserved
  check (handle is null or not public.is_reserved_handle(handle));

-- Case-insensitive uniqueness — "JaneDoe" and "janedoe" are the same handle.
create unique index if not exists public_profiles_handle_unique_idx
  on public.public_profiles (lower(handle))
  where handle is not null;

-- ---------------------------------------------------------------------
-- 2. profile_follows — a normalized relationship table, never an array
--    column on public_profiles (so counts/lists scale with an index
--    instead of loading and measuring a JSON/array blob).
-- ---------------------------------------------------------------------

create table if not exists public.profile_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_user_id, followed_user_id),
  check (follower_user_id <> followed_user_id)
);

-- The primary key already covers (follower_user_id, followed_user_id) and
-- therefore follower-first lookups ("who does X follow") for free; this
-- second index makes the reverse direction ("who follows X" / follower
-- counts) equally efficient instead of a sequential scan.
create index if not exists profile_follows_followed_idx on public.profile_follows(followed_user_id);

alter table public.profile_follows enable row level security;

-- Follow graphs are public by design (matches public_profiles' own "readable
-- by anyone" policy) — follower/following counts and lists are meant to be
-- visible on any profile visibility permits viewing at all.
create policy "Follow relationships are readable" on public.profile_follows for select using (true);
-- A user may only ever create a relationship where THEY are the follower —
-- the self-follow check above and this policy together make it impossible
-- to follow yourself or to create a relationship "as" another account.
create policy "Users create own follow relationships" on public.profile_follows for insert with check (auth.uid() = follower_user_id);
create policy "Users remove own follow relationships" on public.profile_follows for delete using (auth.uid() = follower_user_id);

-- ---------------------------------------------------------------------
-- 3. profile_reviews — reviews of a *person's* conduct as a seller/buyer/
--    host, distinct from public.reviews (which reviews a business or a
--    specific listing, not a person). Kept as its own table rather than
--    widening reviews' existing two-way business_id/listing_id CHECK
--    constraint, since that constraint's exact auto-generated name
--    cannot be safely altered without a live database to verify against.
-- ---------------------------------------------------------------------

create table if not exists public.profile_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewee_user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  body text,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewer_user_id <> reviewee_user_id)
);

create index if not exists profile_reviews_reviewee_idx on public.profile_reviews(reviewee_user_id);
create index if not exists profile_reviews_reviewer_idx on public.profile_reviews(reviewer_user_id);

drop trigger if exists set_profile_reviews_updated_at on public.profile_reviews;
create trigger set_profile_reviews_updated_at before update on public.profile_reviews for each row execute function public.set_updated_at();

alter table public.profile_reviews enable row level security;

create policy "Published profile reviews are readable" on public.profile_reviews
  for select using (status = 'published' or auth.uid() = reviewer_user_id or auth.uid() = reviewee_user_id or public.is_trusted_admin());
create policy "Authors manage own profile reviews" on public.profile_reviews
  for all using (auth.uid() = reviewer_user_id or public.is_trusted_admin())
  with check (auth.uid() = reviewer_user_id or public.is_trusted_admin());

-- ---------------------------------------------------------------------
-- 4. trust_scores — server-owned. Deliberately has NO insert/update/delete
--    RLS policy for any authenticated/anon role, so a user's own JWT can
--    never write this table under any circumstance, including through a
--    bug elsewhere in the client. The only write path is the SECURITY
--    DEFINER function below, which only ever writes a value it computed
--    itself from real signals — never a client-supplied number.
-- ---------------------------------------------------------------------

create table if not exists public.trust_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score integer not null default 0 check (score >= 0 and score <= 100),
  status text not null default 'provisional' check (status in ('provisional', 'calculated')),
  factors jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now()
);

alter table public.trust_scores enable row level security;

create policy "Trust scores are readable" on public.trust_scores for select using (true);
-- No insert/update/delete policy is defined for trust_scores on purpose.

-- Computes a score from real, currently-available signals only. Where a
-- real signal this app doesn't have yet (completed transactions, payments,
-- escrow — none of that exists in this schema) would normally contribute,
-- it is simply omitted rather than invented. The result is explicitly
-- marked 'provisional' whenever the underlying signal set is too sparse
-- (an unverified, brand-new account with no listings or reviews) for a
-- numeric score to be a meaningful trust indicator, never presented as a
-- confident 'calculated' score it hasn't earned.
create or replace function public.compute_trust_score(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email_verified boolean := false;
  v_identity_verified boolean := false;
  v_trader_verified boolean := false;
  v_account_age_days integer := 0;
  v_listing_count integer := 0;
  v_review_count integer := 0;
  v_avg_rating numeric := 0;
  v_score integer := 0;
  v_status text := 'provisional';
  v_factors jsonb;
begin
  select (u.email_confirmed_at is not null), greatest(extract(day from now() - u.created_at)::integer, 0)
    into v_email_verified, v_account_age_days
    from auth.users u where u.id = p_user_id;

  select coalesce((pp.verification_status = 'verified'), false) into v_identity_verified
    from public.public_profiles pp where pp.user_id = p_user_id;

  select exists(
    select 1 from public.trader_public_profiles tp
    where tp.user_id = p_user_id and tp.verification_status = 'verified'
  ) into v_trader_verified;

  select count(*) into v_listing_count from public.listings
    where owner_user_id = p_user_id and status in ('published', 'sold');

  select count(*), coalesce(avg(rating), 0) into v_review_count, v_avg_rating
    from public.profile_reviews where reviewee_user_id = p_user_id and status = 'published';

  v_score := v_score + (case when v_email_verified then 10 else 0 end);
  v_score := v_score + (case when v_identity_verified then 25 else 0 end);
  v_score := v_score + (case when v_trader_verified then 15 else 0 end);
  v_score := v_score + least(v_account_age_days / 30, 10);        -- up to 10 pts, ~1 per month
  v_score := v_score + least(v_listing_count * 2, 20);             -- up to 20 pts
  v_score := v_score + least(round(v_avg_rating * 4)::integer, 20); -- up to 20 pts, only nonzero once reviews exist
  v_score := least(v_score, 100);

  if v_identity_verified and (v_listing_count > 0 or v_review_count > 0) then
    v_status := 'calculated';
  end if;

  v_factors := jsonb_build_object(
    'emailVerified', v_email_verified,
    'identityVerified', v_identity_verified,
    'traderVerified', v_trader_verified,
    'accountAgeDays', v_account_age_days,
    'listingCount', v_listing_count,
    'reviewCount', v_review_count,
    'avgRating', v_avg_rating
  );

  return jsonb_build_object('score', v_score, 'status', v_status, 'factors', v_factors);
end;
$$;

-- The sole write path for trust_scores. Callable by an authenticated user
-- only to refresh their OWN score (or by a trusted admin, for support
-- tooling) — never accepts or writes a client-supplied score value, only
-- the result of compute_trust_score() above.
create or replace function public.refresh_trust_score(p_user_id uuid)
returns public.trust_scores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_row public.trust_scores;
begin
  if auth.uid() is distinct from p_user_id and not public.is_trusted_admin() then
    raise exception 'Not authorized to refresh this trust score';
  end if;

  v_result := public.compute_trust_score(p_user_id);

  insert into public.trust_scores (user_id, score, status, factors, calculated_at)
  values (p_user_id, (v_result->>'score')::integer, v_result->>'status', v_result->'factors', now())
  on conflict (user_id) do update set
    score = excluded.score,
    status = excluded.status,
    factors = excluded.factors,
    calculated_at = excluded.calculated_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.refresh_trust_score(uuid) from public;
grant execute on function public.refresh_trust_score(uuid) to authenticated;
