-- Covers: record_manual_payment — the RPC that lets a business record a
-- payment taken outside a processor (cash, check, bank transfer).
--
-- This one earns a test more than most. It is `security definer`, so it runs
-- with the definer's rights and RLS does not constrain it: the role check
-- written into the function body IS the security boundary. If that check ever
-- regresses, any authenticated user in any Space could mark any invoice in any
-- other Space as paid, and nothing else in the schema would stop them.
--
-- Fixtures: org A with an owner, a scheduler, and a technician; org B with its
-- own owner. Org A has a sent invoice, a draft invoice, and a void invoice, so
-- the status guards can be exercised too.

BEGIN;
SELECT plan(9);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated', 'owner-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated', 'scheduler-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000603', 'authenticated', 'authenticated', 'tech-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated', 'owner-b@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '');

insert into public.organizations (id, name, slug, timezone) values
  ('0a000000-0000-0000-0000-000000000601', 'Org A (RLS test)', 'org-a-rls-test-060', 'America/New_York'),
  ('0b000000-0000-0000-0000-000000000601', 'Org B (RLS test)', 'org-b-rls-test-060', 'America/New_York');

insert into public.organization_members (organization_id, user_id, role, status) values
  ('0a000000-0000-0000-0000-000000000601', 'a0000000-0000-0000-0000-000000000601', 'owner', 'active'),
  ('0a000000-0000-0000-0000-000000000601', 'a0000000-0000-0000-0000-000000000602', 'scheduler', 'active'),
  ('0a000000-0000-0000-0000-000000000601', 'a0000000-0000-0000-0000-000000000603', 'technician', 'active'),
  ('0b000000-0000-0000-0000-000000000601', 'b0000000-0000-0000-0000-000000000601', 'owner', 'active');

insert into public.customers (id, organization_id, first_name) values
  ('60000000-0000-0000-0000-000000000601', '0a000000-0000-0000-0000-000000000601', 'Payer');

insert into public.invoices (id, organization_id, customer_id, status, subtotal_cents, total_cents) values
  ('61000000-0000-0000-0000-000000000601', '0a000000-0000-0000-0000-000000000601', '60000000-0000-0000-0000-000000000601', 'sent', 10000, 10000),
  ('61000000-0000-0000-0000-000000000602', '0a000000-0000-0000-0000-000000000601', '60000000-0000-0000-0000-000000000601', 'draft', 5000, 5000),
  ('61000000-0000-0000-0000-000000000603', '0a000000-0000-0000-0000-000000000601', '60000000-0000-0000-0000-000000000601', 'void', 5000, 5000),
  ('61000000-0000-0000-0000-000000000604', '0a000000-0000-0000-0000-000000000601', '60000000-0000-0000-0000-000000000601', 'sent', 20000, 20000);

-- ---------------------------------------------------------------------------
-- The cross-tenant case, which is the one that matters most: org B's owner is
-- an owner, just not of this Space.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-0000-0000-000000000601'::text, 'email', 'owner-b@rls-test.local', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$select public.record_manual_payment('61000000-0000-0000-0000-000000000601'::uuid, 5000, 'cash')$$,
  'Not authorized to record payments for this invoice',
  'an owner of another organization cannot record a payment'
);

-- ---------------------------------------------------------------------------
-- A technician is inside the right Space but below the invoice tier.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000603'::text, 'email', 'tech-a@rls-test.local', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$select public.record_manual_payment('61000000-0000-0000-0000-000000000601'::uuid, 5000, 'cash')$$,
  'Not authorized to record payments for this invoice',
  'a technician in the same organization cannot record a payment'
);

-- ---------------------------------------------------------------------------
-- A scheduler can — same tier that creates and sends invoices. A partial
-- payment leaves the invoice partially_paid.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000602'::text, 'email', 'scheduler-a@rls-test.local', 'role', 'authenticated')::text, true);

SELECT lives_ok(
  $$select public.record_manual_payment('61000000-0000-0000-0000-000000000601'::uuid, 4000, 'check', 'Check #1042')$$,
  'a scheduler can record a payment'
);

SELECT is(
  (select status::text from public.invoices where id = '61000000-0000-0000-0000-000000000601'),
  'partially_paid',
  'a payment below the total leaves the invoice partially paid'
);

SELECT is(
  (select amount_paid_cents from public.invoices where id = '61000000-0000-0000-0000-000000000601'),
  4000,
  'the invoice balance reflects the payment'
);

-- Paying the rest settles it.
SELECT lives_ok(
  $$select public.record_manual_payment('61000000-0000-0000-0000-000000000601'::uuid, 6000, 'cash')$$,
  'a second payment can be recorded against the same invoice'
);

SELECT is(
  (select status::text from public.invoices where id = '61000000-0000-0000-0000-000000000601'),
  'paid',
  'payments totalling the invoice mark it paid'
);

-- ---------------------------------------------------------------------------
-- Status guards. A draft has not been sent to anyone, and a void invoice is
-- not collectable — neither should accept money.
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$select public.record_manual_payment('61000000-0000-0000-0000-000000000602'::uuid, 1000, 'cash')$$,
  'Send the invoice before recording a payment against it',
  'a draft invoice rejects payments'
);

SELECT throws_ok(
  $$select public.record_manual_payment('61000000-0000-0000-0000-000000000603'::uuid, 1000, 'cash')$$,
  'Cannot record a payment against a void invoice',
  'a void invoice rejects payments'
);

SELECT * FROM finish();
ROLLBACK;
