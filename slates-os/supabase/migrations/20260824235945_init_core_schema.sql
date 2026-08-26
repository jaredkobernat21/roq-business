-- =============================================================================
-- SLATES OS — Phase 1 core schema
-- =============================================================================
-- This migration establishes the multi-tenant foundation: organizations,
-- profiles, organization membership, and pending invitations, plus the
-- Row Level Security (RLS) policies and helper functions that keep every
-- organization's data isolated from every other organization.
--
-- SECURITY MODEL — read this before adding new tables
-- -----------------------------------------------------------------------------
-- 1. Every business-data table that belongs to a tenant MUST carry an
--    `organization_id uuid not null references public.organizations(id)`
--    column and MUST enable RLS with policies built on the helper functions
--    defined below (`is_org_member`, `is_org_admin`, `get_org_role`, ...).
--    Never rely on the client to filter by organization_id — always gate
--    access with an RLS policy, because Postgres enforces RLS regardless of
--    what the API client sends.
-- 2. Helper functions below are declared `security definer` so they can read
--    `organization_members` without recursively triggering that table's own
--    RLS policies (a naive policy like
--    "USING (exists (select 1 from organization_members ...))" on the
--    `organization_members` table itself will infinite-loop). Each helper
--    only ever answers a yes/no or role question scoped to `auth.uid()` —
--    it never accepts a caller-supplied user id — so it cannot be used to
--    probe another user's membership.
-- 3. Cross-tenant mutations that must happen atomically (e.g. "create an
--    organization AND make the creator its owner") are implemented as
--    `security definer` RPC functions with explicit checks inside, instead
--    of opening up permissive INSERT policies. This keeps "can this row be
--    created at all" logic in one auditable place.
-- 4. A `before update or delete` trigger on `organization_members` enforces
--    the "an organization must always keep at least one active owner"
--    invariant at the database level, so it holds no matter which code path
--    (RPC, direct table update, future admin tooling) performs the write.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.organization_role as enum ('owner', 'admin', 'scheduler', 'technician');
create type public.member_status as enum ('active', 'invited', 'disabled');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- Table: organizations
-- =============================================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  phone text,
  email text,
  website text,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is
  'A tenant on the SLATES OS platform. Every business-data table added in a '
  'future phase (customers, jobs, invoices, ...) must reference this table '
  'via an organization_id column governed by RLS.';

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Table: profiles
-- =============================================================================
-- One row per auth.users row. Created automatically by the
-- handle_new_user() trigger below — the app never inserts into this table
-- directly, only updates it.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile data for a Supabase auth user, 1:1 with auth.users. '
  'Populated automatically on signup by handle_new_user().';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Table: organization_members
-- =============================================================================
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'technician',
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Join table between users and organizations. Membership rows are only '
  'ever created by the create_organization() and accept_invitation() '
  'security definer functions, never by direct client inserts.';

create index organization_members_organization_id_idx on public.organization_members (organization_id);
create index organization_members_user_id_idx on public.organization_members (user_id);

-- =============================================================================
-- Table: organization_invitations
-- =============================================================================
create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.organization_role not null default 'technician',
  status public.invitation_status not null default 'pending',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

comment on table public.organization_invitations is
  'Pending/accepted/revoked invitations to join an organization. Phase 1 '
  'implements the full accept flow (accept_invitation RPC) but does not '
  'send email — see docs/RLS.md and README.md for what remains to wire up '
  'email delivery.';

create index organization_invitations_organization_id_idx on public.organization_invitations (organization_id);
create index organization_invitations_email_idx on public.organization_invitations (lower(email));

-- Only one pending invitation per (organization, email) at a time.
create unique index organization_invitations_one_pending_idx
  on public.organization_invitations (organization_id, lower(email))
  where (status = 'pending');

-- =============================================================================
-- Trigger: auto-create a profile row when a new auth user signs up
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Trigger: protect the "at least one active owner" invariant
-- =============================================================================
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining_owners int;
begin
  if old.role <> 'owner' then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.role = 'owner' and new.status = 'active' then
    return new;
  end if;

  select count(*) into remaining_owners
  from public.organization_members
  where organization_id = old.organization_id
    and role = 'owner'
    and status = 'active'
    and id <> old.id;

  if remaining_owners = 0 then
    raise exception 'An organization must always have at least one active owner'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger organization_members_protect_last_owner
  before update or delete on public.organization_members
  for each row execute function public.protect_last_owner();

-- =============================================================================
-- Helper functions used by RLS policies (all security definer, all scoped
-- to auth.uid() — see the SECURITY MODEL note at the top of this file)
-- =============================================================================

-- Any membership row at all, regardless of status. Used to decide whether a
-- user may see an organization's basic record even while invited/disabled.
create or replace function public.is_org_member_any_status(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
  );
$$;

-- Active membership only. This is the main "does this user belong to this
-- organization" check that future tables should use.
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- Active owner or admin.
create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = target_org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

-- The caller's role in an organization (active membership only), or null.
create or replace function public.get_org_role(target_org_id uuid)
returns public.organization_role
language sql
security definer
set search_path = public
stable
as $$
  select m.role from public.organization_members m
  where m.organization_id = target_org_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- Whether the caller shares at least one active organization with
-- target_user_id. Used to let teammates see each other's profile info
-- without exposing every profile on the platform.
create or replace function public.shares_org_with(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m1
    join public.organization_members m2 on m2.organization_id = m1.organization_id
    where m1.user_id = auth.uid()
      and m2.user_id = target_user_id
      and m1.status = 'active'
      and m2.status = 'active'
  );
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

-- No table grants to anon: every table in this schema requires a signed-in
-- user. Grants below apply only to the `authenticated` role.
revoke all on public.organizations, public.profiles, public.organization_members, public.organization_invitations
  from anon;

-- ---------- organizations ----------
grant select, update on public.organizations to authenticated;
-- Intentionally no INSERT/DELETE grant: organizations are only ever created
-- via the create_organization() RPC below, and deletion isn't a Phase 1
-- feature.

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_org_member_any_status(id));

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- ---------- profiles ----------
grant select, update on public.profiles to authenticated;
-- No INSERT grant: profiles are only ever created by handle_new_user().

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- organization_members ----------
grant select, update on public.organization_members to authenticated;
-- No INSERT grant: membership rows are only created by create_organization()
-- and accept_invitation(). No DELETE grant: Phase 1 only supports disabling
-- a member (status = 'disabled'), never deleting the row.

create policy organization_members_select on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));

-- Only an active owner/admin may update a member row, and only an owner may
-- touch a row that currently holds — or would come to hold — the 'owner'
-- role. This is what stops an admin from promoting themselves to owner or
-- editing an owner's row.
create policy organization_members_update on public.organization_members
  for update to authenticated
  using (
    public.is_org_admin(organization_id)
    and (role <> 'owner' or public.get_org_role(organization_id) = 'owner')
  )
  with check (
    public.is_org_admin(organization_id)
    and (role <> 'owner' or public.get_org_role(organization_id) = 'owner')
  );

-- ---------- organization_invitations ----------
grant select, insert, update on public.organization_invitations to authenticated;
-- No DELETE grant: revoking an invitation is an UPDATE (status = 'revoked').

create policy organization_invitations_select on public.organization_invitations
  for select to authenticated
  using (
    public.is_org_admin(organization_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy organization_invitations_insert on public.organization_invitations
  for insert to authenticated
  with check (
    public.is_org_admin(organization_id)
    and (role <> 'owner' or public.get_org_role(organization_id) = 'owner')
    and invited_by = auth.uid()
  );

create policy organization_invitations_update on public.organization_invitations
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

-- =============================================================================
-- RPCs: atomic, cross-table operations
-- =============================================================================

-- Creates a new organization and makes the calling user its owner, in one
-- transaction. This is the only way an organization row can be created.
create or replace function public.create_organization(org_name text, org_timezone text default 'America/New_York')
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  candidate_slug text;
  suffix int := 0;
  new_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(org_name), '') = '' then
    raise exception 'Organization name is required';
  end if;

  base_slug := lower(regexp_replace(trim(org_name), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then
    base_slug := 'org';
  end if;

  candidate_slug := base_slug;
  while exists (select 1 from public.organizations where slug = candidate_slug) loop
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  end loop;

  insert into public.organizations (name, slug, timezone)
  values (trim(org_name), candidate_slug, coalesce(nullif(trim(org_timezone), ''), 'America/New_York'))
  returning * into new_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (new_org.id, auth.uid(), 'owner', 'active');

  return new_org;
end;
$$;

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;

-- Accepts a pending invitation whose email matches the caller's own email,
-- turning it into an active organization_members row.
create or replace function public.accept_invitation(invite_token uuid)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.organization_invitations;
  member public.organization_members;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv
  from public.organization_invitations
  where token = invite_token and status = 'pending';

  if not found then
    raise exception 'This invitation is invalid or has already been used';
  end if;

  if lower(inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (inv.organization_id, auth.uid(), inv.role, 'active')
  on conflict (organization_id, user_id)
    do update set status = 'active', role = excluded.role
  returning * into member;

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = inv.id;

  return member;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- Returns the members of an organization the caller belongs to, joined with
-- profile info and auth.users.email. auth.users is never exposed directly to
-- clients; this is the one sanctioned, membership-gated way to read a
-- teammate's email address.
create or replace function public.list_organization_members(target_org_id uuid)
returns table (
  member_id uuid,
  user_id uuid,
  role public.organization_role,
  status public.member_status,
  created_at timestamptz,
  first_name text,
  last_name text,
  avatar_url text,
  phone text,
  email text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id as member_id,
    m.user_id,
    m.role,
    m.status,
    m.created_at,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.phone,
    u.email::text
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  join auth.users u on u.id = m.user_id
  where m.organization_id = target_org_id
    and public.is_org_member(target_org_id)
  order by m.created_at asc;
$$;

revoke all on function public.list_organization_members(uuid) from public;
grant execute on function public.list_organization_members(uuid) to authenticated;
