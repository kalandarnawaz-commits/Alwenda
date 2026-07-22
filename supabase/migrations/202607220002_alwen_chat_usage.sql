-- Per-request token/cost logging for supabase/functions/alwen-chat, plus
-- the backing table its new rate-limit and daily-cost-ceiling checks query
-- before ever calling OpenAI. Closes a real gap: today nothing beyond
-- Supabase's own platform-level Edge Function limits stops one user from
-- calling this function (and spending real OpenAI budget) as fast as their
-- network allows.
--
-- Rollback approach: remove the rate-limit/cost-ceiling checks and the
-- usage-insert call from alwen-chat/index.ts first (so nothing writes here
-- anymore); the table can then be dropped in a separate, reviewed forward
-- migration. No other table is altered by this migration.

create table if not exists public.alwen_chat_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid,
  created_at timestamptz not null default now(),
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric(10,6),
  model text,
  flagged_injection boolean not null default false
);

create index if not exists alwen_chat_usage_user_time_idx on public.alwen_chat_usage (user_id, created_at);

alter table public.alwen_chat_usage enable row level security;

-- The edge function runs with the caller's own JWT (Authorization header
-- passed straight through — see alwen-chat/index.ts), never a service-role
-- key, so it needs an ordinary insert-own policy like every other
-- user-scoped table here (help_requests, alwen_messages).
create policy "Users record their own alwen chat usage" on public.alwen_chat_usage
  for insert
  with check (user_id = auth.uid());

create policy "Users view their own alwen chat usage" on public.alwen_chat_usage
  for select
  using (user_id = auth.uid() or public.is_trusted_admin());
