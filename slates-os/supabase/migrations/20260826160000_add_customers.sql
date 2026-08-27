-- =============================================================================
-- SLATES OS — Phase 2A-1: customers
-- =============================================================================
-- Adds the first "shared core" entity from docs/ARCHITECTURE.md: customers.
-- Two things ship together here, per that doc:
--   1. organizations.business_mode + a business_mode enum, so a later
--      business mode doesn't require restructuring organizations. Only one
--      mode exists today — see src/lib/labels.ts for where the label side
--      of this lives.
--   2. customers / customer_addresses, following the same
--      organization_id + RLS shape as every table in the init migration
--      (see docs/SCHEMA.md).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- business_mode
-- -----------------------------------------------------------------------------
create type public.business_mode as enum ('service_business');

alter table public.organizations
  add column business_mode public.business_mode not null default 'service_business';

-- -----------------------------------------------------------------------------
-- Additional RLS helper: staff who manage the customer/job book (owner,
-- admin, scheduler) as distinct from technicians, who per the product spec
-- only see/update their own assigned jobs, not the customer list.
-- -----------------------------------------------------------------------------
create or replace function public.is_org_scheduler_or_above(target_org_id uuid)
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
      and m.role in ('owner', 'admin', 'scheduler')
  );
$$;

-- =============================================================================
-- Table: customers
-- =============================================================================
create type public.customer_status as enum ('lead', 'customer');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) > 0),
  last_name text,
  company_name text,
  phone text,
  email text,
  status public.customer_status not null default 'lead',
  tags text[] not null default '{}',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customers is
  'Whoever the business serves. Generic across future business modes (see '
  'docs/ARCHITECTURE.md) — the display label is resolved per '
  'organization.business_mode in the app, never hardcoded here.';

create index customers_organization_id_idx on public.customers (organization_id);
create index customers_organization_status_idx on public.customers (organization_id, status);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Table: customer_addresses
-- =============================================================================
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Service address',
  line1 text not null check (char_length(trim(line1)) > 0),
  line2 text,
  city text,
  state text,
  postal_code text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index customer_addresses_organization_id_idx on public.customer_addresses (organization_id);
create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);

-- At most one primary address per customer.
create unique index customer_addresses_one_primary_idx
  on public.customer_addresses (customer_id)
  where (is_primary);

-- customer_addresses.organization_id is denormalized alongside customer_id
-- so its RLS policies can stay a plain is_org_member(organization_id) check
-- like every other table, instead of joining through customers. This
-- trigger is what keeps that denormalized copy honest — without it, a
-- member of org A could insert a row with organization_id = org A but
-- customer_id belonging to a customer in org B, which the bare FK wouldn't
-- catch.
create or replace function public.customer_addresses_check_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust_org uuid;
begin
  select organization_id into cust_org from public.customers where id = new.customer_id;
  if cust_org is null or cust_org <> new.organization_id then
    raise exception 'customer_addresses.organization_id must match the customer''s organization';
  end if;
  return new;
end;
$$;

create trigger customer_addresses_enforce_org
  before insert or update on public.customer_addresses
  for each row execute function public.customer_addresses_check_org();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

revoke all on public.customers, public.customer_addresses from anon;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;

-- ---------- customers ----------
create policy customers_select on public.customers
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

create policy customers_update on public.customers
  for update to authenticated
  using (public.is_org_scheduler_or_above(organization_id))
  with check (public.is_org_scheduler_or_above(organization_id));

create policy customers_delete on public.customers
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------- customer_addresses ----------
create policy customer_addresses_select on public.customer_addresses
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy customer_addresses_insert on public.customer_addresses
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

create policy customer_addresses_update on public.customer_addresses
  for update to authenticated
  using (public.is_org_scheduler_or_above(organization_id))
  with check (public.is_org_scheduler_or_above(organization_id));

create policy customer_addresses_delete on public.customer_addresses
  for delete to authenticated
  using (public.is_org_scheduler_or_above(organization_id));
