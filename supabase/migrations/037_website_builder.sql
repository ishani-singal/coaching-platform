-- Add website draft and published config columns to user_profiles.
-- website_draft  = work in progress (only visible in the builder)
-- website_published = what visitors see on /coaches/[slug]

alter table user_profiles
  add column if not exists website_draft     jsonb default null,
  add column if not exists website_published jsonb default null;
