-- Covers: the jobs_update policy —
--   using (is_org_scheduler_or_above(organization_id) or (assigned_to = auth.uid() and is_org_member(organization_id)))
--   with check (same)
-- — the one place app-layer permission logic (canEditJob() in
-- src/lib/permissions.ts) and DB-layer enforcement need to agree: a
-- technician may update only the job assigned to them; staff (scheduler and
-- above) may update any job in their organization regardless of assignment.
--
-- A data-modifying CTE must be the top-level statement in Postgres — it
-- can't be nested inside a subquery passed as an argument to is() — so
-- every assertion below is `WITH ... SELECT is(...)`, not
-- `SELECT is((WITH ...))`.

BEGIN;
SELECT plan(5);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000401', 'authenticated', 'authenticated', 'owner-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000402', 'authenticated', 'authenticated', 'scheduler-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000403', 'authenticated', 'authenticated', 'tech1-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000404', 'authenticated', 'authenticated', 'tech2-a@rls-test.local', crypt('password123', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '');

insert into public.organizations (id, name, slug, timezone) values
  ('0a000000-0000-0000-0000-000000000401', 'Org A (jobs boundary test)', 'org-a-rls-test-050', 'America/New_York');

insert into public.organization_members (organization_id, user_id, role, status) values
  ('0a000000-0000-0000-0000-000000000401', 'a0000000-0000-0000-0000-000000000401', 'owner', 'active'),
  ('0a000000-0000-0000-0000-000000000401', 'a0000000-0000-0000-0000-000000000402', 'scheduler', 'active'),
  ('0a000000-0000-0000-0000-000000000401', 'a0000000-0000-0000-0000-000000000403', 'technician', 'active'),
  ('0a000000-0000-0000-0000-000000000401', 'a0000000-0000-0000-0000-000000000404', 'technician', 'active');

insert into public.customers (id, organization_id, first_name) values
  ('40000000-0000-0000-0000-000000000401', '0a000000-0000-0000-0000-000000000401', 'Cam');

insert into public.jobs (id, organization_id, customer_id, title, assigned_to) values
  ('40000000-0000-0000-0000-000000000402', '0a000000-0000-0000-0000-000000000401', '40000000-0000-0000-0000-000000000401', 'Assigned to tech 1', 'a0000000-0000-0000-0000-000000000403'),
  ('40000000-0000-0000-0000-000000000403', '0a000000-0000-0000-0000-000000000401', '40000000-0000-0000-0000-000000000401', 'Assigned to tech 2', 'a0000000-0000-0000-0000-000000000404'),
  ('40000000-0000-0000-0000-000000000404', '0a000000-0000-0000-0000-000000000401', '40000000-0000-0000-0000-000000000401', 'Unassigned job', NULL);

set local role authenticated;

-- Technician 1: can update the job assigned to them.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000403'::text, 'email', 'tech1-a@rls-test.local', 'role', 'authenticated')::text, true);
WITH updated AS (
  UPDATE public.jobs SET status = 'in_progress' WHERE id = '40000000-0000-0000-0000-000000000402' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'a technician can update the job assigned to them'
);

-- Technician 1: cannot update a job assigned to technician 2.
WITH updated AS (
  UPDATE public.jobs SET status = 'in_progress' WHERE id = '40000000-0000-0000-0000-000000000403' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'a technician cannot update a job assigned to someone else (no error, zero rows)'
);

-- Technician 1: cannot update an unassigned job.
WITH updated AS (
  UPDATE public.jobs SET status = 'in_progress' WHERE id = '40000000-0000-0000-0000-000000000404' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  0::bigint,
  'a technician cannot update an unassigned job (no error, zero rows)'
);

-- Scheduler: can update a job assigned to someone else — staff aren't
-- bound by the assignment check at all.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000402'::text, 'email', 'scheduler-a@rls-test.local', 'role', 'authenticated')::text, true);
WITH updated AS (
  UPDATE public.jobs SET status = 'in_progress' WHERE id = '40000000-0000-0000-0000-000000000403' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'a scheduler can update a job assigned to someone else'
);

-- Owner: can update an unassigned job too.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000401'::text, 'email', 'owner-a@rls-test.local', 'role', 'authenticated')::text, true);
WITH updated AS (
  UPDATE public.jobs SET status = 'in_progress' WHERE id = '40000000-0000-0000-0000-000000000404' RETURNING 1
)
SELECT is(
  (SELECT count(*) FROM updated),
  1::bigint,
  'an owner can update an unassigned job'
);

SELECT * FROM finish();
ROLLBACK;
