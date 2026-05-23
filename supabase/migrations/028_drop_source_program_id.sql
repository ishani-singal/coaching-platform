-- Drop the source_program_id column from modules (no longer used).
ALTER TABLE modules DROP COLUMN IF EXISTS source_program_id;
