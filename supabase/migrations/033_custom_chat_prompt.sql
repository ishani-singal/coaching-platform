-- Add custom_chat_prompt column to user_profiles for coach-defined chat instructions
alter table user_profiles
  add column if not exists custom_chat_prompt text;

-- Add email column to user_profiles so coaches can be looked up by email
alter table user_profiles
  add column if not exists email text;

-- Populate email from auth.users for existing rows
update user_profiles up
set    email = au.email
from   auth.users au
where  au.id = up.user_id
  and  up.email is null;

-- Unique partial index for fast email lookups
create unique index if not exists user_profiles_email_idx
  on user_profiles (email)
  where email is not null;

-- Keep email in sync whenever auth.users.email changes
create or replace function sync_user_profile_email()
returns trigger language plpgsql security definer as $$
begin
  update user_profiles set email = new.email where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_user_profile_email on auth.users;
create trigger trg_sync_user_profile_email
  after insert or update of email on auth.users
  for each row execute procedure sync_user_profile_email();

-- Add licensing invitation flow columns to program_licenses
alter table program_licenses
  add column if not exists license_fee_amount  numeric(10,2),
  add column if not exists license_fee_currency text not null default 'USD',
  add column if not exists status              text not null default 'pending',
  add column if not exists invite_token        uuid not null default gen_random_uuid();

alter table program_licenses alter column can_sublicense set default false;
update program_licenses set can_sublicense = false;

create unique index if not exists program_licenses_invite_token_idx
  on program_licenses (invite_token);

-- Track forked/licensed programs
alter table programs
  add column if not exists source_program_id uuid references programs(program_id);
