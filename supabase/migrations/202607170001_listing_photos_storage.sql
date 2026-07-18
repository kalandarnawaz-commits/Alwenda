-- Real photo storage for marketplace listings, backing the previously-unused
-- listing_images table from the production foundation migration. Forward-only
-- migration for Supabase Postgres. Review before applying to a live project.
--
-- Rollback approach:
-- 1. Export listing image metadata and storage objects that must be retained.
-- 2. Drop listing-photos storage policies.
-- 3. Delete listing-photos objects and bucket only after retention review.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Public bucket so published listing photos load without a signed URL, same
-- as every other photo in this app (Unsplash/imported place photos). Writes
-- are still locked down below: a user may only upload/manage objects inside
-- their own "<user_id>/..." folder.
create policy "Public can view listing photos" on storage.objects for select using (bucket_id = 'listing-photos');
create policy "Users upload their own listing photos" on storage.objects for insert to authenticated with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users update their own listing photos" on storage.objects for update to authenticated using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete their own listing photos" on storage.objects for delete to authenticated using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
