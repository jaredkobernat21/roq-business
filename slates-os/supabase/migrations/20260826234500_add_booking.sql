-- =============================================================================
-- SLATES OS — Phase 2B-3: organization branding + public booking
-- =============================================================================
-- Two things ship together:
--
-- 1. Branding columns on organizations (primary/secondary color, booking
--    welcome text, address). name/logo_url/phone/email/website already
--    existed from Phase 1; slug (already unique + URL-safe) doubles as the
--    public booking slug — no new column needed for that.
--
-- 2. A narrow, anonymous-callable RPC surface for the public booking page.
--    CRITICAL: no table in this schema grants anything to `anon` — every
--    other table requires an authenticated org member (see docs/RLS.md).
--    The booking page is the first feature with real anonymous visitors, so
--    instead of opening up table grants, it gets exactly four
--    `security definer` functions that each return/accept only what a
--    stranger on the internet should be able to see or do:
--      - get_booking_organization: public branding fields only
--      - get_bookable_services: only services marked bookable_online + active
--      - get_public_availability: business hours + busy spans for one day,
--        no customer/job details — just enough for src/lib/scheduling/
--        availability.ts (the same pure functions the internal Schedule
--        page uses) to compute free slots
--      - submit_booking: the one write path; re-validates everything
--        server-side rather than trusting whatever the client claims
-- =============================================================================

alter table public.organizations
  add column primary_color text check (primary_color is null or primary_color ~* '^#[0-9a-f]{6}$'),
  add column secondary_color text check (secondary_color is null or secondary_color ~* '^#[0-9a-f]{6}$'),
  add column booking_welcome_text text,
  add column address text;

-- =============================================================================
-- get_booking_organization — public branding lookup by slug
-- =============================================================================
create or replace function public.get_booking_organization(org_slug text)
returns table (
  id uuid,
  name text,
  logo_url text,
  primary_color text,
  secondary_color text,
  phone text,
  email text,
  website text,
  address text,
  booking_welcome_text text,
  timezone text
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.name, o.logo_url, o.primary_color, o.secondary_color,
         o.phone, o.email, o.website, o.address, o.booking_welcome_text, o.timezone
  from public.organizations o
  where o.slug = org_slug;
$$;

revoke all on function public.get_booking_organization(text) from public;
grant execute on function public.get_booking_organization(text) to anon, authenticated;

-- =============================================================================
-- get_bookable_services — public service catalog by org slug
-- =============================================================================
create or replace function public.get_bookable_services(org_slug text)
returns table (
  id uuid,
  name text,
  description text,
  duration_minutes integer,
  starting_price_cents integer
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.name, s.description, s.duration_minutes, s.starting_price_cents
  from public.services s
  join public.organizations o on o.id = s.organization_id
  where o.slug = org_slug
    and s.is_active
    and s.bookable_online
  order by s.name;
$$;

revoke all on function public.get_bookable_services(text) from public;
grant execute on function public.get_bookable_services(text) to anon, authenticated;

-- =============================================================================
-- get_public_availability — one day's business hours + busy spans
-- =============================================================================
-- Busy spans are whole-team only (all jobs regardless of assignee, plus
-- org-wide schedule_blocks) — the booking flow doesn't offer technician
-- selection, so per-member availability isn't relevant here. No customer,
-- job, or block details are exposed, only start/end instants.
create or replace function public.get_public_availability(org_slug text, target_date date)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  target_org uuid;
  day_of_week int;
  v_is_open boolean;
  v_open_time time;
  v_close_time time;
  result jsonb;
begin
  select id into target_org from public.organizations where slug = org_slug;
  if target_org is null then
    return null;
  end if;

  day_of_week := extract(dow from target_date);

  -- Scalar targets (not a record/row variable) so a day with no configured
  -- hours yet simply comes back as all-NULL rather than an unassigned
  -- record, which would raise on the field access below.
  select is_open, open_time, close_time
  into v_is_open, v_open_time, v_close_time
  from public.business_hours
  where organization_id = target_org and business_hours.day_of_week = day_of_week;

  select jsonb_build_object(
    'is_open', coalesce(v_is_open, false),
    'open_time', v_open_time,
    'close_time', v_close_time,
    'busy', coalesce(
      (
        select jsonb_agg(jsonb_build_object('start', start_at, 'end', end_at))
        from (
          select j.scheduled_at as start_at,
                 j.scheduled_at + make_interval(mins => coalesce(j.duration_minutes, 60)) as end_at
          from public.jobs j
          where j.organization_id = target_org
            and j.scheduled_at::date = target_date
            and j.status <> 'cancelled'
          union all
          select b.starts_at, b.ends_at
          from public.schedule_blocks b
          where b.organization_id = target_org
            and b.member_id is null
            and b.starts_at::date <= target_date
            and b.ends_at::date >= target_date
        ) spans
      ),
      '[]'::jsonb
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_public_availability(text, date) from public;
grant execute on function public.get_public_availability(text, date) to anon, authenticated;

-- =============================================================================
-- submit_booking — the one public write path
-- =============================================================================
create or replace function public.submit_booking(
  org_slug text,
  service_id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  address_line1 text,
  city text,
  state text,
  postal_code text,
  starts_at timestamptz,
  notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_org uuid;
  svc record;
  ends_at timestamptz;
  target_customer uuid;
  conflict_count int;
  new_job_id uuid;
begin
  select id into target_org from public.organizations where slug = org_slug;
  if target_org is null then
    raise exception 'Unknown business';
  end if;

  if coalesce(trim(first_name), '') = '' then
    raise exception 'First name is required';
  end if;

  select id, name, duration_minutes into svc
  from public.services
  where id = service_id
    and organization_id = target_org
    and is_active
    and bookable_online;
  if svc.id is null then
    raise exception 'That service is not available for booking';
  end if;

  ends_at := starts_at + make_interval(mins => coalesce(svc.duration_minutes, 60));

  if starts_at <= now() then
    raise exception 'That time has already passed';
  end if;

  -- Re-check the slot is still free server-side — never trust a
  -- client-supplied time without re-validating against current data.
  select count(*) into conflict_count
  from public.jobs j
  where j.organization_id = target_org
    and j.status <> 'cancelled'
    and j.scheduled_at < ends_at
    and j.scheduled_at + make_interval(mins => coalesce(j.duration_minutes, 60)) > starts_at;
  if conflict_count > 0 then
    raise exception 'That time was just booked — please choose another';
  end if;

  select count(*) into conflict_count
  from public.schedule_blocks b
  where b.organization_id = target_org
    and b.member_id is null
    and b.starts_at < ends_at
    and b.ends_at > starts_at;
  if conflict_count > 0 then
    raise exception 'That time is not available — please choose another';
  end if;

  -- Find or create the customer by phone/email within this organization.
  select id into target_customer
  from public.customers
  where organization_id = target_org
    and (
      (nullif(trim(phone), '') is not null and customers.phone = trim(phone))
      or (nullif(trim(email), '') is not null and lower(customers.email) = lower(trim(email)))
    )
  order by created_at asc
  limit 1;

  if target_customer is null then
    insert into public.customers (organization_id, first_name, last_name, phone, email, status)
    values (target_org, trim(first_name), nullif(trim(last_name), ''), nullif(trim(phone), ''), nullif(trim(email), ''), 'customer')
    returning id into target_customer;
  end if;

  if nullif(trim(address_line1), '') is not null then
    insert into public.customer_addresses (organization_id, customer_id, line1, city, state, postal_code, is_primary)
    values (
      target_org, target_customer, trim(address_line1),
      nullif(trim(city), ''), nullif(trim(state), ''), nullif(trim(postal_code), ''), true
    )
    on conflict do nothing;
  end if;

  insert into public.jobs (
    organization_id, customer_id, service_id, title, status, scheduled_at, duration_minutes, notes
  )
  values (
    target_org, target_customer, svc.id, svc.name, 'scheduled', starts_at,
    coalesce(svc.duration_minutes, 60), nullif(trim(notes), '')
  )
  returning id into new_job_id;

  return new_job_id;
end;
$$;

revoke all on function public.submit_booking(text, uuid, text, text, text, text, text, text, text, text, timestamptz, text) from public;
grant execute on function public.submit_booking(text, uuid, text, text, text, text, text, text, text, text, timestamptz, text) to anon, authenticated;
