-- 1. Track which program a module was originally created within (inline creation)
--    NULL = standalone; non-NULL = created inline inside that program.
--    Does not restrict reuse — purely informational.
alter table modules
  add column source_program_id uuid references programs(program_id);

-- 2. Timeline periods — sits between programs and their modules
create table program_periods (
  period_id    uuid primary key default gen_random_uuid(),
  program_id   uuid not null references programs on delete cascade,
  period_order integer not null,
  label        text not null,
  period_type  text not null default 'custom'
               check (period_type in ('week','day','month','quarter','custom')),
  created_at   timestamptz not null default now()
);

create index program_periods_idx on program_periods (program_id, period_order);

-- 3. Optional period assignment on existing program_modules join table.
--    NULL period_id = flat/unperiodized (backward compatible, no data migration needed).
alter table program_modules
  add column period_id uuid references program_periods(period_id) on delete set null;

-- 4. Per-module client data — coach's private notes/observations per client per module.
--    HIGH PRIVACY: only the writing coach can read or mutate these rows.
--    The module's original creator has zero access at DB level.
create table coach_module_client_data (
  record_id  uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references coach_profiles on delete cascade,
  module_id  uuid not null references modules on delete cascade,
  client_id  uuid not null references client_profiles on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, module_id, client_id)
);

create index cmcd_coach_module_idx on coach_module_client_data (coach_id, module_id);
create index cmcd_coach_client_idx on coach_module_client_data (coach_id, client_id);

create trigger coach_module_client_data_updated_at
  before update on coach_module_client_data
  for each row execute function set_updated_at();

alter table program_periods           enable row level security;
alter table coach_module_client_data  enable row level security;

-- program_periods: coach controls periods only on their own programs
create policy "coach owns periods" on program_periods for all
  using (program_id in (
    select program_id from programs where creator_coach_id = auth.uid()
  ));

-- coach_module_client_data: four explicit policies so INSERT can carry its own with check
-- SELECT: only the coach who wrote the record
create policy "coach reads own client data" on coach_module_client_data for select
  using (coach_id = auth.uid());

-- INSERT: coach_id must be the caller AND the client must belong to that same coach
create policy "coach inserts own client data" on coach_module_client_data for insert
  with check (
    coach_id = auth.uid()
    and client_id in (
      select client_id from client_profiles where coach_id = auth.uid()
    )
  );

create policy "coach updates own client data" on coach_module_client_data for update
  using (coach_id = auth.uid());

create policy "coach deletes own client data" on coach_module_client_data for delete
  using (coach_id = auth.uid());
