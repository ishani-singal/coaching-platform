-- Split theme_config: add website_nav_bar column, move navItems into it,
-- and move youtubeChannelUrl from theme_config into social_media.

-- ── 1. Add website_nav_bar column ─────────────────────────────────────────────
alter table user_profiles
  add column if not exists website_nav_bar jsonb not null default '[]'::jsonb;

-- ── 2. Migrate navItems from theme_config -> website_nav_bar ──────────────────
update user_profiles
  set website_nav_bar = theme_config -> 'navItems'
  where theme_config ? 'navItems'
    and jsonb_typeof(theme_config -> 'navItems') = 'array';

-- ── 3. Migrate youtubeChannelUrl from theme_config -> social_media ────────────
update user_profiles
  set social_media = social_media || jsonb_build_object('youtubeChannelUrl', theme_config ->> 'youtubeChannelUrl')
  where theme_config ? 'youtubeChannelUrl';

-- ── 4. Strip migrated keys out of theme_config ────────────────────────────────
update user_profiles
  set theme_config = theme_config - 'navItems' - 'youtubeChannelUrl'
  where theme_config ? 'navItems' or theme_config ? 'youtubeChannelUrl';
