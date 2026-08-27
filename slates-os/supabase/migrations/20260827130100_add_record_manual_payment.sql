-- =============================================================================
-- Manual payments, part 2 of 2: record_manual_payment.
--
-- Mirrors record_stripe_payment — same invoice locking, same ledger-plus-
-- invoice update in one transaction — with two differences that matter:
--
--  1. It is called by a signed-in user rather than by a verified webhook, so
--     it has to authorize the caller itself. It is security definer (payments
--     has no INSERT grant; the ledger is only ever written through an RPC, see
--     docs/RLS.md), which means the permission check below IS the security
--     boundary, not a convenience.
--  2. There is no external id to deduplicate against, so idempotency can't come
--     from a unique constraint. Recording the same cash payment twice is a
--     human mistake, not a retry storm, and the fix for it is a visible ledger
--     — not silently swallowing the second entry.
-- =============================================================================
create or replace function public.record_manual_payment(
  target_invoice_id uuid,
  amount_cents integer,
  payment_method text,
  payment_reference text default null,
  received_at timestamptz default now()
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
  if amount_cents is null or amount_cents <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  if payment_method is null or payment_method not in ('cash', 'check', 'bank_transfer', 'other') then
    raise exception 'Unknown payment method';
  end if;

  select id, organization_id, total_cents, amount_paid_cents, status
  into inv
  from public.invoices
  where id = target_invoice_id
  for update;

  if inv.id is null then
    raise exception 'Unknown invoice';
  end if;

  -- The authorization boundary. Same tier that can create and send invoices.
  if not public.is_org_scheduler_or_above(inv.organization_id) then
    raise exception 'Not authorized to record payments for this invoice';
  end if;

  if inv.status = 'void' then
    raise exception 'Cannot record a payment against a void invoice';
  end if;

  if inv.status = 'draft' then
    raise exception 'Send the invoice before recording a payment against it';
  end if;

  insert into public.payments (
    organization_id, invoice_id, provider, external_payment_id,
    amount_cents, status, method, reference, recorded_by, paid_at
  )
  values (
    inv.organization_id, inv.id, 'manual', gen_random_uuid()::text,
    amount_cents, 'succeeded', payment_method,
    nullif(trim(coalesce(payment_reference, '')), ''), auth.uid(), received_at
  );

  new_paid_cents := inv.amount_paid_cents + amount_cents;
  -- Overpayment is allowed on purpose: tips and rounding are real, and the
  -- business is entering a number it can see. It settles the invoice.
  new_status := case when new_paid_cents >= inv.total_cents then 'paid' else 'partially_paid' end;

  update public.invoices
  set amount_paid_cents = new_paid_cents, status = new_status
  where id = inv.id;
end;
$$;

-- Not granted to anon: unlike get_invoice_stripe_account, nothing on the
-- public invoice page should ever be able to declare an invoice paid.
revoke all on function public.record_manual_payment(uuid, integer, text, text, timestamptz) from public;
grant execute on function public.record_manual_payment(uuid, integer, text, text, timestamptz) to authenticated;
