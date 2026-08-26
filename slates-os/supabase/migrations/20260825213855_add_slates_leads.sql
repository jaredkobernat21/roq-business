-- SLATES marketing site lead capture (migrated from the shared "roq"
-- Supabase project, where it lived alongside two unrelated products).
--
-- Unlike the old setup, the contact form does NOT insert into this table
-- directly with the anon key. Instead, the browser calls the
-- `submit-lead` Edge Function, which inserts using its own service-role
-- client (see supabase/functions/submit-lead) and sends the notification
-- email in the same request. That's why this table has RLS enabled with
-- *no* policies at all: nothing should be able to read or write it via the
-- public REST API, only the Edge Function's service-role connection, which
-- bypasses RLS entirely. This also avoids the old design's dependency on a
-- database trigger with a long-lived service_role token hardcoded directly
-- in the trigger definition (a real secret-exposure risk — anyone able to
-- read pg_trigger/pg_catalog, e.g. via the SQL editor or a schema dump,
-- could read that key in plaintext).
create table public.slates_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  business text not null,
  what_you_do text not null,
  current_website text,
  email text not null,
  phone text,
  notes text
);

alter table public.slates_leads enable row level security;
revoke all on public.slates_leads from anon, authenticated;
