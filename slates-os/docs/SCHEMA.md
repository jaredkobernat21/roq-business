# Database schema

Source of truth: [`supabase/migrations/20260824235945_init_core_schema.sql`](../supabase/migrations/20260824235945_init_core_schema.sql). This document explains the shape and intent; the migration is the authoritative definition.

## Entity overview

```
organizations
  └─< organization_members >─ auth.users (1 profile each via profiles)
organizations
  └─< organization_invitations  (pending invites by email, not yet a user)
```

Every table that holds tenant-specific data carries an `organization_id` and is protected by RLS (see [`RLS.md`](./RLS.md)). Any table added in a future phase (customers, jobs, appointments, invoices, files, ...) should follow the same shape:

```sql
create table public.<new_table> (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- ... columns ...
  created_at timestamptz not null default now()
);
create index <new_table>_organization_id_idx on public.<new_table> (organization_id);
alter table public.<new_table> enable row level security;
grant select, insert, update, delete on public.<new_table> to authenticated;

create policy <new_table>_select on public.<new_table>
  for select to authenticated using (public.is_org_member(organization_id));
-- insert/update/delete policies as needed, built on is_org_member / is_org_admin
```

## Tables

### `organizations`

One row per tenant/business.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | required |
| `slug` | text | unique, URL-safe, generated automatically by `create_organization()` |
| `logo_url` | text, nullable | |
| `phone` | text, nullable | |
| `email` | text, nullable | business contact email, distinct from any user's login email |
| `website` | text, nullable | |
| `timezone` | text | IANA identifier, e.g. `America/New_York` |
| `created_at`, `updated_at` | timestamptz | `updated_at` auto-maintained by trigger |

### `profiles`

One row per Supabase auth user (`profiles.id = auth.users.id`). Created automatically by the `handle_new_user()` trigger on `auth.users` insert — the app never inserts into this table directly, only updates it (see the Settings → Account form).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK, FK → `auth.users.id` | |
| `first_name`, `last_name` | text, nullable | seeded from signup form metadata |
| `phone` | text, nullable | |
| `avatar_url` | text, nullable | not yet editable in the UI (no file upload in Phase 1) |
| `created_at`, `updated_at` | timestamptz | |

### `organization_members`

Join table between `auth.users` and `organizations`. A user can belong to more than one organization (the schema supports it); Phase 1's UI only surfaces one at a time (see [`README.md`](../README.md#one-organization-per-user-in-phase-1)).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `organization_id` | uuid, FK → `organizations.id` | |
| `user_id` | uuid, FK → `auth.users.id` | |
| `role` | enum `organization_role` | `owner` \| `admin` \| `scheduler` \| `technician` |
| `status` | enum `member_status` | `active` \| `invited` \| `disabled` |
| `created_at` | timestamptz | |

Unique on `(organization_id, user_id)` — a user has at most one membership row per organization.

Rows are only ever created by two `security definer` functions — `create_organization()` (makes the creator an active owner) and `accept_invitation()` (turns an accepted invite into an active member) — never by a direct client insert. See [`RLS.md`](./RLS.md) for why.

A `before update or delete` trigger (`protect_last_owner`) blocks any change that would leave an organization with zero active owners, regardless of which code path performs the write.

### `organization_invitations`

A pending (or resolved) invitation to join an organization by email, before the invitee necessarily has an account.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `organization_id` | uuid, FK → `organizations.id` | |
| `email` | text | lower-cased on write by app code; validated format at the DB level |
| `role` | enum `organization_role` | role the invitee will get on acceptance |
| `status` | enum `invitation_status` | `pending` \| `accepted` \| `revoked` \| `expired` |
| `token` | uuid | shareable acceptance token; **not currently emailed** — see README |
| `invited_by` | uuid, FK → `auth.users.id` | |
| `created_at`, `accepted_at` | timestamptz | |

Partial unique index enforces at most one `pending` invitation per `(organization_id, email)`.

## Functions (RPCs)

All are `security definer`, scoped internally to `auth.uid()` / `auth.jwt()`, and granted to the `authenticated` role only. Called via `supabase.rpc(...)`.

- **`create_organization(org_name, org_timezone)`** — inserts the organization and an `owner` membership row for the caller in one transaction; generates a unique slug from the name.
- **`accept_invitation(invite_token)`** — validates the token belongs to the caller's own email, then inserts/updates the caller's membership row as `active` and marks the invitation `accepted`.
- **`list_organization_members(target_org_id)`** — returns membership rows joined with `profiles` and `auth.users.email` for organizations the caller belongs to. This is the one sanctioned way to read a teammate's email; `auth.users` is never exposed directly.

## Enums

- `organization_role`: `owner`, `admin`, `scheduler`, `technician` — see [`src/lib/permissions.ts`](../src/lib/permissions.ts) for what each can do, and add new values here (plus the permission helpers) as later phases introduce more granular roles.
- `member_status`: `active`, `invited`, `disabled`.
- `invitation_status`: `pending`, `accepted`, `revoked`, `expired`.

## Regenerating TypeScript types

[`src/lib/database.types.ts`](../src/lib/database.types.ts) is hand-written to match this migration (no Docker/hosted project was available while building Phase 1). Once you have either, regenerate it for real:

```bash
supabase gen types typescript --local > src/lib/database.types.ts
# or
supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
```
