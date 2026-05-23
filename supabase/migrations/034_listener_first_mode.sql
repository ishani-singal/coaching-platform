-- Add listener_first_mode column to user_profiles for per-coach opt-in listener-first chat behavior
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS listener_first_mode boolean NOT NULL DEFAULT false;
