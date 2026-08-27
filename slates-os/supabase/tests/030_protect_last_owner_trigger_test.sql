-- Covers: protect_last_owner() (docs/RLS.md, "The last-owner invariant") —
-- a before update-or-delete trigger on organization_members that raises
-- SQLSTATE P0001 if the write would leave an organization with zero active
-- owners, regardless of which code path performs the write.
--
-- The DELETE-path assertions run as the privileged test-runner role,
-- deliberately: organization_members has no DELETE grant for `authenticated`
-- at all (Phase 1 only supports disabling a member, never deleting the
-- row — see docs/RLS.md), so a DELETE attempt as `authenticated` would fail
-- on the grant before RLS or this trigger ever got involved. The trigger
-- itself fires for *any* writer, including a privileged one, so exercising
-- it directly here tests the trigger's own logic rather than re-testing
-- grants. The UPDATE-path assertions run as `authenticated`, since
-- demoting/disabling yourself via UPDATE is the actual path the app uses.

BEGIN;
SELECT plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'owner-c@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'second-owner-c@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000203', 'authenticated', 'authenticated', 'owner-d@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000204', 'authenticated', 'authenticated', 'second-owner-d@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '');

insert into public.organizations (id, name, slug, timezone) values
  ('0c000000-0000-0000-0000-000000000201', 'Org C (last-owner test)', 'org-c-rls-test-030', 'America/New_York'),
  ('0d000000-0000-0000-0000-000000000201', 'Org D (last-owner test)', 'org-d-rls-test-030', 'America/New_York');

insert into public.organization_members (id, organization_id, user_id, role, status) values
  ('30000000-0000-0000-0000-000000000201', '0c000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000201', 'owner', 'active'),
  ('30000000-0000-0000-0000-000000000203', '0d000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000203', 'owner', 'active');

-- ---------------------------------------------------------------------------
-- DELETE path, as the privileged role: deleting the sole owner is blocked;
-- deleting one of two owners succeeds.
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$ DELETE FROM public.organization_members WHERE id = '30000000-0000-0000-0000-000000000203' $$,
  'P0001',
  'An organization must always have at least one active owner',
  'deleting the sole active owner is blocked'
);

insert into public.organization_members (id, organization_id, user_id, role, status) values
  ('30000000-0000-0000-0000-000000000204', '0d000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000204', 'owner', 'active');

SELECT is(
  (WITH deleted AS (
     DELETE FROM public.organization_members WHERE id = '30000000-0000-0000-0000-000000000203' RETURNING 1
   ) SELECT count(*) FROM deleted),
  1::bigint,
  'deleting one of two active owners succeeds'
);

-- ---------------------------------------------------------------------------
-- UPDATE path, as the sole owner themselves (the realistic app path: a
-- signed-in owner demoting or disabling their own membership).
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000201'::text, 'email', 'owner-c@rls-test.local', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$ UPDATE public.organization_members SET role = 'admin' WHERE id = '30000000-0000-0000-0000-000000000201' $$,
  'P0001',
  'An organization must always have at least one active owner',
  'the sole active owner cannot demote themselves'
);

SELECT throws_ok(
  $$ UPDATE public.organization_members SET status = 'disabled' WHERE id = '30000000-0000-0000-0000-000000000201' $$,
  'P0001',
  'An organization must always have at least one active owner',
  'the sole active owner cannot disable themselves'
);

-- Back to privileged to add a second owner to org C, then retry as owner_c.
reset role;
insert into public.organization_members (id, organization_id, user_id, role, status) values
  ('30000000-0000-0000-0000-000000000202', '0c000000-0000-0000-0000-000000000201', 'a0000000-0000-0000-0000-000000000202', 'owner', 'active');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000201'::text, 'email', 'owner-c@rls-test.local', 'role', 'authenticated')::text, true);

SELECT is(
  (WITH updated AS (
     UPDATE public.organization_members SET role = 'admin'
     WHERE id = '30000000-0000-0000-0000-000000000201' RETURNING 1
   ) SELECT count(*) FROM updated),
  1::bigint,
  'an owner can demote themselves once a second active owner exists'
);

SELECT * FROM finish();
ROLLBACK;
