-- Extend appointment_types with optional recurrence configuration
-- recurrence: null = one-off, or { enabled: true, frequency: 'weekly'|'biweekly'|'monthly', occurrences: N, interval_weeks: N }

alter table appointment_types
  add column if not exists recurrence jsonb not null default 'null'::jsonb;

comment on column appointment_types.recurrence is
  'null = one-off session. Example recurring config: {"enabled":true,"frequency":"weekly","occurrences":4,"interval_weeks":1}';

-- Link recurring appointments into a group so they can be managed together
alter table appointments
  add column if not exists recurrence_group_id uuid,
  add column if not exists recurrence_index    integer check (recurrence_index >= 1);

comment on column appointments.recurrence_group_id is
  'UUID shared by all appointments in the same recurring booking. null for one-off appointments.';

comment on column appointments.recurrence_index is
  '1-based position of this appointment within its recurrence group (1 = first session).';

create index if not exists appointments_recurrence_group
  on appointments (recurrence_group_id)
  where recurrence_group_id is not null;
