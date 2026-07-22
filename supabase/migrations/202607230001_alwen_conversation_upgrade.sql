-- Alwen 2.0 — the unified conversation experience. public.alwen_conversations
-- and public.alwen_messages already exist (202607150001_production_foundation.sql)
-- with correct owner-scoped RLS ("Users manage own Alwen conversations/messages")
-- — this migration only adds the columns the new multi-turn conversation UI
-- needs: a message-type discriminator (text/voice/translation/structured
-- result/system), translation fields, a structured-result payload, and a
-- conversation-level mode flag for live two-way translation.
--
-- Rollback approach:
-- 1. Stop reading/writing message_type, detected_language, original_text,
--    translated_text, result_type, result_payload, and conversations.mode
--    from any caller (src/main.js, supabase/functions/alwen-chat).
-- 2. The columns can then be dropped in a separate, reviewed forward
--    migration. No existing column, row, or RLS policy is altered here.

alter table public.alwen_messages
  add column if not exists message_type text not null default 'text'
  check (message_type in ('text', 'voice', 'translation', 'structured_result', 'system'));

alter table public.alwen_messages
  add column if not exists detected_language text;

alter table public.alwen_messages
  add column if not exists original_text text;

alter table public.alwen_messages
  add column if not exists translated_text text;

alter table public.alwen_messages
  add column if not exists result_type text
  check (result_type is null or result_type in ('place', 'professional'));

alter table public.alwen_messages
  add column if not exists result_payload jsonb not null default '{}'::jsonb;

alter table public.alwen_conversations
  add column if not exists mode text not null default 'chat'
  check (mode in ('chat', 'liveTranslate'));
