-- Merge enrollment_responses into enrollments as a JSONB array column.
-- Each enrollment row now carries its own responses; the separate table is dropped.

-- 1. Add responses column (array of {section_id, response_data, submitted_at})
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS responses jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Migrate existing rows
UPDATE enrollments e
SET responses = sub.arr
FROM (
  SELECT
    enrollment_id,
    jsonb_agg(
      jsonb_build_object(
        'section_id',    section_id,
        'response_data', response_data,
        'submitted_at',  submitted_at
      )
      ORDER BY submitted_at
    ) AS arr
  FROM enrollment_responses
  GROUP BY enrollment_id
) sub
WHERE e.enrollment_id = sub.enrollment_id;

-- 3. RPC helper for atomic append (used by the application layer)
CREATE OR REPLACE FUNCTION append_enrollment_response(
  p_enrollment_id uuid,
  p_section_id    uuid,
  p_response_data jsonb
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE enrollments
  SET responses = responses || jsonb_build_array(
    jsonb_build_object(
      'section_id',    p_section_id,
      'response_data', p_response_data,
      'submitted_at',  now()
    )
  )
  WHERE enrollment_id = p_enrollment_id;
$$;

-- 4. Drop the now-redundant table (policies are automatically dropped with the table)
DROP TABLE enrollment_responses;
