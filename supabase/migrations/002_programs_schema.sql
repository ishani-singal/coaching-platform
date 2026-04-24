create table modules (
  module_id              uuid primary key default gen_random_uuid(),
  creator_coach_id       uuid not null references coach_profiles,
  title                  text not null,
  category               text,
  version                integer not null default 1,
  derived_from_module_id uuid references modules(module_id),
  is_published           boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- visible_to determines which interface renders this section:
--   'client'   → end client portal
--   'trainee'  → trainee view (client content + coaching methodology layer)
--   'delivery' → coach facilitation guide (never shown to client or trainee)
create table module_sections (
  section_id    uuid primary key default gen_random_uuid(),
  module_id     uuid not null references modules on delete cascade,
  section_order integer not null,
  visible_to    text[] not null,
  content_type  text not null check (content_type in
    ('text','video','pdf','task','check_in','quiz','facilitation_guide')),
  body          jsonb not null default '{}'::jsonb
);

create table programs (
  program_id       uuid primary key default gen_random_uuid(),
  creator_coach_id uuid not null references coach_profiles,
  title            text not null,
  description      text,
  version          integer not null default 1,
  is_published     boolean not null default false,
  created_at       timestamptz not null default now()
);

create table program_modules (
  program_id    uuid not null references programs on delete cascade,
  module_id     uuid not null references modules,
  display_order integer not null,
  primary key (program_id, module_id)
);

create table coaching_packages (
  package_id          uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references coach_profiles,
  persona_snapshot_id uuid references persona_snapshots(id),
  title               text not null,
  description         text,
  cover_image_url     text,
  pricing_model       text check (pricing_model in ('free','one_time','subscription')),
  price_usd           numeric(10,2),
  is_published        boolean not null default false,
  created_at          timestamptz not null default now()
);

create table package_programs (
  package_id    uuid not null references coaching_packages on delete cascade,
  program_id    uuid not null references programs,
  display_order integer not null,
  primary key (package_id, program_id)
);

create table enrollments (
  enrollment_id       uuid primary key default gen_random_uuid(),
  package_id          uuid not null references coaching_packages,
  installing_coach_id uuid not null references coach_profiles,
  client_id           uuid not null references client_profiles,
  enrollment_type     text not null check (enrollment_type in ('client','trainee')),
  invite_token        uuid unique not null default gen_random_uuid(),
  started_at          timestamptz,
  completed_at        timestamptz,
  current_module_id   uuid references modules(module_id),
  created_at          timestamptz not null default now()
);

create table enrollment_responses (
  response_id   uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments on delete cascade,
  section_id    uuid not null references module_sections,
  response_data jsonb,
  submitted_at  timestamptz not null default now()
);

alter table modules              enable row level security;
alter table module_sections      enable row level security;
alter table programs             enable row level security;
alter table coaching_packages    enable row level security;
alter table enrollments          enable row level security;
alter table enrollment_responses enable row level security;

create policy "coach owns modules"    on modules           for all    using (creator_coach_id = auth.uid());
create policy "public reads modules"  on modules           for select using (is_published = true);
create policy "coach owns sections"   on module_sections   for all    using (
  module_id in (select module_id from modules where creator_coach_id = auth.uid())
);
create policy "public reads sections" on module_sections   for select using (
  module_id in (select module_id from modules where is_published = true)
);
create policy "coach owns programs"    on programs          for all    using (creator_coach_id = auth.uid());
create policy "coach owns packages"    on coaching_packages for all    using (coach_id = auth.uid());
create policy "public reads packages"  on coaching_packages for select using (is_published = true);
create policy "coach owns enrollments" on enrollments       for all    using (installing_coach_id = auth.uid());
create policy "coach owns responses"   on enrollment_responses for all using (
  enrollment_id in (select enrollment_id from enrollments where installing_coach_id = auth.uid())
);

create or replace function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

create trigger modules_updated_at
  before update on modules
  for each row execute function set_updated_at();
