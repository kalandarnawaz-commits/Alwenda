-- Adds a canonical, persisted category_id to public.help_requests and
-- public.listings, backing the new shared CATEGORY_CONFIG taxonomy
-- (src/data/categoryConfig.js). Nullable and purely additive: no existing
-- column, enum, constraint, or RLS policy is touched. Existing rows are
-- NOT backfilled by this migration — they stay category_id = null and are
-- read through normalizeOpportunityCategory(), which classifies the
-- legacy free-text `category` column at read time instead. New rows
-- populate category_id going forward from the client.
--
-- Rollback approach: drop the two new indexes, then the two new columns.
-- Nothing else in either table is affected, so this is fully self-contained.

alter table public.help_requests
  add column if not exists category_id text;

alter table public.listings
  add column if not exists category_id text;

-- Indexed for the new public browse/filter paths (fetchOpenHelpRequests,
-- fetchPublicListings) that filter by category_id once the client has
-- normalized/classified a record. No index on listings/help_requests'
-- existing `category` columns is added here — those already have one
-- (help_requests_category_idx, listings_status_category_idx).
create index if not exists help_requests_category_id_idx on public.help_requests(category_id);
create index if not exists listings_category_id_idx on public.listings(category_id);
