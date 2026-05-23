-- Add 'note' item type to coach_library_items for typed text entries.
alter table coach_library_items
  drop constraint coach_library_items_item_type_check;

alter table coach_library_items
  add constraint coach_library_items_item_type_check
  check (item_type in ('youtube','book','article','pdf','podcast','note'));

-- Public storage bucket for library file uploads.
-- Files are uploaded by coaches and served publicly via CDN URL.
insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', true)
on conflict (id) do nothing;

create policy "coaches can upload library files"
  on storage.objects for insert
  with check (bucket_id = 'library-files' and auth.role() = 'authenticated');

create policy "public can read library files"
  on storage.objects for select
  using (bucket_id = 'library-files');
