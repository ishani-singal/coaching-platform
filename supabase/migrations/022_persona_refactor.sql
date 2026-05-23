-- Remove persona_sources table; persona is now derived from coach_library_items + coach_profiles.
-- Add social_media JSONB to coach_profiles for LinkedIn/Instagram connections.

-- 1. Add social media column
alter table coach_profiles
  add column if not exists social_media jsonb not null default '{}'::jsonb;

-- 2. Drop RLS policies on persona_sources before dropping the table
drop policy if exists "coach owns sources" on persona_sources;

-- 3. Drop persona_sources (no FK references to it; it referenced coach_profiles)
drop table if exists persona_sources;
