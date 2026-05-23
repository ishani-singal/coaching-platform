-- Add embedded periods array to programs
ALTER TABLE programs ADD COLUMN periods jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing program_periods rows into the JSONB column
UPDATE programs p
SET periods = COALESCE((
  SELECT jsonb_agg(
    jsonb_build_object(
      'period_id',    pp.period_id,
      'period_order', pp.period_order,
      'label',        pp.label,
      'period_type',  pp.period_type
    )
    ORDER BY pp.period_order
  )
  FROM program_periods pp
  WHERE pp.program_id = p.program_id
), '[]'::jsonb);

-- Drop the FK constraint from program_modules.period_id before dropping the table
ALTER TABLE program_modules DROP CONSTRAINT IF EXISTS program_modules_period_id_fkey;

-- Drop program_periods (CASCADE removes its index and RLS policy).
-- program_modules.period_id column stays as a plain UUID reference into the JSONB array.
DROP TABLE IF EXISTS program_periods CASCADE;
