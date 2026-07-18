-- Alwenda production foundation
-- Forward-only migration for Supabase Postgres. Review before applying to a live project.
--
-- Rollback approach:
-- 1. Export any production data that must be retained.
-- 2. Drop policies/triggers/functions created by this migration.
-- 3. Drop dependent tables in reverse dependency order only after data export.
-- 4. Recreate from backup if this has already been applied to a shared environment.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_trusted_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'moderator', 'service');
$$;

create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  city text not null default 'Vilnius',
  profession text not null default '',
  languages text[] not null default array['English']::text[],
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  reputation_score integer not null default 0 check (reputation_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  contact_email text,
  contact_phone text,
  preferred_language text not null default 'en',
  onboarding_complete boolean not null default false,
  notification_preferences jsonb not null default '{"messages":true,"offers":true,"community":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  category text not null,
  description text,
  address text,
  neighbourhood text,
  lat double precision,
  lng double precision,
  phone text,
  email text,
  website text,
  opening_hours jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  source_id text,
  source_url text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed', 'pending', 'claimed', 'rejected')),
  tags text[] not null default '{}'::text[],
  photos jsonb not null default '[]'::jsonb,
  ai_attributes jsonb not null default '{}'::jsonb,
  last_source_update timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  title text not null,
  description text,
  category text not null check (category in ('buy_sell', 'rentals', 'jobs', 'local_services', 'vehicles', 'property', 'businesses', 'offers')),
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'sold', 'expired', 'removed')),
  price_amount numeric(12,2) check (price_amount is null or price_amount >= 0),
  price_currency text not null default 'EUR',
  price_period text check (price_period is null or price_period in ('one_time', 'hour', 'day', 'month', 'quote')),
  location_label text,
  neighbourhood text,
  lat double precision,
  lng double precision,
  tags text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_listings (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'community',
  neighbourhood text,
  status text not null default 'published' check (status in ('draft', 'published', 'hidden', 'removed')),
  tags text[] not null default '{}'::text[],
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_claims (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null,
  contact_email text not null,
  contact_phone text,
  role text not null,
  verification_method text not null check (verification_method in ('business_email_domain', 'phone_verification', 'document_upload', 'website_ownership', 'manual_review')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.business_claims(id) on delete cascade,
  claimant_user_id uuid not null references auth.users(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('document', 'domain_email', 'phone', 'website', 'note')),
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((business_id is not null)::int + (listing_id is not null)::int = 1)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  subject text,
  context_type text check (context_type is null or context_type in ('listing', 'business', 'booking', 'support')),
  context_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('participant', 'moderator')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = target_conversation_id
      and cp.user_id = auth.uid()
  ) or public.is_trusted_admin();
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.alwen_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alwen_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.alwen_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'business', 'post', 'comment', 'profile', 'message')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  offers boolean not null default true,
  community boolean not null default true,
  marketing boolean not null default false,
  push_enabled boolean not null default false,
  email_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists businesses_category_idx on public.businesses(category);
create index if not exists businesses_neighbourhood_idx on public.businesses(neighbourhood);
create index if not exists listings_owner_idx on public.listings(owner_user_id);
create index if not exists listings_status_category_idx on public.listings(status, category);
create index if not exists community_posts_author_idx on public.community_posts(author_user_id);
create index if not exists comments_post_idx on public.comments(post_id);
create index if not exists business_claims_business_idx on public.business_claims(business_id);
create index if not exists business_claims_claimant_idx on public.business_claims(claimant_user_id);
create index if not exists reviews_business_idx on public.reviews(business_id);
create index if not exists reviews_listing_idx on public.reviews(listing_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at);
create index if not exists reports_reporter_idx on public.reports(reporter_user_id);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id);

drop trigger if exists set_public_profiles_updated_at on public.public_profiles;
create trigger set_public_profiles_updated_at before update on public.public_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_private_profiles_updated_at on public.private_profiles;
create trigger set_private_profiles_updated_at before update on public.private_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at before update on public.businesses for each row execute function public.set_updated_at();
drop trigger if exists set_listings_updated_at on public.listings;
create trigger set_listings_updated_at before update on public.listings for each row execute function public.set_updated_at();
drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at before update on public.community_posts for each row execute function public.set_updated_at();
drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at before update on public.comments for each row execute function public.set_updated_at();
drop trigger if exists set_business_claims_updated_at on public.business_claims;
create trigger set_business_claims_updated_at before update on public.business_claims for each row execute function public.set_updated_at();
drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();
drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();
drop trigger if exists set_alwen_conversations_updated_at on public.alwen_conversations;
create trigger set_alwen_conversations_updated_at before update on public.alwen_conversations for each row execute function public.set_updated_at();
drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at before update on public.reports for each row execute function public.set_updated_at();
drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

alter table public.public_profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.saved_listings enable row level security;
alter table public.community_posts enable row level security;
alter table public.comments enable row level security;
alter table public.business_claims enable row level security;
alter table public.business_claim_evidence enable row level security;
alter table public.reviews enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.alwen_conversations enable row level security;
alter table public.alwen_messages enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.audit_events enable row level security;

create policy "Public profiles are readable" on public.public_profiles for select using (true);
create policy "Users manage own public profile" on public.public_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own private profile" on public.private_profiles for all using (auth.uid() = user_id or public.is_trusted_admin()) with check (auth.uid() = user_id or public.is_trusted_admin());

create policy "Businesses are public readable" on public.businesses for select using (true);
create policy "Owners manage their businesses" on public.businesses for all using (auth.uid() = owner_user_id or public.is_trusted_admin()) with check (auth.uid() = owner_user_id or public.is_trusted_admin());

create policy "Published listings are public readable" on public.listings for select using (status = 'published' or auth.uid() = owner_user_id or public.is_trusted_admin());
create policy "Owners create listings" on public.listings for insert with check (auth.uid() = owner_user_id);
create policy "Owners update listings" on public.listings for update using (auth.uid() = owner_user_id or public.is_trusted_admin()) with check (auth.uid() = owner_user_id or public.is_trusted_admin());
create policy "Owners delete listings" on public.listings for delete using (auth.uid() = owner_user_id or public.is_trusted_admin());

create policy "Listing images follow listing visibility" on public.listing_images for select using (exists (select 1 from public.listings l where l.id = listing_id and (l.status = 'published' or l.owner_user_id = auth.uid() or public.is_trusted_admin())));
create policy "Listing owners manage images" on public.listing_images for all using (exists (select 1 from public.listings l where l.id = listing_id and (l.owner_user_id = auth.uid() or public.is_trusted_admin()))) with check (exists (select 1 from public.listings l where l.id = listing_id and (l.owner_user_id = auth.uid() or public.is_trusted_admin())));

create policy "Users manage own saved listings" on public.saved_listings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Published community posts are readable" on public.community_posts for select using (status = 'published' or auth.uid() = author_user_id or public.is_trusted_admin());
create policy "Authors manage community posts" on public.community_posts for all using (auth.uid() = author_user_id or public.is_trusted_admin()) with check (auth.uid() = author_user_id or public.is_trusted_admin());

create policy "Visible comments are readable" on public.comments for select using (status = 'published' or auth.uid() = author_user_id or public.is_trusted_admin());
create policy "Authors manage comments" on public.comments for all using (auth.uid() = author_user_id or public.is_trusted_admin()) with check (auth.uid() = author_user_id or public.is_trusted_admin());

create policy "Users create own business claims" on public.business_claims for insert with check (auth.uid() = claimant_user_id and status = 'pending' and reviewed_by is null and reviewed_at is null);
create policy "Claimants view own business claims" on public.business_claims for select using (auth.uid() = claimant_user_id or public.is_trusted_admin());
create policy "Claimants may withdraw pending claims" on public.business_claims for update using (auth.uid() = claimant_user_id and status = 'pending') with check (auth.uid() = claimant_user_id and status = 'withdrawn');
create policy "Admins review business claims" on public.business_claims for update using (public.is_trusted_admin()) with check (public.is_trusted_admin());

create policy "Claimants manage own claim evidence" on public.business_claim_evidence for all using (auth.uid() = claimant_user_id or public.is_trusted_admin()) with check (auth.uid() = claimant_user_id or public.is_trusted_admin());

create policy "Published reviews are readable" on public.reviews for select using (status = 'published' or auth.uid() = author_user_id or public.is_trusted_admin());
create policy "Authors manage reviews" on public.reviews for all using (auth.uid() = author_user_id or public.is_trusted_admin()) with check (auth.uid() = author_user_id or public.is_trusted_admin());

create policy "Participants view conversations" on public.conversations for select using (public.is_conversation_participant(id) or auth.uid() = created_by);
create policy "Users create conversations" on public.conversations for insert with check (auth.uid() = created_by);
create policy "Participants update conversations" on public.conversations for update using (public.is_conversation_participant(id) or auth.uid() = created_by) with check (public.is_conversation_participant(id) or auth.uid() = created_by);

create policy "Participants view participant rows" on public.conversation_participants for select using (public.is_conversation_participant(conversation_id) or auth.uid() = user_id);
create policy "Conversation creators add participants" on public.conversation_participants for insert with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid()) or public.is_trusted_admin());
create policy "Participants leave conversations" on public.conversation_participants for delete using (auth.uid() = user_id or public.is_trusted_admin());

create policy "Participants read messages" on public.messages for select using (public.is_conversation_participant(conversation_id));
create policy "Participants send own messages" on public.messages for insert with check (auth.uid() = sender_user_id and public.is_conversation_participant(conversation_id));

create policy "Users manage own Alwen conversations" on public.alwen_conversations for all using (auth.uid() = user_id or public.is_trusted_admin()) with check (auth.uid() = user_id or public.is_trusted_admin());
create policy "Users manage own Alwen messages" on public.alwen_messages for all using (auth.uid() = user_id or public.is_trusted_admin()) with check (auth.uid() = user_id or public.is_trusted_admin());

create policy "Users manage own blocks" on public.user_blocks for all using (auth.uid() = blocker_user_id or public.is_trusted_admin()) with check (auth.uid() = blocker_user_id or public.is_trusted_admin());

create policy "Reporters and moderators view reports" on public.reports for select using (auth.uid() = reporter_user_id or public.is_trusted_admin());
create policy "Users create own reports" on public.reports for insert with check (auth.uid() = reporter_user_id);
create policy "Moderators update reports" on public.reports for update using (public.is_trusted_admin()) with check (public.is_trusted_admin());

create policy "Users manage notification preferences" on public.notification_preferences for all using (auth.uid() = user_id or public.is_trusted_admin()) with check (auth.uid() = user_id or public.is_trusted_admin());

create policy "Admins read audit events" on public.audit_events for select using (public.is_trusted_admin());
create policy "Authenticated users append own audit events" on public.audit_events for insert with check (auth.uid() = actor_user_id or public.is_trusted_admin());
