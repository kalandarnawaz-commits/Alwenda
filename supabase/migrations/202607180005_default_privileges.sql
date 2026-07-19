-- Grant standard Supabase default privileges explicitly. Forward-only
-- migration for Supabase Postgres. Review before applying to a live project.
--
-- Rollback approach:
-- 1. Re-run the equivalent revoke statements if these grants must be undone.
-- 2. No data is affected — this migration only changes role privileges.
--
-- Hosted Supabase projects bootstrap these grants automatically outside of
-- migration history; a from-scratch local `supabase db reset` was found to
-- not always carry them, which surfaced as "permission denied" for the
-- authenticated role even though the relevant RLS policies were correct —
-- RLS remains the actual access-control layer here, this only makes the
-- already-designed policies reachable at the table-privilege level.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
