-- =============================================================================
-- SLATES OS — Phase 2A-2: services, jobs, activity
-- =============================================================================
-- Adds the second and third "shared core" entities from docs/ARCHITECTURE.md
-- (workflows/jobs, plus the services catalog they draw from) and the
-- activity_events log that backs the customer profile timeline. Same
-- organization_id + RLS shape as every other table (docs/SCHEMA.md).
--
-- activity_events is populated exclusively by triggers on customers/jobs,
-- never by direct client inserts — same "no INSERT grant, only a
-- security definer path can write this" pattern the init migration uses for
-- profiles (via handle_new_user). This guarantees the timeline stays
-- accurate no matter which code path creates a customer or job.
-- =============================================================================

-- =============================================================================
-- Table: services
-- =============================================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  starting_price_cents integer check (starting_price_cents is null or starting_price_cents >= 0),
  is_active boolean not null default true,
  bookable_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.services is
  'An organization''s service catalog. starting_price_cents is nullable — '
  'not every service has a public price (see Phase 2 spec, section 8).';

create index services_organization_id_idx on public.services (organization_id);

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Table: jobs
-- =============================================================================
create type public.job_status as enum (
  'lead', 'estimate', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  address_id uuid references public.customer_addresses(id) on delete set null,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.job_status not null default 'lead',
  scheduled_at timestamptz,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.jobs is
  'The unit of work a customer moves through lead-to-completion. Generic '
  'across future business modes (see docs/ARCHITECTURE.md) — "job" is the '
  'service-business label; the underlying table name is stable.';

create index jobs_organization_id_idx on public.jobs (organization_id);
create index jobs_organization_status_idx on public.jobs (organization_id, status);
create index jobs_customer_id_idx on public.jobs (customer_id);
create index jobs_assigned_to_idx on public.jobs (assigned_to);
create index jobs_scheduled_at_idx on public.jobs (scheduled_at);

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- Validates that service_id/address_id/assigned_to are all consistent with
-- the job's own organization_id and customer_id (the same denormalization
-- problem customer_addresses has — see that table's comment in the previous
-- migration), and maintains completed_at alongside status.
create or replace function public.jobs_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cust_org uuid;
  svc_org uuid;
  addr_customer uuid;
begin
  select organization_id into cust_org from public.customers where id = new.customer_id;
  if cust_org is null or cust_org <> new.organization_id then
    raise exception 'jobs.organization_id must match the customer''s organization';
  end if;

  if new.service_id is not null then
    select organization_id into svc_org from public.services where id = new.service_id;
    if svc_org is null or svc_org <> new.organization_id then
      raise exception 'jobs.service_id must belong to the same organization';
    end if;
  end if;

  if new.address_id is not null then
    select customer_id into addr_customer from public.customer_addresses where id = new.address_id;
    if addr_customer is null or addr_customer <> new.customer_id then
      raise exception 'jobs.address_id must belong to the job''s customer';
    end if;
  end if;

  if new.assigned_to is not null and not exists (
    select 1 from public.organization_members m
    where m.organization_id = new.organization_id
      and m.user_id = new.assigned_to
      and m.status = 'active'
  ) then
    raise exception 'jobs.assigned_to must be an active member of the organization';
  end if;

  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger jobs_before_write
  before insert or update on public.jobs
  for each row execute function public.jobs_before_write();

-- =============================================================================
-- Table: activity_events
-- =============================================================================
create type public.activity_event_type as enum ('customer_created', 'job_created', 'job_status_changed');

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  event_type public.activity_event_type not null,
  actor_id uuid references auth.users(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

comment on table public.activity_events is
  'Append-only timeline, populated only by the trigger functions below — '
  'never by a direct client insert (no INSERT grant to authenticated). This '
  'is what backs the customer profile activity feed.';

create index activity_events_organization_id_idx on public.activity_events (organization_id);
create index activity_events_customer_id_idx on public.activity_events (customer_id);
create index activity_events_job_id_idx on public.activity_events (job_id);

create or replace function public.log_customer_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (organization_id, customer_id, event_type, actor_id, data)
  values (
    new.organization_id, new.id, 'customer_created', auth.uid(),
    jsonb_build_object('name', trim(new.first_name || ' ' || coalesce(new.last_name, '')))
  );
  return new;
end;
$$;

create trigger customers_log_created
  after insert on public.customers
  for each row execute function public.log_customer_created();

create or replace function public.log_job_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (organization_id, customer_id, job_id, event_type, actor_id, data)
  values (
    new.organization_id, new.customer_id, new.id, 'job_created', auth.uid(),
    jsonb_build_object('title', new.title, 'status', new.status)
  );
  return new;
end;
$$;

create trigger jobs_log_created
  after insert on public.jobs
  for each row execute function public.log_job_created();

create or replace function public.log_job_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.activity_events (organization_id, customer_id, job_id, event_type, actor_id, data)
    values (
      new.organization_id, new.customer_id, new.id, 'job_status_changed', auth.uid(),
      jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger jobs_log_status_changed
  after update on public.jobs
  for each row execute function public.log_job_status_changed();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.services enable row level security;
alter table public.jobs enable row level security;
alter table public.activity_events enable row level security;

revoke all on public.services, public.jobs, public.activity_events from anon;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
-- activity_events: select only. Rows are written exclusively by the
-- security definer trigger functions above, which run as the function
-- owner and bypass this grant entirely — same pattern as public.profiles.
grant select on public.activity_events to authenticated;

-- ---------- services ----------
-- Every active member can see the catalog (technicians need durations,
-- e.g.); only owners/admins configure it — this is settings-shaped data.
create policy services_select on public.services
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy services_insert on public.services
  for insert to authenticated
  with check (public.is_org_admin(organization_id));

create policy services_update on public.services
  for update to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy services_delete on public.services
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------- jobs ----------
create policy jobs_select on public.jobs
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

-- A technician may update a job assigned to them (status, notes, ...); staff
-- (scheduler and above) may update any job in the organization.
create policy jobs_update on public.jobs
  for update to authenticated
  using (
    public.is_org_scheduler_or_above(organization_id)
    or (assigned_to = auth.uid() and public.is_org_member(organization_id))
  )
  with check (
    public.is_org_scheduler_or_above(organization_id)
    or (assigned_to = auth.uid() and public.is_org_member(organization_id))
  );

create policy jobs_delete on public.jobs
  for delete to authenticated
  using (public.is_org_admin(organization_id));

-- ---------- activity_events ----------
create policy activity_events_select on public.activity_events
  for select to authenticated
  using (public.is_org_member(organization_id));
