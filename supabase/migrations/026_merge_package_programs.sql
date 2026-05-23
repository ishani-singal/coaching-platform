-- Add programs JSONB column to coaching_packages.
-- Stores ordered program references: [{ "program_id": "uuid", "display_order": 0 }, ...]
ALTER TABLE coaching_packages
  ADD COLUMN programs JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing join-table data into the new column
UPDATE coaching_packages cp
SET programs = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('program_id', pp.program_id, 'display_order', pp.display_order)
      ORDER BY pp.display_order
    ),
    '[]'::jsonb
  )
  FROM package_programs pp
  WHERE pp.package_id = cp.package_id
);

-- Remove the now-redundant join table
DROP TABLE package_programs;
