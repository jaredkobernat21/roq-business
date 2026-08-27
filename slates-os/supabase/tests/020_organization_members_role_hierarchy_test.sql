-- Covers: the organization_members_update policy's owner-protection logic
-- (docs/RLS.md, "Role hierarchy in organization_members UPDATE"):
--   using (is_org_admin(organization_id) and (role <> 'owner' or get_org_role(organization_id) = 'owner'))
--   with check (same)
--
-- Two distinct Postgres RLS behaviors are exercised deliberately, not
-- interchangeably: a row excluded by USING is silently skipped (0 rows
-- affected, no error — same "never leak existence" property SELECT gets);
-- a row that matches USING but whose NEW values fail WITH CHECK raises a
-- real error (SQLSTATE 42501), because the row's existence was already
-- visible to the caller by passing USING — only the attempted new state is
-- being rejected.
--
-- Fixture: org A with two owners (so a forbidden admin->owner update can't
-- be accidentally "protected" by the protect_last_owner trigger instead of
-- by this policy — a failure here needs to unambiguously come from RLS),
-- one admin, one scheduler, one technician.

BEGIN;
SELECT plan(6);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'owner-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'second-owner-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'admin-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'scheduler-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000105', 'authenticated', 'authenticated', 'technician-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '');

insert into public.organizations (id, name, slug, timezone) values
  ('0a000000-0000-0000-0000-000000000101', 'Org A (role hierarchy test)', 'org-a-rls-test-020', 'America/New_York');

insert into public.organization_members (id, organization_id, user_id, role, status) values
  ('30000000-0000-0000-0000-000000000101', '0a000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000101', 'owner', 'active'),
  ('30000000-0000-0000-0000-000000000102', '0a000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000102', 'owner', 'active'),
  ('30000000-0000-0000-0000-000000000103', '0a000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000103', 'admin', 'active'),
  ('30000000-0000-0000-0000-000000000104', '0a000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000104', 'scheduler', 'active'),
  ('30000000-0000-0000-0000-000000000105', '0a000000-0000-0000-0000-000000000101', 'a0000000-0000-0000-0000-000000000105', 'technician', 'active');

set local role authenticated;

-- As owner: can update a non-owner member's role.
-- (A data-modifying CTE must be the top-level statement in Postgres — it
-- can't be nested inside a subquery passed as an argument to is() — so
-- each of these is `WITH ... SELECT is(...)`, not `SELECT is((WITH ...))`.)
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000101'::text, 'email', 'owner-a@rls-test.local', 'role', 'authenticated')::text, true);
WITH updated AS (
  UPDATE public.organization_members SET role = 'technician'
  WHERE id = '30000000-0000-0000-0000-000000000104' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'owner can update a non-owner member''s role'
);

-- As admin: can update a non-owner member's role.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000103'::text, 'email', 'admin-a@rls-test.local', 'role', 'authenticated')::text, true);
WITH updated AS (
  UPDATE public.organization_members SET role = 'scheduler'
  WHERE id = '30000000-0000-0000-0000-000000000105' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'admin can update a non-owner member''s role'
);

-- As admin: cannot touch a row that is currently 'owner' — silently
-- excluded by USING, zero rows, no error.
WITH updated AS (
  UPDATE public.organization_members SET role = 'admin'
  WHERE id = '30000000-0000-0000-0000-000000000101' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'admin cannot update the owner row (silently excluded, not an error)'
);

-- As admin: cannot promote anyone to 'owner' — the row matches USING (it's
-- not currently an owner row) but the new state fails WITH CHECK, which
-- raises rather than silently skipping.
-- pgTAP's 3-arg throws_ok(sql, errcode, X) treats X as the expected error
-- MESSAGE, not a free-text description (confirmed against CI's first real
-- run) — same 4-arg shape file 030's throws_ok calls already use
-- successfully: (sql, errcode, errmsg, description).
SELECT throws_ok(
  $$ UPDATE public.organization_members SET role = 'owner' WHERE id = '30000000-0000-0000-0000-000000000105' $$,
  '42501',
  'new row violates row-level security policy for table "organization_members"',
  'admin cannot promote a member to owner (RLS policy violation)'
);

-- As owner: can update another owner's row.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000101'::text, 'email', 'owner-a@rls-test.local', 'role', 'authenticated')::text, true);
WITH updated AS (
  UPDATE public.organization_members SET role = 'admin'
  WHERE id = '30000000-0000-0000-0000-000000000102' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'owner can update another owner''s row'
);

-- As owner: can grant the owner role.
WITH updated AS (
  UPDATE public.organization_members SET role = 'owner'
  WHERE id = '30000000-0000-0000-0000-000000000103' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'owner can grant the owner role to another member'
);

SELECT * FROM finish();
ROLLBACK;
