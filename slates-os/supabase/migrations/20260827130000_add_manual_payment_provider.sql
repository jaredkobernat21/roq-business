-- =============================================================================
-- Manual payments, part 1 of 2: the provider value and the columns.
--
-- Until now the only way a payment could be recorded was the Stripe webhook,
-- which meant an invoice could reach 'sent' and then never reach 'paid' unless
-- the business had Stripe connected. Cash, checks, and bank transfers are how
-- most of this work actually gets paid for, so they need a first-class path.
--
-- The RPC that uses the new 'manual' value lives in the next migration:
-- Postgres will not let a newly added enum value be *used* in the same
-- transaction that adds it, and each migration file runs as one transaction.
-- =============================================================================

alter type public.payment_provider add value if not exists 'manual';

-- Details that only make sense for a payment a human recorded. All nullable:
-- Stripe rows leave them empty and keep their meaning from the provider.
alter table public.payments
  add column method text
    check (method is null or method in ('cash', 'check', 'bank_transfer', 'other')),
  add column reference text,
  add column recorded_by uuid references auth.users(id) on delete set null,
  -- When the money actually changed hands, which is not always when someone
  -- got around to entering it. created_at stays the audit timestamp.
  add column paid_at timestamptz not null default now();

comment on column public.payments.method is
  'How a manual payment was taken (cash/check/bank_transfer/other). Null for '
  'processor payments, where the provider column already says.';
comment on column public.payments.reference is
  'Free text the business uses to find this payment again — check number, '
  'bank confirmation, "left with front desk".';
comment on column public.payments.paid_at is
  'When the payment was received. May predate created_at when someone records '
  'a check that arrived last week.';
