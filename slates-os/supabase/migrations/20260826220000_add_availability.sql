-- =============================================================================
-- SLATES OS — Phase 2B-2: availability
-- =============================================================================
-- Adds the data the branded booking page (Phase 2B-3) will need to compute
-- available slots: weekly business hours and one-off blocked time. Per the
-- Phase 2 spec, "build availability logic separately enough that online
-- booking can consume it" — this migration only adds the data; the actual
-- slot computation is a pure function in src/lib/scheduling/availability.ts
-- that takes this data (plus existing jobs) as plain arguments, so both the
-- internal Schedule page and the future public booking page can call it the
-- same way.
-- =============================================================================

-- =============================================================================
-- Table: business_hours
-- =============================================================================
-- One row per day of week (0 = Sunday .. 6 = Saturday) per organization.
-- Rows are upserted together by the settings form — there is no seeding
-- trigger on organization creation, so a brand-new org simply has no rows
-- until it configures hours (treated as "closed every day" until then).
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time,
  unique (organization_id, day_of_week),
  check (is_open = false or (open_time is not null and close_time is not null and open_time < close_time))
);

create index business_hours_organization_id_idx on public.business_hours (organization_id);

-- =============================================================================
-- Table: schedule_blocks
-- =============================================================================
-- A one-off span of unavailable time. member_id null = blocks the whole
-- organization (e.g. a holiday closure); set = blocks just that person
-- (e.g. time off).
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index schedule_blocks_organization_id_idx on public.schedule_blocks (organization_id);
create index schedule_blocks_starts_at_idx on public.schedule_blocks (starts_at);

create or replace function public.schedule_blocks_check_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.member_id is not null and not exists (
    select 1 from public.organization_members m
    where m.organization_id = new.organization_id
      and m.user_id = new.member_id
      and m.status = 'active'
  ) then
    raise exception 'schedule_blocks.member_id must be an active member of the organization';
  end if;
  return new;
end;
$$;

create trigger schedule_blocks_enforce_member
  before insert or update on public.schedule_blocks
  for each row execute function public.schedule_blocks_check_member();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.business_hours enable row level security;
alter table public.schedule_blocks enable row level security;

revoke all on public.business_hours, public.schedule_blocks from anon;
grant select, insert, update, delete on public.business_hours to authenticated;
grant select, insert, delete on public.schedule_blocks to authenticated;

-- ---------- business_hours ----------
-- Every member can see hours (needed to render the schedule); only
-- owners/admins configure them — same tier as services and business info.
create policy business_hours_select on public.business_hours
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy business_hours_insert on public.business_hours
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy business_hours_update on public.business_hours
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy business_hours_delete on public.business_hours
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------- schedule_blocks ----------
create policy schedule_blocks_select on public.schedule_blocks
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy schedule_blocks_insert on public.schedule_blocks
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

create policy schedule_blocks_delete on public.schedule_blocks
  for delete to authenticated
  using (public.is_org_scheduler_or_above(organization_id));
