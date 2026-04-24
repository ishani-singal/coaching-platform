create table module_licenses (
  license_id           uuid primary key default gen_random_uuid(),
  module_id            uuid not null references modules,
  licensor_coach_id    uuid not null references coach_profiles,
  licensee_coach_id    uuid not null references coach_profiles,
  direct_cut_pct       numeric(5,2) not null check (direct_cut_pct between 0 and 100),
  derivative_cut_pct   numeric(5,2) not null check (derivative_cut_pct between 0 and 100),
  propagate_to_depth   integer,
  can_sublicense       boolean not null default false,
  licensed_at          timestamptz not null default now(),
  expires_at           timestamptz,
  unique (module_id, licensee_coach_id)
);

create table program_licenses (
  license_id           uuid primary key default gen_random_uuid(),
  program_id           uuid not null references programs,
  licensor_coach_id    uuid not null references coach_profiles,
  licensee_coach_id    uuid not null references coach_profiles,
  direct_cut_pct       numeric(5,2) not null check (direct_cut_pct between 0 and 100),
  derivative_cut_pct   numeric(5,2) not null check (derivative_cut_pct between 0 and 100),
  propagate_to_depth   integer,
  can_sublicense       boolean not null default false,
  licensed_at          timestamptz not null default now(),
  expires_at           timestamptz,
  unique (program_id, licensee_coach_id)
);

-- Pre-computed at fork time; one row per ancestor filtered by propagate_to_depth during fork
create table module_ancestry (
  module_id           uuid not null references modules,
  ancestor_module_id  uuid not null references modules,
  ancestor_coach_id   uuid not null references coach_profiles,
  depth               integer not null check (depth >= 1),
  applicable_cut_pct  numeric(5,2) not null,
  primary key (module_id, ancestor_module_id)
);

-- Written at enrollment payment time; licensor sees only their own rows
create table revenue_events (
  event_id        uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references enrollments,
  coach_id        uuid not null references coach_profiles,
  role            text not null check (role in ('delivering_coach','licensor','platform')),
  amount_usd      numeric(10,2) not null,
  ancestor_depth  integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table module_licenses  enable row level security;
alter table program_licenses enable row level security;
alter table module_ancestry  enable row level security;
alter table revenue_events   enable row level security;

create policy "licensor or licensee sees module license"
  on module_licenses for select
  using (licensor_coach_id = auth.uid() or licensee_coach_id = auth.uid());

create policy "licensor or licensee sees program license"
  on program_licenses for select
  using (licensor_coach_id = auth.uid() or licensee_coach_id = auth.uid());

create policy "coach sees ancestry"
  on module_ancestry for select
  using (
    ancestor_coach_id = auth.uid() or
    module_id in (select module_id from modules where creator_coach_id = auth.uid())
  );

create policy "coach sees own revenue"
  on revenue_events for select
  using (coach_id = auth.uid());
