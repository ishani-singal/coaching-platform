-- Drop is_published from modules and programs entirely.
-- coaching_packages.is_published is NOT touched.

-- Drop RLS policies that filter on is_published before removing the column.
drop policy if exists "public reads modules"  on modules;
drop policy if exists "public reads sections" on module_sections;

-- Replace with policies that allow access without a published gate.
-- Service role (used server-side) always bypasses RLS.
-- Authenticated users can read all modules/sections (coaches and enrolled clients).
create policy "authenticated reads modules"  on modules
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "authenticated reads sections" on module_sections
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Remove the columns.
alter table modules  drop column if exists is_published;
alter table programs drop column if exists is_published;
