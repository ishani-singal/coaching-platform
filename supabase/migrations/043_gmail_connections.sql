-- Stores per-coach Gmail OAuth2 tokens for sending emails via their own Gmail account
create table if not exists coach_gmail_connections (
  coach_id             uuid primary key references auth.users on delete cascade,
  google_account_email text        not null,
  access_token         text        not null,
  refresh_token        text        not null,
  token_expiry         timestamptz not null,
  updated_at           timestamptz not null default now()
);

alter table coach_gmail_connections enable row level security;

drop policy if exists "coach can view own gmail connection" on coach_gmail_connections;
create policy "coach can view own gmail connection"
  on coach_gmail_connections for select
  using (auth.uid() = coach_id);

drop policy if exists "coach can delete own gmail connection" on coach_gmail_connections;
create policy "coach can delete own gmail connection"
  on coach_gmail_connections for delete
  using (auth.uid() = coach_id);
