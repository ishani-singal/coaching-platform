-- Payment records: stores provider-assigned IDs only (no card data — PCI compliant).
-- Stripe (USD/cards/Google Pay/ACH) and Razorpay (INR/UPI/netbanking) are both supported.

create table if not exists payment_records (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references auth.users(id) on delete cascade,
  provider             text        not null check (provider in ('stripe', 'razorpay')),
  external_id          text        not null unique,   -- Stripe pi_... or Razorpay order_...
  currency             text        not null,          -- ISO 4217 uppercase
  amount_smallest_unit integer     not null check (amount_smallest_unit > 0),  -- cents or paise
  description          text        not null,
  status               text        not null default 'pending'
                                   check (status in ('pending', 'succeeded', 'failed', 'refunded', 'requires_action')),
  metadata             jsonb       not null default '{}',
  created_at           timestamptz not null default now()
);

alter table payment_records enable row level security;

create policy "users_own_records"
  on payment_records
  for all
  using (auth.uid() = user_id);

create index payment_records_user_created
  on payment_records (user_id, created_at desc);
