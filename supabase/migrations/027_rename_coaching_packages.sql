-- Rename coaching_packages table to packages.
ALTER TABLE coaching_packages RENAME TO packages;

-- Update the primary key constraint name
ALTER TABLE packages RENAME CONSTRAINT coaching_packages_pkey TO packages_pkey;

-- Rename the coach FK constraint added in migration 024
ALTER TABLE packages
  RENAME CONSTRAINT coaching_packages_coach_id_fkey TO packages_coach_id_fkey;
