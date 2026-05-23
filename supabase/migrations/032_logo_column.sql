-- Add logo column to user_profiles for coach branding
alter table user_profiles
  add column if not exists logo text;
