-- Merge coach_profiles into user_profiles.
-- All coach-specific columns are added as nullable to user_profiles.
-- Data is migrated, all FK constraints that pointed to coach_profiles are
-- retargeted to user_profiles(user_id), then coach_profiles is dropped.
--
-- The UUID is the same in both tables (coach_id = user_id), so no remapping needed.

-- ── 1. Add coach-specific columns to user_profiles ────────────────────────────
alter table user_profiles
  add column if not exists slug                text,
  add column if not exists display_name        text,
  add column if not exists bio                 text,
  add column if not exists custom_domain       text,
  add column if not exists persona_snapshot_id uuid,
  add column if not exists theme_config        jsonb not null default '{}'::jsonb,
  add column if not exists coaching_type       text,
  add column if not exists social_media        jsonb not null default '{}'::jsonb;

-- ── 2. Migrate data from coach_profiles ───────────────────────────────────────
update user_profiles up
set
  slug                = cp.slug,
  display_name        = cp.display_name,
  bio                 = cp.bio,
  custom_domain       = cp.custom_domain,
  persona_snapshot_id = cp.persona_snapshot_id,
  theme_config        = coalesce(cp.theme_config, '{}'::jsonb),
  coaching_type       = cp.coaching_type,
  social_media        = coalesce(cp.social_media, '{}'::jsonb)
from coach_profiles cp
where up.user_id = cp.coach_id;

-- ── 3. Add unique constraints and indexes ─────────────────────────────────────
-- NULL values are not considered equal in a UNIQUE index, so non-coach rows are fine.
create unique index if not exists user_profiles_slug_idx          on user_profiles (slug)          where slug is not null;
create unique index if not exists user_profiles_custom_domain_idx on user_profiles (custom_domain) where custom_domain is not null;

-- ── 4. Drop all FK constraints that reference coach_profiles ──────────────────
-- Postgres auto-names FKs as <table>_<column>_fkey.

-- persona_snapshots
alter table persona_snapshots
  drop constraint if exists persona_snapshots_coach_id_fkey;

-- client_profiles (from 001_core_schema)
alter table client_profiles
  drop constraint if exists client_profiles_coach_id_fkey;

-- modules, programs, coaching_packages, enrollments (from 002_programs_schema)
alter table modules
  drop constraint if exists modules_creator_coach_id_fkey;
alter table programs
  drop constraint if exists programs_creator_coach_id_fkey;
alter table coaching_packages
  drop constraint if exists coaching_packages_coach_id_fkey;
alter table enrollments
  drop constraint if exists enrollments_installing_coach_id_fkey;

-- module_licenses, program_licenses, module_ancestry, revenue_events (from 003_licensing_schema)
alter table module_licenses
  drop constraint if exists module_licenses_licensor_coach_id_fkey,
  drop constraint if exists module_licenses_licensee_coach_id_fkey;
alter table program_licenses
  drop constraint if exists program_licenses_licensor_coach_id_fkey,
  drop constraint if exists program_licenses_licensee_coach_id_fkey;
alter table module_ancestry
  drop constraint if exists module_ancestry_ancestor_coach_id_fkey;
alter table revenue_events
  drop constraint if exists revenue_events_coach_id_fkey;

-- coach_library_items, coach_client_notes, coach_client_tags, coaching_sessions (from 004_crm_schema)
alter table coach_library_items
  drop constraint if exists coach_library_items_coach_id_fkey;
alter table coach_client_notes
  drop constraint if exists coach_client_notes_coach_id_fkey;
alter table coach_client_tags
  drop constraint if exists coach_client_tags_coach_id_fkey;
alter table coaching_sessions
  drop constraint if exists coaching_sessions_coach_id_fkey;

-- coach_module_client_data (from 005_program_content_extensions)
do $$ begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'coach_module_client_data') then
    alter table coach_module_client_data
      drop constraint if exists coach_module_client_data_coach_id_fkey;
  end if;
end $$;

-- video_transcripts, coach_recommendation_settings (from 013_rag_and_accounts)
do $$ begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'video_transcripts') then
    alter table video_transcripts
      drop constraint if exists video_transcripts_coach_id_fkey;
  end if;
end $$;

do $$ begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'coach_recommendation_settings') then
    alter table coach_recommendation_settings
      drop constraint if exists coach_recommendation_settings_coach_id_fkey;
  end if;
end $$;

-- ── 5. Drop the persona_snapshot_id FK on coach_profiles before dropping the table
alter table coach_profiles
  drop constraint if exists fk_persona;

-- ── 6. Drop RLS policies and coach_profiles table ─────────────────────────────
drop policy if exists "coach owns profile" on coach_profiles;
drop policy if exists "public reads coach"  on coach_profiles;

drop table coach_profiles;

-- ── 7. Re-add FK constraints pointing to user_profiles(user_id) ──────────────

-- persona_snapshots
alter table persona_snapshots
  add constraint persona_snapshots_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id) on delete cascade;

-- client_profiles
alter table client_profiles
  add constraint client_profiles_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id) on delete cascade;

-- modules, programs, coaching_packages, enrollments
alter table modules
  add constraint modules_creator_coach_id_fkey
    foreign key (creator_coach_id) references user_profiles(user_id);
alter table programs
  add constraint programs_creator_coach_id_fkey
    foreign key (creator_coach_id) references user_profiles(user_id);
alter table coaching_packages
  add constraint coaching_packages_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id);
alter table enrollments
  add constraint enrollments_installing_coach_id_fkey
    foreign key (installing_coach_id) references user_profiles(user_id);

-- module_licenses, program_licenses, module_ancestry, revenue_events
alter table module_licenses
  add constraint module_licenses_licensor_coach_id_fkey
    foreign key (licensor_coach_id) references user_profiles(user_id),
  add constraint module_licenses_licensee_coach_id_fkey
    foreign key (licensee_coach_id) references user_profiles(user_id);
alter table program_licenses
  add constraint program_licenses_licensor_coach_id_fkey
    foreign key (licensor_coach_id) references user_profiles(user_id),
  add constraint program_licenses_licensee_coach_id_fkey
    foreign key (licensee_coach_id) references user_profiles(user_id);
alter table module_ancestry
  add constraint module_ancestry_ancestor_coach_id_fkey
    foreign key (ancestor_coach_id) references user_profiles(user_id);
alter table revenue_events
  add constraint revenue_events_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id);

-- coach_library_items, coach_client_notes, coach_client_tags, coaching_sessions
alter table coach_library_items
  add constraint coach_library_items_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id) on delete cascade;
alter table coach_client_notes
  add constraint coach_client_notes_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id);
alter table coach_client_tags
  add constraint coach_client_tags_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id);
alter table coaching_sessions
  add constraint coaching_sessions_coach_id_fkey
    foreign key (coach_id) references user_profiles(user_id);

-- coach_module_client_data
do $$ begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'coach_module_client_data') then
    alter table coach_module_client_data
      add constraint coach_module_client_data_coach_id_fkey
        foreign key (coach_id) references user_profiles(user_id) on delete cascade;
  end if;
end $$;

-- video_transcripts, coach_recommendation_settings
do $$ begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'video_transcripts') then
    alter table video_transcripts
      add constraint video_transcripts_coach_id_fkey
        foreign key (coach_id) references user_profiles(user_id) on delete cascade;
  end if;
end $$;

do $$ begin
  if exists (select from information_schema.tables where table_schema = 'public' and table_name = 'coach_recommendation_settings') then
    alter table coach_recommendation_settings
      add constraint coach_recommendation_settings_coach_id_fkey
        foreign key (coach_id) references user_profiles(user_id) on delete cascade;
  end if;
end $$;

-- ── 8. FK for persona_snapshot_id on user_profiles ───────────────────────────
alter table user_profiles
  add constraint user_profiles_persona_snapshot_id_fkey
    foreign key (persona_snapshot_id) references persona_snapshots(id);

-- ── 9. RLS policies on user_profiles ─────────────────────────────────────────
-- Existing policy (from 001): none on user_profiles — enable RLS and add policies
alter table user_profiles enable row level security;

-- Users can read their own profile
create policy "user reads own profile"
  on user_profiles for select
  using (user_id = auth.uid());

-- Coaches (role = 'coach') can update their own profile
create policy "user owns profile"
  on user_profiles for all
  using (user_id = auth.uid());

-- Coach slug/display_name are public (needed for public coach pages)
create policy "public reads coach slug"
  on user_profiles for select
  using (role = 'coach');
