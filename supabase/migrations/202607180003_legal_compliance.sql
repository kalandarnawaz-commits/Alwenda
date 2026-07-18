create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, policy_version)
);

create table if not exists public.legal_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  explanation text not null,
  content_url text not null,
  reporter_name text not null,
  reporter_email text not null,
  good_faith_confirmed boolean not null check (good_faith_confirmed),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('access','portability','deletion','privacy_support','appeal')),
  status text not null default 'open' check (status in ('open','reviewing','completed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.legal_acceptances enable row level security;
alter table public.legal_reports enable row level security;
alter table public.privacy_requests enable row level security;

create policy "Users insert own legal acceptance" on public.legal_acceptances for insert with check (auth.uid() = user_id);
create policy "Users view own legal acceptance" on public.legal_acceptances for select using (auth.uid() = user_id);
create policy "Anyone submits legal reports" on public.legal_reports for insert with check (reporter_user_id is null or reporter_user_id = auth.uid());
create policy "Reporters view own legal reports" on public.legal_reports for select using (reporter_user_id = auth.uid() or public.is_trusted_admin());
create policy "Moderators review legal reports" on public.legal_reports for update using (public.is_trusted_admin()) with check (public.is_trusted_admin());
create policy "Users create own privacy requests" on public.privacy_requests for insert with check (auth.uid() = user_id);
create policy "Users view own privacy requests" on public.privacy_requests for select using (auth.uid() = user_id);
create policy "Admins review privacy requests" on public.privacy_requests for update using (public.is_trusted_admin()) with check (public.is_trusted_admin());
-- Rollback approach: disable the related UI first, then remove policies and tables in a separately reviewed forward migration after exporting required legal records.
