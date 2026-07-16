-- Real backing table for Hire "post a request" posts — including the ones
-- Alwen creates via tool-calling after the user confirms. Forward-only
-- migration for Supabase Postgres. Review before applying to a live project.

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  description text not null,
  urgency text not null default 'flexible' check (urgency in ('today', 'thisWeek', 'flexible')),
  area text,
  city text not null default 'Vilnius',
  status text not null default 'open' check (status in ('open', 'matched', 'closed', 'cancelled')),
  created_by_alwen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists help_requests_requester_idx on public.help_requests(requester_user_id);
create index if not exists help_requests_category_idx on public.help_requests(category);

drop trigger if exists set_help_requests_updated_at on public.help_requests;
create trigger set_help_requests_updated_at before update on public.help_requests for each row execute function public.set_updated_at();

alter table public.help_requests enable row level security;

create policy "Open help requests are public readable" on public.help_requests for select using (status = 'open' or auth.uid() = requester_user_id or public.is_trusted_admin());
create policy "Requesters create own help requests" on public.help_requests for insert with check (auth.uid() = requester_user_id);
create policy "Requesters manage own help requests" on public.help_requests for update using (auth.uid() = requester_user_id or public.is_trusted_admin()) with check (auth.uid() = requester_user_id or public.is_trusted_admin());
create policy "Requesters delete own help requests" on public.help_requests for delete using (auth.uid() = requester_user_id or public.is_trusted_admin());
