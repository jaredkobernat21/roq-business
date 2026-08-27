-- =============================================================================
-- SLATES OS — Phase 2C-1: invoices
-- =============================================================================
-- invoices / invoice_items follow the same organization_id + RLS shape as
-- every table so far. Two things worth calling out:
--
-- 1. invoice_number is assigned server-side (trigger below), never by the
--    client — sequential per organization, gapless-enough for a small
--    business (starts at 1001). Concurrent inserts for the same org are
--    serialized by locking that organization's row first, the standard
--    Postgres pattern for "next number per group" without a per-org
--    sequence object.
-- 2. amount_paid_cents exists now (defaulting to 0) so the Stripe payments
--    milestone can start writing to it without an invoices schema change —
--    but nothing writes it yet in this migration.
--
-- The customer-facing invoice page (Phase 2C, /invoice/[id]) is public like
-- the booking page, so it gets the same narrow security-definer treatment:
-- get_invoice_for_viewing is the only anon-callable entry point, and it
-- only ever returns non-draft invoices.
-- =============================================================================

create type public.invoice_status as enum (
  'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'void'
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  invoice_number integer not null,
  status public.invoice_status not null default 'draft',
  subtotal_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  due_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (organization_id, invoice_number)
);

comment on table public.invoices is
  'Generic across future business modes — "invoice" is the shared concept, '
  'no service-business-specific columns. See docs/ARCHITECTURE.md.';

create index invoices_organization_id_idx on public.invoices (organization_id);
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_organization_status_idx on public.invoices (organization_id, status);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create or replace function public.invoices_assign_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number int;
begin
  if new.invoice_number is not null then
    return new;
  end if;

  -- Lock the parent org row so two concurrent inserts for the same
  -- organization can't compute the same "next" number.
  perform 1 from public.organizations where id = new.organization_id for update;

  select coalesce(max(invoice_number), 1000) + 1 into next_number
  from public.invoices
  where organization_id = new.organization_id;

  new.invoice_number := next_number;
  return new;
end;
$$;

create trigger invoices_assign_number
  before insert on public.invoices
  for each row execute function public.invoices_assign_number();

-- Keeps customer_id/job_id consistent with organization_id, same
-- denormalization-safety pattern as jobs_before_write.
create or replace function public.invoices_check_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust_org uuid;
  job_org uuid;
begin
  select organization_id into cust_org from public.customers where id = new.customer_id;
  if cust_org is null or cust_org <> new.organization_id then
    raise exception 'invoices.organization_id must match the customer''s organization';
  end if;

  if new.job_id is not null then
    select organization_id into job_org from public.jobs where id = new.job_id;
    if job_org is null or job_org <> new.organization_id then
      raise exception 'invoices.job_id must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger invoices_enforce_consistency
  before insert or update on public.invoices
  for each row execute function public.invoices_check_consistency();

-- =============================================================================
-- Table: invoice_items
-- =============================================================================
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  description text not null check (char_length(trim(description)) > 0),
  quantity numeric not null default 1 check (quantity > 0),
  rate_cents integer not null default 0 check (rate_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index invoice_items_organization_id_idx on public.invoice_items (organization_id);

create or replace function public.invoice_items_check_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_org uuid;
begin
  select organization_id into inv_org from public.invoices where id = new.invoice_id;
  if inv_org is null or inv_org <> new.organization_id then
    raise exception 'invoice_items.organization_id must match the invoice''s organization';
  end if;
  return new;
end;
$$;

create trigger invoice_items_enforce_org
  before insert or update on public.invoice_items
  for each row execute function public.invoice_items_check_org();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

revoke all on public.invoices, public.invoice_items from anon;
grant select, insert, update on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
-- No DELETE grant on invoices: "removed" is represented by status = 'void',
-- same reasoning as organization_members (status changes, not row deletes).

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

create policy invoices_update on public.invoices
  for update to authenticated
  using (public.is_org_scheduler_or_above(organization_id))
  with check (public.is_org_scheduler_or_above(organization_id));

create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy invoice_items_insert on public.invoice_items
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

create policy invoice_items_update on public.invoice_items
  for update to authenticated
  using (public.is_org_scheduler_or_above(organization_id))
  with check (public.is_org_scheduler_or_above(organization_id));

create policy invoice_items_delete on public.invoice_items
  for delete to authenticated
  using (public.is_org_scheduler_or_above(organization_id));

-- =============================================================================
-- get_invoice_for_viewing — the one public read path (like get_booking_organization)
-- =============================================================================
-- Only ever returns a non-draft invoice: a draft is a work in progress, not
-- something a link should expose. Marks a freshly-sent invoice as "viewed"
-- the first time a customer opens it — the same request that reads it also
-- advances its status, so the dashboard's "sent vs viewed" distinction
-- reflects reality without a separate tracking mechanism.
create or replace function public.get_invoice_for_viewing(target_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  org record;
  cust record;
  items jsonb;
  result jsonb;
begin
  select * into inv from public.invoices where id = target_invoice_id and status <> 'draft';
  if inv.id is null then
    return null;
  end if;

  if inv.status = 'sent' then
    update public.invoices set status = 'viewed' where id = inv.id;
    inv.status := 'viewed';
  end if;

  select name, logo_url, primary_color, secondary_color, phone, email, website, address
  into org
  from public.organizations where id = inv.organization_id;

  select first_name, last_name, company_name, email
  into cust
  from public.customers where id = inv.customer_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'description', description, 'quantity', quantity, 'rate_cents', rate_cents
  ) order by sort_order, created_at), '[]'::jsonb)
  into items
  from public.invoice_items where invoice_id = inv.id;

  select jsonb_build_object(
    'id', inv.id,
    'invoice_number', inv.invoice_number,
    'status', inv.status,
    'subtotal_cents', inv.subtotal_cents,
    'tax_cents', inv.tax_cents,
    'total_cents', inv.total_cents,
    'amount_paid_cents', inv.amount_paid_cents,
    'due_date', inv.due_date,
    'notes', inv.notes,
    'items', items,
    'organization', jsonb_build_object(
      'name', org.name, 'logo_url', org.logo_url, 'primary_color', org.primary_color,
      'secondary_color', org.secondary_color, 'phone', org.phone, 'email', org.email,
      'website', org.website, 'address', org.address
    ),
    'customer', jsonb_build_object(
      'first_name', cust.first_name, 'last_name', cust.last_name,
      'company_name', cust.company_name, 'email', cust.email
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_invoice_for_viewing(uuid) from public;
grant execute on function public.get_invoice_for_viewing(uuid) to anon, authenticated;
