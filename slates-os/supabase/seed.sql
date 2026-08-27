-- =============================================================================
-- ROQ OS — local development seed data
-- =============================================================================
-- Runs automatically after `supabase db reset` against your LOCAL Supabase
-- instance only. Never run this against a hosted/production project — it
-- inserts a password-based auth user directly into auth.users, which is a
-- local-dev convenience, not something you'd do in production (real users
-- sign up through the app's /signup flow instead).
--
-- Creates one demo organization ("Duct Wrangler") with one owner so you can
-- log in and see a populated Team screen without going through onboarding.
-- This is seed/demo data only — nothing in the reusable app code references
-- "Duct Wrangler" by name. Any business can use the same codebase.
--
-- Demo login: owner@ductwrangler.test / password123
-- =============================================================================

do $$
declare
  demo_user_id uuid := '11111111-1111-1111-1111-111111111111';
  demo_org_id uuid;
begin
  -- Demo owner account (local dev only).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    demo_user_id,
    'authenticated',
    'authenticated',
    'owner@ductwrangler.test',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"first_name":"Alexander","last_name":"Wrangler"}',
    now(),
    now(),
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    demo_user_id::text,
    demo_user_id,
    jsonb_build_object('sub', demo_user_id::text, 'email', 'owner@ductwrangler.test'),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do nothing;

  -- handle_new_user() already created a profiles row via the auth.users
  -- insert trigger; nothing else to do there.

  -- Demo organization + owner membership.
  insert into public.organizations (name, slug, phone, email, timezone)
  values ('Duct Wrangler', 'duct-wrangler', '555-0100', 'hello@ductwrangler.test', 'America/New_York')
  on conflict (slug) do nothing
  returning id into demo_org_id;

  if demo_org_id is null then
    select id into demo_org_id from public.organizations where slug = 'duct-wrangler';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (demo_org_id, demo_user_id, 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;
end $$;
