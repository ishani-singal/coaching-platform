-- Replace single skillz_program_id with multi-valued included_program_ids.
-- Add no_sublicense flag to modules for forked "free included" content.

-- 1. Replace skillz_program_id with included_program_ids on packages
ALTER TABLE packages
  DROP COLUMN IF EXISTS skillz_program_id;

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS included_program_ids uuid[] NOT NULL DEFAULT '{}';

-- 2. Add no_sublicense flag to modules
--    When true the module cannot be forked or licensed to another coach.
ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS no_sublicense boolean NOT NULL DEFAULT false;
