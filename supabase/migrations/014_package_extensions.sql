-- Extend coaching_packages with currency choices, seat limits, deadlines, and discounts

alter table coaching_packages
  add column if not exists currencies        text[]       not null default ARRAY['USD'::text],
  add column if not exists total_seats       integer,
  add column if not exists show_seats_filled boolean      not null default false,
  add column if not exists apply_deadline    timestamptz,
  add column if not exists discount_price    numeric(10,2),
  add column if not exists discount_until    timestamptz;
