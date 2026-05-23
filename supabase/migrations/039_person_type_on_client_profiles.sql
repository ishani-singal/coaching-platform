alter table client_profiles
  add column if not exists person_type text
    check (person_type in ('client', 'trainee'))
    default 'client';
