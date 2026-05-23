-- ─────────────────────────────────────────────────────────────────────────────
-- 023: Prospect Chat Sessions, Coach Chat Settings, Coach Platform Subscriptions
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Coach chat settings ────────────────────────────────────────────────────
create table if not exists coach_chat_settings (
  coach_id               uuid primary key references user_profiles(user_id) on delete cascade,
  free_message_limit     int          not null default 10,
  free_cost_limit_cents  int          not null default 50,
  paid_chat_price_usd    numeric(10,2),
  stripe_price_id        text,
  upsell_message         text,
  updated_at             timestamptz  not null default now()
);

alter table coach_chat_settings enable row level security;

create policy "coach_chat_settings_self" on coach_chat_settings
  for all using (auth.uid() = coach_id);

-- ── Prospect chat sessions ─────────────────────────────────────────────────
-- messages stored as encrypted blob — decryption happens in API layer only.
create table if not exists prospect_chat_sessions (
  session_id          uuid         primary key default gen_random_uuid(),
  coach_id            uuid         not null references user_profiles(user_id) on delete cascade,
  prospect_user_id    uuid         references auth.users(id) on delete set null,
  anonymous_token     text         unique,                 -- httpOnly cookie value (server-generated UUID)
  messages_encrypted  text         not null default '',    -- AES-256-GCM ciphertext
  message_count       int          not null default 0,
  estimated_cost_cents int         not null default 0,
  is_paid             boolean      not null default false,
  payment_record_id   uuid         references payment_records(id) on delete set null,
  chat_rag_enabled    boolean      not null default false,  -- user opted into RAG indexing
  consent_given_at    timestamptz,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

create index if not exists idx_prospect_chat_sessions_coach        on prospect_chat_sessions(coach_id);
create index if not exists idx_prospect_chat_sessions_prospect     on prospect_chat_sessions(prospect_user_id);
create index if not exists idx_prospect_chat_sessions_anon         on prospect_chat_sessions(anonymous_token);

alter table prospect_chat_sessions enable row level security;

-- Authenticated prospects can read/update their own sessions
create policy "prospect_chat_sessions_own" on prospect_chat_sessions
  for all using (auth.uid() = prospect_user_id);

-- Coaches can read all sessions for their coach_id (for CRM insight)
create policy "prospect_chat_sessions_coach_read" on prospect_chat_sessions
  for select using (auth.uid() = coach_id);

-- ── Coach platform subscriptions (Skillz plan) ────────────────────────────
create table if not exists coach_platform_subscriptions (
  id                      uuid         primary key default gen_random_uuid(),
  coach_id                uuid         not null unique references user_profiles(user_id) on delete cascade,
  stripe_subscription_id  text         unique,
  stripe_customer_id      text,
  plan_tier               text         not null default 'starter' check (plan_tier in ('starter','pro','enterprise')),
  status                  text         not null default 'trialing' check (status in ('active','past_due','cancelled','trialing')),
  paid_chat_enabled       boolean      not null default false,
  platform_cut_percent    numeric(5,2) not null default 20.00,
  current_period_end      timestamptz,
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now()
);

alter table coach_platform_subscriptions enable row level security;

create policy "coach_platform_subscriptions_self" on coach_platform_subscriptions
  for select using (auth.uid() = coach_id);

-- ── updated_at triggers ────────────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_coach_chat_settings_updated_at
  before update on coach_chat_settings
  for each row execute function update_updated_at_column();

create trigger trg_prospect_chat_sessions_updated_at
  before update on prospect_chat_sessions
  for each row execute function update_updated_at_column();

create trigger trg_coach_platform_subscriptions_updated_at
  before update on coach_platform_subscriptions
  for each row execute function update_updated_at_column();
