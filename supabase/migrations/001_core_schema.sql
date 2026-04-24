create table user_profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  role       text not null default 'client' check (role in ('client','trainee','coach')),
  created_at timestamptz not null default now()
);

create table coach_profiles (
  coach_id            uuid primary key references user_profiles(user_id),
  slug                text unique not null,
  display_name        text not null,
  bio                 text,
  custom_domain       text unique,
  persona_snapshot_id uuid,
  theme_config        jsonb default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index coach_profiles_slug_idx          on coach_profiles (slug);
create index coach_profiles_custom_domain_idx on coach_profiles (custom_domain);

-- persona_sources feeds the LLM persona builder (tone/style extraction)
-- NOT what clients see — that's coach_library_items in 004
create table persona_sources (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references coach_profiles on delete cascade,
  source_type text not null check (source_type in ('youtube','text','file','linkedin','instagram')),
  content     text,
  url         text,
  created_at  timestamptz not null default now()
);

create table persona_snapshots (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references coach_profiles on delete cascade,
  version      integer not null default 1,
  tone         text,
  style        text,
  summary      text,
  raw_snapshot jsonb,
  created_at   timestamptz not null default now(),
  unique (coach_id, version)
);

alter table coach_profiles add constraint fk_persona
  foreign key (persona_snapshot_id) references persona_snapshots(id);

create table client_profiles (
  client_id     uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references coach_profiles on delete cascade,
  enrollment_id uuid,
  invite_token  uuid unique default gen_random_uuid(),
  name          text not null,
  email         text not null,
  phone         text,
  goals         text,
  background    text,
  preferences   jsonb default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index client_profiles_coach_id_idx     on client_profiles (coach_id);
create index client_profiles_invite_token_idx on client_profiles (invite_token);

alter table coach_profiles    enable row level security;
alter table persona_sources   enable row level security;
alter table persona_snapshots enable row level security;
alter table client_profiles   enable row level security;

create policy "coach owns profile"   on coach_profiles    for all    using (coach_id = auth.uid());
create policy "public reads coach"   on coach_profiles    for select using (true);
create policy "coach owns sources"   on persona_sources   for all    using (coach_id = auth.uid());
create policy "coach owns snapshots" on persona_snapshots for all    using (coach_id = auth.uid());
create policy "coach owns clients"   on client_profiles   for all    using (coach_id = auth.uid());
