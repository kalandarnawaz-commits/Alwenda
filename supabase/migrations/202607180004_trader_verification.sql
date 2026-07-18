-- Secure, manual trader traceability workflow (Lithuanian/EU marketplace foundation).
-- No payment, payout, escrow, register scraping, automated approval, or DAC7 reporting is introduced.
-- Rollback approach: disable trader publication and the dashboard first; preserve audit/evidence records, then remove policies, triggers, functions, bucket, and tables only through a separately reviewed forward migration.

create or replace function public.has_trader_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_trusted_admin() and (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin','service')
    or coalesce(auth.jwt() -> 'app_metadata' -> 'trader_permissions', '[]'::jsonb) ? required_permission
  );
$$;

create table if not exists public.user_offeror_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  offeror_status text not null check (offeror_status in ('private','trader')),
  accuracy_confirmed boolean not null check (accuracy_confirmed),
  confirmed_at timestamptz not null,
  terms_version text not null,
  commercial_review_required boolean not null default false,
  status_locked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.offeror_status_history (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  previous_status text check (previous_status is null or previous_status in ('private','trader')),
  new_status text not null check (new_status in ('private','trader')),
  terms_version text not null, accuracy_confirmed boolean not null,
  change_reason text, review_required boolean not null default false,
  changed_by uuid references auth.users(id) on delete set null, changed_at timestamptz not null default now()
);

create table if not exists public.trader_verifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'not_started' check (status in ('not_started','draft','submitted','under_review','more_information_required','verified','rejected','suspended','expired')),
  legal_name text, trading_name text, legal_form text, registered_address text, operating_address text,
  public_business_address text, business_email text, business_phone text, country_of_establishment text,
  trade_register_name text, registration_number text, vat_number text,
  representative_name text, representative_role text,
  lawful_goods_confirmed boolean not null default false, accuracy_check_confirmed boolean not null default false,
  confirmation_version text, submitted_at timestamptz, reviewed_at timestamptz,
  verified_at timestamptz, expires_at timestamptz, reviewer_user_id uuid references auth.users(id) on delete set null,
  user_visible_reason text, internal_notes text, submission_snapshot jsonb,
  retention_exception_reason text, retention_review_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, version)
);

create table if not exists public.trader_public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  legal_or_trading_name text not null, country text not null, business_location text not null,
  public_email text not null, public_phone text not null, trade_register_name text,
  registration_number text, vat_display text, product_compliance_confirmed boolean not null,
  verification_status text not null default 'verified' check (verification_status in ('verified','suspended','expired')),
  updated_at timestamptz not null default now()
);

create table if not exists public.trader_field_checks (
  id uuid primary key default gen_random_uuid(), verification_id uuid not null references public.trader_verifications(id) on delete cascade,
  field_name text not null, result text not null check (result in ('confirmed','inconsistent','unverifiable')),
  source_name text not null, checked_at timestamptz not null default now(), checked_by uuid not null references auth.users(id), notes text,
  unique(verification_id, field_name, source_name, checked_at)
);

create table if not exists public.trader_register_checks (
  id uuid primary key default gen_random_uuid(), verification_id uuid not null references public.trader_verifications(id) on delete cascade,
  provider_key text not null default 'manual', source_name text not null,
  result text not null check (result in ('confirmed','inconsistent','unverifiable','retry','source_unavailable')),
  checked_at timestamptz not null default now(), checked_by uuid not null references auth.users(id), reference text, notes text
);

create table if not exists public.trader_verification_documents (
  id uuid primary key default gen_random_uuid(), verification_id uuid not null references public.trader_verifications(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('identity','representative_authority','registration_evidence','address_evidence')),
  storage_path text not null unique, original_filename text not null, mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  malware_scan_status text not null default 'pending' check (malware_scan_status in ('pending','clean','rejected','unavailable')),
  retention_delete_after timestamptz, deleted_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.trader_verification_events (
  id uuid primary key default gen_random_uuid(), verification_id uuid not null references public.trader_verifications(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null, event_type text not null,
  previous_status text, new_status text, user_visible_reason text, metadata jsonb not null default '{}'::jsonb,
  previous_event_hash text, event_hash text not null, created_at timestamptz not null default now()
);

create table if not exists public.trader_document_access_events (
  id uuid primary key default gen_random_uuid(), document_id uuid not null references public.trader_verification_documents(id) on delete cascade,
  accessor_user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null, accessed_at timestamptz not null default now()
);

create table if not exists public.private_commercial_review_queue (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null, signal_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','reviewing','clarification_requested','closed')),
  created_at timestamptz not null default now(), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
  unique(user_id, signal_type, status)
);

create table if not exists public.trader_risk_configuration (
  key text primary key, integer_value integer not null, description text not null, updated_at timestamptz not null default now()
);
insert into public.trader_risk_configuration(key,integer_value,description) values ('private_listing_volume_30d',20,'Internal review signal only; never an automatic legal classification.') on conflict(key) do nothing;

create table if not exists public.dac7_subject_boundaries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  module_enabled boolean not null default false, encrypted_tax_payload jsonb,
  legal_basis_note text, last_reviewed_at timestamptz,
  check (module_enabled = false or legal_basis_note is not null)
);

alter table public.listings add column if not exists offeror_status text check (offeror_status in ('private','trader'));
update public.listings set offeror_status = coalesce(offeror_status,'private') where offeror_status is null;
alter table public.listings alter column offeror_status set not null;

create or replace function public.normalise_identifier(value text) returns text language sql immutable as $$
  select nullif(upper(regexp_replace(trim(value), '[[:space:]-]+', '', 'g')), '');
$$;

create or replace function public.append_trader_event(p_verification_id uuid,p_event_type text,p_previous text,p_new text,p_reason text,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare previous_hash text; created_time timestamptz := clock_timestamp(); new_hash text;
begin
  select event_hash into previous_hash from public.trader_verification_events where verification_id=p_verification_id order by created_at desc,id desc limit 1;
  new_hash := encode(digest(coalesce(previous_hash,'GENESIS')||p_verification_id::text||coalesce(auth.uid()::text,'system')||p_event_type||coalesce(p_previous,'')||coalesce(p_new,'')||created_time::text||coalesce(p_metadata,'{}'::jsonb)::text,'sha256'),'hex');
  insert into public.trader_verification_events(verification_id,actor_user_id,event_type,previous_status,new_status,user_visible_reason,metadata,previous_event_hash,event_hash,created_at)
  values(p_verification_id,auth.uid(),p_event_type,p_previous,p_new,p_reason,coalesce(p_metadata,'{}'::jsonb),previous_hash,new_hash,created_time);
end; $$;

create or replace function public.set_offeror_status(p_status text,p_terms_version text,p_confirmed boolean,p_reason text default null)
returns public.user_offeror_status language plpgsql security definer set search_path=public as $$
declare old_status text; commercial boolean; result public.user_offeror_status;
begin
  if auth.uid() is null or p_status not in ('private','trader') or not p_confirmed or length(trim(p_terms_version))<3 then raise exception 'Valid status, confirmation and Terms version are required.'; end if;
  select offeror_status into old_status from public.user_offeror_status where user_id=auth.uid();
  select exists(select 1 from public.listings where owner_user_id=auth.uid() and offeror_status='trader') into commercial;
  insert into public.user_offeror_status(user_id,offeror_status,accuracy_confirmed,confirmed_at,terms_version,commercial_review_required,status_locked_at)
  values(auth.uid(),p_status,true,now(),p_terms_version,(old_status='trader' and p_status='private' and commercial),case when commercial then now() else null end)
  on conflict(user_id) do update set offeror_status=excluded.offeror_status,accuracy_confirmed=true,confirmed_at=now(),terms_version=excluded.terms_version,
    commercial_review_required=excluded.commercial_review_required,updated_at=now() returning * into result;
  insert into public.offeror_status_history(user_id,previous_status,new_status,terms_version,accuracy_confirmed,change_reason,review_required,changed_by)
  values(auth.uid(),old_status,p_status,p_terms_version,true,p_reason,result.commercial_review_required,auth.uid());
  return result;
end; $$;

create or replace function public.submit_trader_verification(p_id uuid,p_confirmation_version text)
returns public.trader_verifications language plpgsql security definer set search_path=public as $$
declare v public.trader_verifications; old_state text;
begin
  select * into v from public.trader_verifications where id=p_id and user_id=auth.uid() for update;
  old_state := v.status;
  if v.id is null or v.status not in ('draft','more_information_required','rejected','expired') then raise exception 'Verification cannot be submitted from its current state.'; end if;
  if nullif(trim(v.legal_name),'') is null or nullif(trim(v.registered_address),'') is null or nullif(trim(v.public_business_address),'') is null or
     nullif(trim(v.business_email),'') is null or nullif(trim(v.business_phone),'') is null or nullif(trim(v.country_of_establishment),'') is null or
     nullif(trim(v.trade_register_name),'') is null or public.normalise_identifier(v.registration_number) is null or
     nullif(trim(v.representative_name),'') is null or nullif(trim(v.representative_role),'') is null or not v.lawful_goods_confirmed or not v.accuracy_check_confirmed then
    raise exception 'Required trader information and confirmations are incomplete.';
  end if;
  update public.trader_verifications set status='submitted',registration_number=public.normalise_identifier(registration_number),vat_number=public.normalise_identifier(vat_number),
    confirmation_version=p_confirmation_version,submitted_at=now(),submission_snapshot=to_jsonb(v)-'internal_notes',updated_at=now()
    where id=p_id returning * into v;
  perform public.append_trader_event(p_id,'submitted',old_state,'submitted',null,jsonb_build_object('confirmation_version',p_confirmation_version));
  return v;
end; $$;

create or replace function public.trader_transition_allowed(old_state text,new_state text) returns boolean language sql immutable as $$ select case old_state
  when 'submitted' then new_state in ('under_review','more_information_required','rejected')
  when 'under_review' then new_state in ('more_information_required','verified','rejected')
  when 'more_information_required' then new_state in ('submitted','rejected')
  when 'verified' then new_state in ('suspended','expired')
  when 'suspended' then new_state in ('under_review','verified','rejected')
  when 'rejected' then new_state='draft'
  when 'expired' then new_state='draft'
  else false end; $$;

create or replace function public.review_trader_verification(p_id uuid,p_new_status text,p_user_reason text,p_internal_notes text default null,p_expires_at timestamptz default null)
returns public.trader_verifications language plpgsql security definer set search_path=public as $$
declare v public.trader_verifications; old_state text;
begin
  if not public.has_trader_permission('verification_decide') then raise exception 'Reviewer permission required.'; end if;
  select * into v from public.trader_verifications where id=p_id for update; old_state:=v.status;
  if not public.trader_transition_allowed(old_state,p_new_status) then raise exception 'Invalid verification transition.'; end if;
  if p_new_status in ('more_information_required','rejected','suspended') and nullif(trim(p_user_reason),'') is null then raise exception 'A user-visible reason is required.'; end if;
  if p_new_status='verified' then
    if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '2 years' then raise exception 'A future verification expiry within two years is required.'; end if;
    if nullif(trim(p_internal_notes),'') is null then raise exception 'Reviewer decision notes are required.'; end if;
    if not exists(select 1 from public.trader_register_checks c where c.verification_id=p_id and c.result in ('confirmed','unverifiable')) then raise exception 'A documented register check is required.'; end if;
    if exists(select 1 from public.trader_field_checks c where c.verification_id=p_id and c.result='inconsistent') then raise exception 'Resolve inconsistent field checks before verification.'; end if;
    if not exists(select 1 from public.trader_verification_documents d where d.verification_id=p_id and d.document_type='registration_evidence' and d.malware_scan_status='clean' and d.deleted_at is null) then raise exception 'Clean registration evidence is required.'; end if;
    if exists(select 1 from public.trader_verification_documents d where d.verification_id=p_id and d.deleted_at is null and d.malware_scan_status<>'clean') then raise exception 'All submitted documents must pass malware scanning.'; end if;
  end if;
  update public.trader_verifications set status=p_new_status,reviewer_user_id=auth.uid(),reviewed_at=now(),user_visible_reason=p_user_reason,
    internal_notes=p_internal_notes,verified_at=case when p_new_status='verified' then now() else verified_at end,
    expires_at=case when p_new_status='verified' then p_expires_at else expires_at end,updated_at=now() where id=p_id returning * into v;
  if p_new_status='verified' then
    insert into public.trader_public_profiles(user_id,legal_or_trading_name,country,business_location,public_email,public_phone,trade_register_name,registration_number,vat_display,product_compliance_confirmed,verification_status)
    values(v.user_id,coalesce(nullif(v.trading_name,''),v.legal_name),v.country_of_establishment,v.public_business_address,v.business_email,v.business_phone,v.trade_register_name,v.registration_number,
      case when v.vat_number is null then 'Not provided' else 'VAT registered' end,v.lawful_goods_confirmed,'verified')
    on conflict(user_id) do update set legal_or_trading_name=excluded.legal_or_trading_name,country=excluded.country,business_location=excluded.business_location,
      public_email=excluded.public_email,public_phone=excluded.public_phone,trade_register_name=excluded.trade_register_name,registration_number=excluded.registration_number,
      vat_display=excluded.vat_display,product_compliance_confirmed=excluded.product_compliance_confirmed,verification_status='verified',updated_at=now();
  elsif p_new_status in ('suspended','expired') then update public.trader_public_profiles set verification_status=p_new_status,updated_at=now() where user_id=v.user_id;
  end if;
  perform public.append_trader_event(p_id,'review_decision',old_state,p_new_status,p_user_reason,'{}'::jsonb);
  return v;
end; $$;

create or replace function public.enforce_listing_offeror_status() returns trigger language plpgsql security definer set search_path=public as $$
declare classification text; verification public.trader_verifications;
begin
  select offeror_status into classification from public.user_offeror_status where user_id=new.owner_user_id;
  if classification is null then raise exception 'Confirm private individual or trader/business status before publishing.'; end if;
  new.offeror_status:=classification;
  new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('offerorStatus',classification);
  if new.status='published' and classification='trader' then
    select * into verification from public.trader_verifications where user_id=new.owner_user_id and status='verified' and (expires_at is null or expires_at>now()) order by version desc limit 1;
    if verification.id is null then raise exception 'Current trader verification is required before publishing.'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists enforce_listing_offeror_status on public.listings;
create trigger enforce_listing_offeror_status before insert or update of owner_user_id,status,offeror_status,metadata on public.listings for each row execute function public.enforce_listing_offeror_status();

create or replace function public.restrict_trader_listings_after_decision() returns trigger language plpgsql security definer set search_path=public as $$ begin
  if new.status in ('rejected','suspended','expired') then update public.listings set status='hidden' where owner_user_id=new.user_id and offeror_status='trader' and status='published'; end if; return new; end; $$;
drop trigger if exists restrict_trader_listings_after_decision on public.trader_verifications;
create trigger restrict_trader_listings_after_decision after update of status on public.trader_verifications for each row execute function public.restrict_trader_listings_after_decision();

create or replace function public.signal_private_commercial_activity() returns trigger language plpgsql security definer set search_path=public as $$
declare threshold_value integer; listing_count integer;
begin
  if new.offeror_status<>'private' then return new; end if;
  select integer_value into threshold_value from public.trader_risk_configuration where key='private_listing_volume_30d';
  select count(*) into listing_count from public.listings where owner_user_id=new.owner_user_id and created_at>now()-interval '30 days';
  if listing_count>=coalesce(threshold_value,20) then
    insert into public.private_commercial_review_queue(user_id,signal_type,signal_metadata) values(new.owner_user_id,'listing_volume',jsonb_build_object('count_30d',listing_count)) on conflict do nothing;
    update public.user_offeror_status set commercial_review_required=true where user_id=new.owner_user_id;
  end if; return new;
end; $$;
drop trigger if exists signal_private_commercial_activity on public.listings;
create trigger signal_private_commercial_activity after insert on public.listings for each row execute function public.signal_private_commercial_activity();

alter table public.user_offeror_status enable row level security; alter table public.offeror_status_history enable row level security;
alter table public.trader_verifications enable row level security; alter table public.trader_public_profiles enable row level security;
alter table public.trader_field_checks enable row level security; alter table public.trader_register_checks enable row level security;
alter table public.trader_verification_documents enable row level security; alter table public.trader_verification_events enable row level security;
alter table public.trader_document_access_events enable row level security; alter table public.private_commercial_review_queue enable row level security;
alter table public.trader_risk_configuration enable row level security; alter table public.dac7_subject_boundaries enable row level security;

create policy "Users view own classification" on public.user_offeror_status for select using(auth.uid()=user_id or public.has_trader_permission('verification_view'));
create policy "Users view own classification history" on public.offeror_status_history for select using(auth.uid()=user_id or public.has_trader_permission('audit_view'));
create policy "Users create verification drafts" on public.trader_verifications for insert with check(auth.uid()=user_id and status in ('not_started','draft'));
create policy "Users view own verification" on public.trader_verifications for select using(auth.uid()=user_id or public.has_trader_permission('verification_view'));
create policy "Users edit mutable verification drafts" on public.trader_verifications for update using(auth.uid()=user_id and status in ('not_started','draft','more_information_required')) with check(auth.uid()=user_id and status in ('not_started','draft','more_information_required'));
create policy "Verified trader disclosures are public" on public.trader_public_profiles for select using(verification_status='verified' or auth.uid()=user_id or public.has_trader_permission('verification_view'));
create policy "Reviewers view field checks" on public.trader_field_checks for select using(public.has_trader_permission('verification_view'));
create policy "Reviewers create field checks" on public.trader_field_checks for insert with check(public.has_trader_permission('verification_decide') and checked_by=auth.uid());
create policy "Reviewers view register checks" on public.trader_register_checks for select using(public.has_trader_permission('verification_view'));
create policy "Reviewers create register checks" on public.trader_register_checks for insert with check(public.has_trader_permission('verification_decide') and checked_by=auth.uid());
create policy "Users view own document metadata" on public.trader_verification_documents for select using(auth.uid()=owner_user_id or public.has_trader_permission('document_view'));
create policy "Users create own document metadata" on public.trader_verification_documents for insert with check(auth.uid()=owner_user_id and exists(select 1 from public.trader_verifications v where v.id=verification_id and v.user_id=auth.uid() and v.status in ('draft','more_information_required')));
create policy "Users view own verification events" on public.trader_verification_events for select using(exists(select 1 from public.trader_verifications v where v.id=verification_id and v.user_id=auth.uid()) or public.has_trader_permission('audit_view'));
create policy "Document access auditors view events" on public.trader_document_access_events for select using(public.has_trader_permission('audit_view'));
create policy "Document viewers append access events" on public.trader_document_access_events for insert with check(accessor_user_id=auth.uid() and public.has_trader_permission('document_view'));
create policy "Reviewers view risk queue" on public.private_commercial_review_queue for select using(public.has_trader_permission('verification_view'));
create policy "Reviewers manage risk queue" on public.private_commercial_review_queue for update using(public.has_trader_permission('verification_decide')) with check(public.has_trader_permission('verification_decide'));
create policy "Only administrators view risk config" on public.trader_risk_configuration for select using(public.has_trader_permission('verification_decide'));
create policy "Only administrators update risk config" on public.trader_risk_configuration for update using(public.has_trader_permission('verification_decide')) with check(public.has_trader_permission('verification_decide'));
create policy "Users view own DAC7 boundary" on public.dac7_subject_boundaries for select using(auth.uid()=user_id or public.has_trader_permission('tax_export'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('trader-verification-documents','trader-verification-documents',false,10485760,array['image/jpeg','image/png','application/pdf']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.trader_verification_id_from_path(name text) returns uuid language plpgsql immutable as $$ begin return (storage.foldername(name))[1]::uuid; exception when others then return null; end; $$;
create policy "Owners upload trader documents to drafts" on storage.objects for insert to authenticated with check(bucket_id='trader-verification-documents' and (storage.foldername(name))[2]=auth.uid()::text and storage.extension(name) in ('pdf','png','jpg','jpeg') and exists(select 1 from public.trader_verifications v where v.id=public.trader_verification_id_from_path(name) and v.user_id=auth.uid() and v.status in ('draft','more_information_required')));
create policy "Owners view own trader documents" on storage.objects for select to authenticated using(bucket_id='trader-verification-documents' and (storage.foldername(name))[2]=auth.uid()::text);
-- Reviewer object access is intentionally not granted directly. It must be added through a short-lived,
-- server-side signed-URL endpoint that first verifies malware_scan_status='clean' and appends an access event.
create policy "Owners delete unsubmitted trader documents" on storage.objects for delete to authenticated using(bucket_id='trader-verification-documents' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.trader_verifications v where v.id=public.trader_verification_id_from_path(name) and v.user_id=auth.uid() and v.status in ('draft','more_information_required')));

-- Recreate public listing visibility so expired/suspended trader records disappear even before a scheduled expiry job updates listing status.
drop policy if exists "Published listings are public readable" on public.listings;
create policy "Eligible published listings are public readable" on public.listings for select using(
  auth.uid()=owner_user_id or public.is_trusted_admin() or (status='published' and (offeror_status='private' or exists(select 1 from public.trader_verifications v where v.user_id=owner_user_id and v.status='verified' and (v.expires_at is null or v.expires_at>now()))))
);

revoke all on function public.set_offeror_status(text,text,boolean,text) from public; grant execute on function public.set_offeror_status(text,text,boolean,text) to authenticated;
revoke all on function public.submit_trader_verification(uuid,text) from public; grant execute on function public.submit_trader_verification(uuid,text) to authenticated;
revoke all on function public.review_trader_verification(uuid,text,text,text,timestamptz) from public; grant execute on function public.review_trader_verification(uuid,text,text,text,timestamptz) to authenticated;
