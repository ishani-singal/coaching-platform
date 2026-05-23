-- Add certificate download URL and optional Skillz program fork to coaching_packages

alter table coaching_packages
  add column if not exists certificate_url  text,
  add column if not exists skillz_program_id uuid references programs(program_id) on delete set null;
