-- Native appointment booking system
-- Replaces Cal.com iframe with a self-hosted Calendly-like flow
-- Coaches define appointment types, weekly availability, and connect Google Calendar

-- ── 1. Appointment types ──────────────────────────────────────────────────────
-- Each coach can create multiple session offerings (e.g. "Discovery Call", "60-min Coaching")

create table if not exists appointment_types (
  appointment_type_id uuid        primary key default gen_random_uuid(),
  coach_id            uuid        not null references auth.users(id) on delete cascade,
  title               text        not null,
  description         text,
  duration_mins       integer     not null default 60 check (duration_mins > 0),
  buffer_mins         integer     not null default 15 check (buffer_mins >= 0),
  price_usd           numeric(10,2) not null default 0 check (price_usd >= 0),
  currency            text        not null default 'USD',
  -- cancellation_policy: { hours_notice: number, refund_pct: number (0-100) }
  cancellation_policy jsonb       not null default '{"hours_notice": 24, "refund_pct": 100}'::jsonb,
  -- advance notice in hours a client must give when booking (minimum)
  min_notice_hours    integer     not null default 1 check (min_notice_hours >= 0),
  -- how many days out clients can book
  max_days_out        integer     not null default 60 check (max_days_out > 0),
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table appointment_types enable row level security;

create policy "coach_owns_appointment_types"
  on appointment_types
  for all
  using (auth.uid() = coach_id);

-- Service-role bypass for API routes
create policy "service_role_appointment_types"
  on appointment_types
  for all
  to service_role
  using (true);

-- ── 2. Coach weekly availability ─────────────────────────────────────────────
-- day_of_week: 0=Sunday, 1=Monday, ..., 6=Saturday
-- Multiple rows per day allowed (e.g. split shifts)

create table if not exists coach_availability (
  availability_id uuid        primary key default gen_random_uuid(),
  coach_id        uuid        not null references auth.users(id) on delete cascade,
  day_of_week     smallint    not null check (day_of_week between 0 and 6),
  start_time      time        not null,
  end_time        time        not null,
  timezone        text        not null default 'America/New_York',
  created_at      timestamptz not null default now(),
  constraint valid_time_range check (end_time > start_time)
);

alter table coach_availability enable row level security;

create policy "coach_owns_availability"
  on coach_availability
  for all
  using (auth.uid() = coach_id);

create policy "service_role_availability"
  on coach_availability
  for all
  to service_role
  using (true);

create index coach_availability_coach_day
  on coach_availability (coach_id, day_of_week);

-- ── 3. Google Calendar connections ───────────────────────────────────────────
-- Stores OAuth tokens so the platform can check coach busy times

create table if not exists coach_calendar_connections (
  connection_id         uuid        primary key default gen_random_uuid(),
  coach_id              uuid        not null unique references auth.users(id) on delete cascade,
  google_account_email  text        not null,
  access_token          text        not null,
  refresh_token         text        not null,
  token_expiry          timestamptz not null,
  -- IDs of calendars selected to block availability
  selected_calendar_ids text[]      not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table coach_calendar_connections enable row level security;

create policy "coach_owns_calendar_connection"
  on coach_calendar_connections
  for all
  using (auth.uid() = coach_id);

create policy "service_role_calendar_connections"
  on coach_calendar_connections
  for all
  to service_role
  using (true);

-- ── 4. Appointments ───────────────────────────────────────────────────────────
-- Individual booking records with a payment-gated status FSM:
--   pending_payment → confirmed → completed
--                   → cancelled
--   pending_payment → expired (if payment not received within 15 min)

create table if not exists appointments (
  appointment_id        uuid        primary key default gen_random_uuid(),
  appointment_type_id   uuid        not null references appointment_types(appointment_type_id) on delete restrict,
  coach_id              uuid        not null references auth.users(id) on delete cascade,
  client_name           text        not null,
  client_email          text        not null,
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  timezone              text        not null default 'UTC',
  status                text        not null default 'pending_payment'
                          check (status in ('pending_payment', 'confirmed', 'completed', 'cancelled', 'expired')),
  -- Payment tracking
  price_usd             numeric(10,2) not null default 0,
  currency              text        not null default 'USD',
  payment_external_id   text,                          -- Stripe checkout session ID or PaymentIntent ID
  payment_provider      text check (payment_provider in ('stripe', 'razorpay', null)),
  -- Cancellation
  cancelled_at          timestamptz,
  cancellation_reason   text,
  cancelled_by          text check (cancelled_by in ('coach', 'client', null)),
  refund_issued         boolean     not null default false,
  refund_amount_usd     numeric(10,2),
  -- Timestamps
  payment_expires_at    timestamptz,                   -- 15-min hold window for pending_payment
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint valid_appointment_range check (ends_at > starts_at)
);

alter table appointments enable row level security;

-- Coaches see all appointments for their account
create policy "coach_sees_own_appointments"
  on appointments
  for all
  using (auth.uid() = coach_id);

-- Clients (unauthenticated) can look up their own booking by appointment_id+email via service role
create policy "service_role_appointments"
  on appointments
  for all
  to service_role
  using (true);

create index appointments_coach_starts
  on appointments (coach_id, starts_at);

create index appointments_type_status
  on appointments (appointment_type_id, status);

create index appointments_payment_external
  on appointments (payment_external_id)
  where payment_external_id is not null;
