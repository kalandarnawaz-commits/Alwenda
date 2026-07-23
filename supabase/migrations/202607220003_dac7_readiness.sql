-- DAC7 reporting-readiness: makes sure the underlying data a future filing
-- pipeline would need already exists, so that pipeline (if and when it's
-- built) never needs a re-migration to backfill history it's missing.
-- Deliberately does NOT build a filing pipeline, does not make any new
-- field mandatory at submission, and does not touch the existing,
-- separately-gated public.dac7_subject_boundaries placeholder table (see
-- 202607180004_trader_verification.sql) — that table is a distinct,
-- tighter-scoped gate for actually activating DAC7 reporting later, not
-- where ordinary KYC-tier fields like a tax identifier belong.
--
-- Rollback approach:
-- 1. Stop reading tax_identification_number/tax_identification_country and
--    the trader_consideration_totals_yearly view from any caller.
-- 2. The two new nullable columns and the view can then be dropped in a
--    separate, reviewed forward migration. No existing data or column is
--    altered by this migration.

-- A tax identification number (TIN) is distinct from a VAT number
-- (trader_verifications.vat_number already exists) — DAC7 requires the
-- TIN and its issuing jurisdiction specifically. Both nullable: capturing
-- the field is this task's job, not making it a new submission requirement.
alter table public.trader_verifications
  add column if not exists tax_identification_number text,
  add column if not exists tax_identification_country text;

-- The closest honest proxy for "an accepted offer" in an app with no
-- in-app payments/escrow (per this schema's own standing comment: "No
-- payment, payout, escrow... is introduced") is a listing the seller
-- marked sold after negotiating and finalizing the deal directly with the
-- buyer. sold_at records exactly when that happened, distinct from
-- updated_at (which changes on any unrelated edit).
alter table public.listings
  add column if not exists sold_at timestamptz;

create or replace function public.stamp_listing_sold_at() returns trigger
language plpgsql as $$
begin
  if new.status = 'sold' and (old.status is distinct from 'sold') then
    new.sold_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_listing_sold_at on public.listings;
create trigger stamp_listing_sold_at
  before update of status on public.listings
  for each row execute function public.stamp_listing_sold_at();

-- A calendar-year running total of consideration per provider — a plain
-- view, not a table, so it stays live off sold_at/price_amount with no
-- separate sync step and needs no migration of its own to stay correct.
-- Views run with the querying user's own permissions by default, so the
-- existing "Eligible published listings are public readable" policy on
-- public.listings (auth.uid() = owner_user_id or is_trusted_admin() or
-- ...) already scopes this correctly per-provider without any new RLS.
create or replace view public.trader_consideration_totals_yearly as
select
  owner_user_id,
  extract(year from sold_at)::int as calendar_year,
  price_currency,
  count(*) as sold_listing_count,
  sum(price_amount) as total_consideration
from public.listings
where status = 'sold' and sold_at is not null
group by owner_user_id, extract(year from sold_at), price_currency;
