-- Remove persona_snapshot_id from coaching_packages.
-- Persona is tied to the coach profile, not individual packages.
alter table coaching_packages drop column if exists persona_snapshot_id;
