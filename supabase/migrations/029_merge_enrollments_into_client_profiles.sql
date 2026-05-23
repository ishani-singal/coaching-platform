-- Merge enrollments into client_profiles.
-- Each client has at most one enrollment, so enrollment state moves inline.
-- revenue_events and payment_records gain a client_id FK to client_profiles.
-- coaching_sessions.enrollment_id is dropped (client_id is already present).

-- 1. Add enrollment columns to client_profiles
ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS package_id        uuid REFERENCES packages(package_id),
  ADD COLUMN IF NOT EXISTS enrollment_type   text CHECK (enrollment_type IN ('client','trainee')),
  ADD COLUMN IF NOT EXISTS started_at        timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS current_module_id uuid REFERENCES modules(module_id),
  ADD COLUMN IF NOT EXISTS responses         jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Migrate enrollment data into client_profiles (1:1 — most recent enrollment wins)
UPDATE client_profiles cp
SET
  enrollment_id     = e.enrollment_id,
  package_id        = e.package_id,
  enrollment_type   = e.enrollment_type,
  started_at        = e.started_at,
  completed_at      = e.completed_at,
  current_module_id = e.current_module_id,
  responses         = e.responses
FROM (
  SELECT DISTINCT ON (client_id) *
  FROM enrollments
  ORDER BY client_id, created_at DESC
) e
WHERE e.client_id = cp.client_id;

-- 3. Update revenue_events: remap enrollment_id → client_id via enrollments, then add FK
ALTER TABLE revenue_events
  DROP CONSTRAINT revenue_events_enrollment_id_fkey;
ALTER TABLE revenue_events
  RENAME COLUMN enrollment_id TO client_id;

-- Remap stored enrollment UUIDs to the corresponding client_id
UPDATE revenue_events re
SET client_id = e.client_id
FROM enrollments e
WHERE re.client_id = e.enrollment_id;

-- Null out any orphaned rows (enrollment was deleted before this migration)
UPDATE revenue_events
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT client_id FROM client_profiles);

ALTER TABLE revenue_events
  ADD CONSTRAINT revenue_events_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES client_profiles(client_id) ON DELETE CASCADE;

-- 4. Update payment_records: remap enrollment_id → client_id via enrollments, then add FK
ALTER TABLE payment_records
  DROP CONSTRAINT IF EXISTS payment_records_enrollment_id_fkey;
ALTER TABLE payment_records
  RENAME COLUMN enrollment_id TO client_id;

-- Remap stored enrollment UUIDs to the corresponding client_id
UPDATE payment_records pr
SET client_id = e.client_id
FROM enrollments e
WHERE pr.client_id = e.enrollment_id;

-- Null out any orphaned rows
UPDATE payment_records
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT client_id FROM client_profiles);

ALTER TABLE payment_records
  ADD CONSTRAINT payment_records_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES client_profiles(client_id) ON DELETE SET NULL;

-- 5. Drop enrollment_id from coaching_sessions (client_id is already there)
ALTER TABLE coaching_sessions DROP COLUMN IF EXISTS enrollment_id;

-- 6. Replace append_enrollment_response RPC to target client_profiles
DROP FUNCTION IF EXISTS append_enrollment_response(uuid, uuid, jsonb);
CREATE FUNCTION append_enrollment_response(
  p_client_id     uuid,
  p_section_id    uuid,
  p_response_data jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE client_profiles
  SET responses = responses || jsonb_build_array(
    jsonb_build_object(
      'section_id',    p_section_id,
      'response_data', p_response_data,
      'submitted_at',  now()
    )
  )
  WHERE client_id = p_client_id;
$$;

-- 7. Drop the now-redundant enrollments table (RLS policies and indexes drop automatically)
DROP TABLE enrollments;
