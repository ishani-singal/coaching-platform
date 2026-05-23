-- RAG infrastructure, client auth accounts, transcription, and recommendation settings.

-- ── coach_profiles: coaching type ─────────────────────────────────────────────
alter table coach_profiles
  add column if not exists coaching_type text;

-- ── coach_library_items: buy link + embedding tracking ────────────────────────
alter table coach_library_items
  add column if not exists buy_link    text,          -- for books: external purchase URL
  add column if not exists embedded_at timestamptz;   -- null = pending Pinecone upsert

-- ── video_transcripts: full transcript storage ────────────────────────────────
-- Stores transcripts for youtube and uploaded audio/video library items.
-- transcript text lives here (not in Pinecone) for fast DB reads.
-- Pinecone holds the chunked embedding vectors; chunks_indexed tracks sync state.
create table if not exists video_transcripts (
  transcript_id    uuid        primary key default gen_random_uuid(),
  library_item_id  uuid        not null references coach_library_items(item_id) on delete cascade,
  coach_id         uuid        not null references coach_profiles(coach_id) on delete cascade,
  source           text        not null check (source in ('youtube_captions', 'whisper')),
  language         text        not null default 'en',
  transcript       text        not null,
  chunks_indexed   boolean     not null default false,
  created_at       timestamptz not null default now()
);

create unique index if not exists video_transcripts_item_idx
  on video_transcripts (library_item_id);

create index if not exists video_transcripts_coach_idx
  on video_transcripts (coach_id);

create index if not exists video_transcripts_pending_idx
  on video_transcripts (coach_id) where chunks_indexed = false;

alter table video_transcripts enable row level security;

create policy "coach owns transcripts"
  on video_transcripts for all
  using (coach_id = auth.uid());

create policy "public reads transcripts"
  on video_transcripts for select
  using (true);

-- ── coach_recommendation_settings: tweakable RAG scoring params ───────────────
create table if not exists coach_recommendation_settings (
  coach_id         uuid        primary key references coach_profiles(coach_id) on delete cascade,
  tag_weight       numeric     not null default 2.0   check (tag_weight >= 0),
  semantic_weight  numeric     not null default 1.0   check (semantic_weight >= 0),
  recency_boost    numeric     not null default 0.0   check (recency_boost >= 0),
  preferred_types  text[]      not null default '{}',
  max_results      integer     not null default 5     check (max_results between 1 and 20),
  updated_at       timestamptz not null default now()
);

alter table coach_recommendation_settings enable row level security;

create policy "coach owns recommendation settings"
  on coach_recommendation_settings for all
  using (coach_id = auth.uid());

-- ── client_profiles: link to Supabase auth ────────────────────────────────────
-- Allows a client to create a real auth account and have persistent chat history.
-- user_id is nullable so existing invite-token-only clients are unaffected.
-- One client_profile per (auth user, coach) pair.
alter table client_profiles
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists client_profiles_user_coach_idx
  on client_profiles (user_id, coach_id)
  where user_id is not null;

create index if not exists client_profiles_user_idx
  on client_profiles (user_id)
  where user_id is not null;

-- Allow a client to read their own profile once authenticated
create policy "client reads own profile"
  on client_profiles for select
  using (user_id = auth.uid());
