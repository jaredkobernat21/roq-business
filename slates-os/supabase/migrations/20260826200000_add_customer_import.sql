-- =============================================================================
-- SLATES OS — Phase 2A-3: customer CSV import
-- =============================================================================
-- import_jobs / import_rows track a single CSV import run. raw_data is kept
-- on every row (imported or not) per the Phase 2 spec — "preserve the
-- original imported data where reasonable so migration problems can be
-- debugged" — so a business's own export stays inspectable after the fact,
-- independent of whatever ended up in `customers`.
--
-- Deliberately generic (filename + column_mapping jsonb + raw_data jsonb)
-- rather than CSV-specific, so a later phase can add dedicated adapters for
-- Jobber/Housecall Pro/etc. (per the Phase 2 spec) that populate the same
-- two tables instead of inventing parallel ones.
-- =============================================================================

create type public.import_status as enum ('processing', 'completed', 'failed');
create type public.import_row_status as enum ('imported', 'duplicate', 'error');

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filename text not null,
  column_mapping jsonb not null default '{}',
  status public.import_status not null default 'processing',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  error_rows integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index import_jobs_organization_id_idx on public.import_jobs (organization_id);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  status public.import_row_status not null,
  error_message text,
  customer_id uuid references public.customers(id) on delete set null,
  created_at timestamptz not null default now()
);

create index import_rows_import_job_id_idx on public.import_rows (import_job_id);
create index import_rows_organization_id_idx on public.import_rows (organization_id);

-- Same denormalization-consistency problem as customer_addresses/jobs: keep
-- import_rows.organization_id honest against its parent import_job (and
-- customer_id, if set, against the same organization).
create or replace function public.import_rows_check_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_org uuid;
  cust_org uuid;
begin
  select organization_id into job_org from public.import_jobs where id = new.import_job_id;
  if job_org is null or job_org <> new.organization_id then
    raise exception 'import_rows.organization_id must match its import_job''s organization';
  end if;

  if new.customer_id is not null then
    select organization_id into cust_org from public.customers where id = new.customer_id;
    if cust_org is null or cust_org <> new.organization_id then
      raise exception 'import_rows.customer_id must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger import_rows_enforce_org
  before insert or update on public.import_rows
  for each row execute function public.import_rows_check_org();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.import_jobs enable row level security;
alter table public.import_rows enable row level security;

revoke all on public.import_jobs, public.import_rows from anon;
grant select, insert, update on public.import_jobs to authenticated;
grant select, insert on public.import_rows to authenticated;

create policy import_jobs_select on public.import_jobs
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy import_jobs_insert on public.import_jobs
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));

create policy import_jobs_update on public.import_jobs
  for update to authenticated
  using (public.is_org_scheduler_or_above(organization_id))
  with check (public.is_org_scheduler_or_above(organization_id));

create policy import_rows_select on public.import_rows
  for select to authenticated
  using (public.is_org_member(organization_id));

create policy import_rows_insert on public.import_rows
  for insert to authenticated
  with check (public.is_org_scheduler_or_above(organization_id));
