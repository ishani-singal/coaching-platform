-- Link payment records to enrollments so we can efficiently gate portal access

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES enrollments(enrollment_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_records_enrollment_id
  ON payment_records(enrollment_id);
