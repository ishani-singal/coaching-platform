-- Coaches' published content library (what clients see on the website)
-- Separate from persona_sources (which feeds the LLM persona builder)
create table coach_library_items (
  item_id       uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references coach_profiles on delete cascade,
  item_type     text not null check (item_type in ('youtube','book','article','pdf','podcast')),
  title         text not null,
  url           text,
  description   text,
  tags          text[] not null default '{}',
  thumbnail_url text,
  metadata      jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

create table coach_client_notes (
  note_id    uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references coach_profiles,
  client_id  uuid not null references client_profiles,
  note       text not null,
  created_at timestamptz not null default now()
);

create table coach_client_tags (
  coach_id  uuid not null references coach_profiles,
  client_id uuid not null references client_profiles,
  tag       text not null,
  primary key (coach_id, client_id, tag)
);

-- booking_ref = opaque ID from customer-booking agent (Cal.com ID inside that agent)
-- payment_ref = opaque ID from payment agent (Stripe ID inside that agent)
-- This table never stores raw Cal.com or Stripe credentials
create table coaching_sessions (
  session_id       uuid primary key default gen_random_uuid(),
  coach_id         uuid not null references coach_profiles,
  client_id        uuid not null references client_profiles,
  enrollment_id    uuid references enrollments,
  booking_ref      text,
  payment_ref      text,
  scheduled_at     timestamptz not null,
  duration_minutes integer not null default 60,
  status           text not null default 'scheduled'
                     check (status in ('scheduled','completed','cancelled','no_show')),
  session_notes    text,
  created_at       timestamptz not null default now()
);

alter table coach_library_items enable row level security;
alter table coach_client_notes  enable row level security;
alter table coach_client_tags   enable row level security;
alter table coaching_sessions   enable row level security;

create policy "coach owns library"   on coach_library_items for all    using (coach_id = auth.uid());
create policy "public reads library" on coach_library_items for select using (true);
create policy "coach owns notes"     on coach_client_notes  for all    using (coach_id = auth.uid());
create policy "coach owns tags"      on coach_client_tags   for all    using (coach_id = auth.uid());
create policy "coach owns sessions"  on coaching_sessions   for all    using (coach_id = auth.uid());
