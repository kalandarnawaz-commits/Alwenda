-- Lets a Help Request's real, RLS-scoped conversation live in the existing
-- conversations table by adding 'help_request' as a valid context_type
-- ('listing' is already valid, so Marketplace messaging needs no change
-- here). Idempotent: looks up whatever the check constraint is actually
-- named (a DO block that finds it by definition is safer than assuming
-- Postgres's auto-generated name is stable) and re-creates it under an
-- explicit name, so this migration is safe to run twice.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'conversations'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%context_type%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table public.conversations drop constraint %I', existing_constraint);
  end if;
end $$;

alter table public.conversations add constraint conversations_context_type_check
  check (context_type is null or context_type in ('listing', 'business', 'booking', 'support', 'help_request'));

-- One conversation per (context, creator) pair. This is what makes
-- conversation creation atomic against a double-click or two open tabs: the
-- client always upserts on (context_type, context_id, created_by) — see
-- findOrCreateConversation() in supabaseClient.js — so a race resolves to
-- the same row instead of two duplicate conversations. NULL context_type
-- rows are each distinct under a standard unique index, so this never
-- affects context-less conversations.
create unique index if not exists conversations_context_creator_unique_idx
  on public.conversations (context_type, context_id, created_by);

-- Rollback approach: (do not run except deliberately, and only once no real
-- help_request-context conversations exist, since the constraint would
-- otherwise reject their rows)
--   drop index if exists public.conversations_context_creator_unique_idx;
--   alter table public.conversations drop constraint conversations_context_type_check;
--   alter table public.conversations add constraint conversations_context_type_check
--     check (context_type is null or context_type in ('listing', 'business', 'booking', 'support'));
