-- =============================================================================
-- SLATES OS — Phase 2C-2: payment connections + payments
-- =============================================================================
-- SLATES never operates as the payment processor and never touches a card
-- number — this schema is the connection/ledger layer, not a payments
-- engine. Stripe is the first provider implemented, but `provider` is a
-- real column (not assumed to always be 'stripe') so a later processor
-- (Square, etc.) is a new enum value and a new implementation behind the
-- same two tables, not a schema rebuild — same pattern as business_mode.
--
-- payment_connections stores only the connected account identifier Stripe
-- (or a future provider) gives us — never a secret, never card data. The
-- business's own dashboard with that provider is the actual source of
-- truth for their funds; this table just remembers which account to route
-- a Checkout Session to.
--
-- payments is written exclusively by a security definer RPC
-- (record_stripe_payment, in this migration) called from the webhook route
-- handler — never by a direct authenticated client insert, and the RPC is
-- idempotent (unique on provider+external_payment_id, ON CONFLICT DO
-- NOTHING) so a retried webhook delivery can't double-count a payment. See
-- docs/RLS.md's "why some operations are RPCs instead of policies".
-- =============================================================================

create type public.payment_provider as enum ('stripe');
create type public.payment_connection_status as enum ('pending', 'connected', 'disconnected', 'error');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create table public.payment_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.payment_provider not null,
  external_account_id text not null,
  status public.payment_connection_status not null default 'pending',
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create index payment_connections_organization_id_idx on public.payment_connections (organization_id);

create trigger payment_connections_set_updated_at
  before update on public.payment_connections
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  provider public.payment_provider not null,
  external_payment_id text not null,
  amount_cents integer not null check (amount_cents > 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (provider, external_payment_id)
);

create index payments_organization_id_idx on public.payments (organization_id);
create index payments_invoice_id_idx on public.payments (invoice_id);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.payment_connections enable row level security;
alter table public.payments enable row level security;

revoke all on public.payment_connections, public.payments from anon;
-- payment_connections: owner/admin only, same tier as connecting/editing
-- other sensitive integrations — no DELETE grant, "disconnected" is a
-- status, not a row removal (keeps the historical external_account_id
-- around, matching Phase 2 spec's "sync safety" guidance).
grant select, insert, update on public.payment_connections to authenticated;
grant select on public.payments to authenticated;

create policy payment_connections_select on public.payment_connections
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy payment_connections_insert on public.payment_connections
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy payment_connections_update on public.payment_connections
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy payments_select on public.payments
  for select to authenticated
  using (public.is_org_member(organization_id));

-- =============================================================================
-- get_invoice_stripe_account — public lookup so the customer-facing invoice
-- page can create a Checkout Session against the right connected account
-- without exposing payment_connections broadly.
-- =============================================================================
create or replace function public.get_invoice_stripe_account(target_invoice_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select pc.external_account_id
  from public.invoices i
  join public.payment_connections pc
    on pc.organization_id = i.organization_id
   and pc.provider = 'stripe'
   and pc.status = 'connected'
  where i.id = target_invoice_id
    and i.status <> 'draft';
$$;

revoke all on function public.get_invoice_stripe_account(uuid) from public;
grant execute on function public.get_invoice_stripe_account(uuid) to anon, authenticated;

-- =============================================================================
-- record_stripe_payment — the one write path for payments, called by the
-- webhook route handler after it verifies the Stripe signature. Updates
-- the invoice's amount_paid_cents/status alongside inserting the ledger
-- row, in one transaction.
-- =============================================================================
create or replace function public.record_stripe_payment(
  target_invoice_id uuid,
  stripe_payment_id text,
  amount_cents integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv record;
  new_paid_cents integer;
  new_status public.invoice_status;
begin
  select id, organization_id, total_cents, amount_paid_cents
  into inv
  from public.invoices
  where id = target_invoice_id
  for update;

  if inv.id is null then
    raise exception 'Unknown invoice';
  end if;

  insert into public.payments (organization_id, invoice_id, provider, external_payment_id, amount_cents, status)
  values (inv.organization_id, inv.id, 'stripe', stripe_payment_id, amount_cents, 'succeeded')
  on conflict (provider, external_payment_id) do nothing;

  -- If this payment_id was already recorded (a retried webhook delivery),
  -- don't double-count it against the invoice.
  if not found then
    return;
  end if;

  new_paid_cents := inv.amount_paid_cents + amount_cents;
  new_status := case when new_paid_cents >= inv.total_cents then 'paid' else 'partially_paid' end;

  update public.invoices
  set amount_paid_cents = new_paid_cents, status = new_status
  where id = inv.id;
end;
$$;

revoke all on function public.record_stripe_payment(uuid, text, integer) from public;
grant execute on function public.record_stripe_payment(uuid, text, integer) to anon, authenticated;
