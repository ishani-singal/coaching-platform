-- Per-client pricing overrides on client_profiles.
-- custom_price_usd: coach-assigned price for this specific client (overrides package default).
-- discount_amount_usd: flat discount applied on top of custom or default price.
-- Both are nullable — NULL means "use package default / no discount".

ALTER TABLE client_profiles
  ADD COLUMN IF NOT EXISTS custom_price_usd    numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount_usd numeric(10,2);
