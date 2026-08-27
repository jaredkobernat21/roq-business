-- Covers: is_org_member_any_status, is_org_member, is_org_admin,
-- is_org_scheduler_or_above, get_org_role, shares_org_with — the
-- security-definer helper functions every RLS policy in this schema is
-- built on (see docs/RLS.md's "recursion problem" section for why they
-- exist at all: a naive policy on organization_members that queries
-- organization_members from within its own USING clause recurses).
--
-- Fixtures: one org (org A) with an owner, admin, scheduler, technician,
-- an invited-but-not-yet-active member, and a disabled member — enough
-- role/status combinations to exercise every helper function's boundary.
-- Plus a second org (org B, owner only) and a total outsider, for the
-- negative cases.

BEGIN;
SELECT plan(28);

-- ---------------------------------------------------------------------------
-- Fixtures (as the privileged test-runner role — see docs/RLS.md: these
-- tables have no INSERT grant for `authenticated` by design, so seeding
-- them directly as the table owner is the intended path for tooling).
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'scheduler-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'technician-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'invited-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'disabled-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-b@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'outsider@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '');

insert into public.organizations (id, name, slug, timezone) values
  ('0a000000-0000-0000-0000-000000000001', 'Org A (RLS test)', 'org-a-rls-test-010', 'America/New_York'),
  ('0b000000-0000-0000-0000-000000000001', 'Org B (RLS test)', 'org-b-rls-test-010', 'America/New_York');

insert into public.organization_members (organization_id, user_id, role, status) values
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin', 'active'),
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'scheduler', 'active'),
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'technician', 'active'),
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'technician', 'invited'),
  ('0a000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000006', 'technician', 'disabled'),
  ('0b000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner', 'active');

-- Impersonate the org A owner for every assertion below — auth.uid() drives
-- every helper function, so who "we" are stays fixed and each assertion
-- passes a different *target* to check that function's boundary.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000001'::text, 'email', 'owner-a@rls-test.local', 'role', 'authenticated')::text, true);

-- ---------------------------------------------------------------------------
-- is_org_member_any_status: true regardless of status, for org A; false for
-- org B (owner-a isn't a member there at all).
-- ---------------------------------------------------------------------------
SELECT ok(public.is_org_member_any_status('0a000000-0000-0000-0000-000000000001'), 'is_org_member_any_status true for the active owner');
SELECT ok(NOT public.is_org_member_any_status('0b000000-0000-0000-0000-000000000001'), 'is_org_member_any_status false for a non-member org');

-- ---------------------------------------------------------------------------
-- is_org_member / is_org_admin / is_org_scheduler_or_above / get_org_role,
-- checked once per fixture role by re-impersonating each user in turn.
-- ---------------------------------------------------------------------------

-- owner
SELECT ok(public.is_org_member('0a000000-0000-0000-0000-000000000001'), 'is_org_member true for active owner');
SELECT ok(public.is_org_admin('0a000000-0000-0000-0000-000000000001'), 'is_org_admin true for active owner');
SELECT ok(public.is_org_scheduler_or_above('0a000000-0000-0000-0000-000000000001'), 'is_org_scheduler_or_above true for active owner');
SELECT is(public.get_org_role('0a000000-0000-0000-0000-000000000001')::text, 'owner', 'get_org_role returns owner');

-- admin
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000002'::text, 'email', 'admin-a@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(public.is_org_member('0a000000-0000-0000-0000-000000000001'), 'is_org_member true for active admin');
SELECT ok(public.is_org_admin('0a000000-0000-0000-0000-000000000001'), 'is_org_admin true for active admin');
SELECT ok(public.is_org_scheduler_or_above('0a000000-0000-0000-0000-000000000001'), 'is_org_scheduler_or_above true for active admin');
SELECT is(public.get_org_role('0a000000-0000-0000-0000-000000000001')::text, 'admin', 'get_org_role returns admin');

-- scheduler
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000003'::text, 'email', 'scheduler-a@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(public.is_org_member('0a000000-0000-0000-0000-000000000001'), 'is_org_member true for active scheduler');
SELECT ok(NOT public.is_org_admin('0a000000-0000-0000-0000-000000000001'), 'is_org_admin false for active scheduler');
SELECT ok(public.is_org_scheduler_or_above('0a000000-0000-0000-0000-000000000001'), 'is_org_scheduler_or_above true for active scheduler');
SELECT is(public.get_org_role('0a000000-0000-0000-0000-000000000001')::text, 'scheduler', 'get_org_role returns scheduler');

-- technician (active)
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000004'::text, 'email', 'technician-a@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(public.is_org_member('0a000000-0000-0000-0000-000000000001'), 'is_org_member true for active technician');
SELECT ok(NOT public.is_org_admin('0a000000-0000-0000-0000-000000000001'), 'is_org_admin false for active technician');
SELECT ok(NOT public.is_org_scheduler_or_above('0a000000-0000-0000-0000-000000000001'), 'is_org_scheduler_or_above false for active technician');
SELECT is(public.get_org_role('0a000000-0000-0000-0000-000000000001')::text, 'technician', 'get_org_role returns technician');

-- invited (not yet active) — counts for is_org_member_any_status, not for
-- is_org_member/is_org_admin/get_org_role.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000005'::text, 'email', 'invited-a@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(public.is_org_member_any_status('0a000000-0000-0000-0000-000000000001'), 'is_org_member_any_status true while invited');
SELECT ok(NOT public.is_org_member('0a000000-0000-0000-0000-000000000001'), 'is_org_member false while invited (not active)');
SELECT is(public.get_org_role('0a000000-0000-0000-0000-000000000001'), NULL, 'get_org_role null while invited');

-- disabled — same shape as invited: any-status sees it, active-only checks don't.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000006'::text, 'email', 'disabled-a@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(public.is_org_member_any_status('0a000000-0000-0000-0000-000000000001'), 'is_org_member_any_status true while disabled');
SELECT ok(NOT public.is_org_member('0a000000-0000-0000-0000-000000000001'), 'is_org_member false while disabled');

-- a total outsider, member of nothing
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-000000000001'::text, 'email', 'outsider@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(NOT public.is_org_member_any_status('0a000000-0000-0000-0000-000000000001'), 'is_org_member_any_status false for a total outsider');
SELECT ok(NOT public.is_org_admin('0a000000-0000-0000-0000-000000000001'), 'is_org_admin false for a total outsider');

-- ---------------------------------------------------------------------------
-- shares_org_with: true for two members of the same org, false across orgs.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000001'::text, 'email', 'owner-a@rls-test.local', 'role', 'authenticated')::text, true);
SELECT ok(public.shares_org_with('a0000000-0000-0000-0000-000000000002'), 'shares_org_with true for two active members of the same org');
SELECT ok(NOT public.shares_org_with('b0000000-0000-0000-0000-000000000001'), 'shares_org_with false across unrelated orgs');

-- ---------------------------------------------------------------------------
-- Recursion safety, made explicit: a member can select from
-- organization_members under RLS without an error. If the naive recursive
-- policy this schema deliberately avoids were in play, this would error or
-- hang instead of returning a plan.
-- ---------------------------------------------------------------------------
SELECT lives_ok(
  $$ SELECT count(*) FROM public.organization_members WHERE organization_id = '0a000000-0000-0000-0000-000000000001' $$,
  'selecting organization_members as a member does not recurse'
);

SELECT * FROM finish();
ROLLBACK;
