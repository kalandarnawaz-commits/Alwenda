-- Private storage for business claim and verification evidence.
-- Non-destructive forward migration. Review before applying to a live project.
--
-- Rollback approach:
-- 1. Export any evidence files that must be retained for legal/audit reasons.
-- 2. Drop the storage.objects policies created in this file.
-- 3. Delete objects in the `business-claim-evidence` bucket if allowed by retention policy.
-- 4. Delete the `business-claim-evidence` bucket.
-- 5. Drop public.claim_id_from_storage_path only if no other policy depends on it.
--
-- Object path convention:
--   <claim_id>/<uploader_user_id>/<uuid-or-original-filename>
--
-- This keeps evidence private by default while allowing Supabase Storage
-- policies to bind each object to the owning business_claims row.

insert into storage.buckets (id, name, public)
values ('business-claim-evidence', 'business-claim-evidence', false)
on conflict (id) do nothing;

create or replace function public.claim_id_from_storage_path(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  first_segment text;
begin
  first_segment := (storage.foldername(object_name))[1];
  if first_segment is null or first_segment = '' then
    return null;
  end if;
  return first_segment::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create policy "Claimants and admins read claim evidence files"
on storage.objects
for select
using (
  bucket_id = 'business-claim-evidence'
  and (
    public.is_trusted_admin()
    or exists (
      select 1
      from public.business_claims bc
      where bc.id = public.claim_id_from_storage_path(name)
        and bc.claimant_user_id = auth.uid()
    )
  )
);

create policy "Claimants upload evidence to their own claim folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-claim-evidence'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.business_claims bc
    where bc.id = public.claim_id_from_storage_path(name)
      and bc.claimant_user_id = auth.uid()
      and bc.status = 'pending'
  )
);

create policy "Claimants update own pending claim evidence files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'business-claim-evidence'
  and exists (
    select 1
    from public.business_claims bc
    where bc.id = public.claim_id_from_storage_path(name)
      and bc.claimant_user_id = auth.uid()
      and bc.status = 'pending'
  )
)
with check (
  bucket_id = 'business-claim-evidence'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.business_claims bc
    where bc.id = public.claim_id_from_storage_path(name)
      and bc.claimant_user_id = auth.uid()
      and bc.status = 'pending'
  )
);

create policy "Claimants delete own pending claim evidence files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-claim-evidence'
  and exists (
    select 1
    from public.business_claims bc
    where bc.id = public.claim_id_from_storage_path(name)
      and bc.claimant_user_id = auth.uid()
      and bc.status = 'pending'
  )
);

create policy "Admins manage all claim evidence files"
on storage.objects
for all
to authenticated
using (bucket_id = 'business-claim-evidence' and public.is_trusted_admin())
with check (bucket_id = 'business-claim-evidence' and public.is_trusted_admin());
