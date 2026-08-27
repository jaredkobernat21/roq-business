-- Covers: the core cross-tenant boundary, swept across the five tables a
-- leak would matter most for — organizations, organization_members,
-- customers, jobs, invoices. Every assertion is the same shape: a member of
-- org A reaches for a specific, known row that belongs to org B, by id, and
-- gets nothing — zero rows selected, zero rows updated/deleted — never an
-- error that would leak whether the row exists (docs/RLS.md is explicit
-- that this is a requirement, not an implementation detail: "never
-- organization B's data, and never an error that leaks whether the row
-- exists").
--
-- A data-modifying CTE must be the top-level statement in Postgres — it
-- can't be nested inside a subquery passed as an argument to is() — so
-- every update/delete assertion below is `WITH ... SELECT is(...)`, not
-- `SELECT is((WITH ...))`.

BEGIN;
SELECT plan(12);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'owner-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'owner-b@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '');

insert into public.organizations (id, name, slug, timezone) values
  ('0a000000-0000-0000-0000-000000000301', 'Org A (cross-tenant test)', 'org-a-rls-test-040', 'America/New_York'),
  ('0b000000-0000-0000-0000-000000000301', 'Org B (cross-tenant test)', 'org-b-rls-test-040', 'America/New_York');

insert into public.organization_members (id, organization_id, user_id, role, status) values
  ('30000000-0000-0000-0000-000000000301', '0a000000-0000-0000-0000-000000000301', 'a0000000-0000-0000-0000-000000000301', 'owner', 'active'),
  ('30000000-0000-0000-0000-000000000302', '0b000000-0000-0000-0000-000000000301', 'b0000000-0000-0000-0000-000000000301', 'owner', 'active');

-- Org B's own data — what org A must never be able to reach.
insert into public.customers (id, organization_id, first_name) values
  ('40000000-0000-0000-0000-000000000301', '0b000000-0000-0000-0000-000000000301', 'Bea');

insert into public.jobs (id, organization_id, customer_id, title) values
  ('40000000-0000-0000-0000-000000000302', '0b000000-0000-0000-0000-000000000301', '40000000-0000-0000-0000-000000000301', 'Org B job');

insert into public.invoices (id, organization_id, customer_id) values
  ('40000000-0000-0000-0000-000000000303', '0b000000-0000-0000-0000-000000000301', '40000000-0000-0000-0000-000000000301');

-- Impersonate org A's owner — highest privilege there, and still nothing in
-- org B.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000301'::text, 'email', 'owner-a@rls-test.local', 'role', 'authenticated')::text, true);

-- ---------- organizations ----------
SELECT is(
  (SELECT count(*) FROM public.organizations WHERE id = '0b000000-0000-0000-0000-000000000301'),
  0::bigint,
  'cannot select org B''s organization row'
);
WITH updated AS (
  UPDATE public.organizations SET name = 'hacked' WHERE id = '0b000000-0000-0000-0000-000000000301' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'cannot update org B''s organization row (no error, zero rows)'
);

-- ---------- organization_members ----------
SELECT is(
  (SELECT count(*) FROM public.organization_members WHERE organization_id = '0b000000-0000-0000-0000-000000000301'),
  0::bigint,
  'cannot select org B''s membership rows'
);
WITH updated AS (
  UPDATE public.organization_members SET role = 'admin'
  WHERE organization_id = '0b000000-0000-0000-0000-000000000301' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'cannot update org B''s membership rows (no error, zero rows)'
);

-- ---------- customers ----------
SELECT is(
  (SELECT count(*) FROM public.customers WHERE id = '40000000-0000-0000-0000-000000000301'),
  0::bigint,
  'cannot select org B''s customer'
);
WITH updated AS (
  UPDATE public.customers SET first_name = 'hacked' WHERE id = '40000000-0000-0000-0000-000000000301' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'cannot update org B''s customer (no error, zero rows)'
);
WITH deleted AS (
  DELETE FROM public.customers WHERE id = '40000000-0000-0000-0000-000000000301' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  'cannot delete org B''s customer (no error, zero rows)'
);

-- ---------- jobs ----------
SELECT is(
  (SELECT count(*) FROM public.jobs WHERE id = '40000000-0000-0000-0000-000000000302'),
  0::bigint,
  'cannot select org B''s job'
);
WITH updated AS (
  UPDATE public.jobs SET title = 'hacked' WHERE id = '40000000-0000-0000-0000-000000000302' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'cannot update org B''s job (no error, zero rows)'
);
WITH deleted AS (
  DELETE FROM public.jobs WHERE id = '40000000-0000-0000-0000-000000000302' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM deleted),
  0::bigint,
  'cannot delete org B''s job (no error, zero rows)'
);

-- ---------- invoices ----------
SELECT is(
  (SELECT count(*) FROM public.invoices WHERE id = '40000000-0000-0000-0000-000000000303'),
  0::bigint,
  'cannot select org B''s invoice'
);
WITH updated AS (
  UPDATE public.invoices SET notes = 'hacked' WHERE id = '40000000-0000-0000-0000-000000000303' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'cannot update org B''s invoice (no error, zero rows)'
);

SELECT * FROM finish();
ROLLBACK;
