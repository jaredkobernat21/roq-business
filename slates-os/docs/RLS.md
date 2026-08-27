# Row Level Security approach

This is the security boundary for the whole app. The Next.js app never
filters "which organization's data am I allowed to see" in application
code — every query runs through the signed-in user's Postgres role, and
Postgres itself refuses rows that RLS policies don't allow. Even a bug in
the UI, or someone hand-crafting a request with a different `organization_id`
in it, can't cross the tenant boundary, because the database enforces it
independent of what the client asked for.

Concretely: [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) and
[`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) always use the
Supabase **anon key** plus the user's session — never the service role key.
There is no service-role client anywhere in this app. If a later phase adds
one (e.g. for a background job), treat it as a loaded weapon: it bypasses
RLS entirely.

## The recursion problem, and how it's avoided

The obvious first policy for `organization_members` is something like:

```sql
-- Don't do this — infinite recursion
using (
  exists (select 1 from organization_members m where m.organization_id = organization_id and m.user_id = auth.uid())
)
```

This references `organization_members` from within `organization_members`'s
own RLS policy, which recurses. The fix used throughout this schema:
`security definer` helper functions that query the table with the
function owner's privileges (bypassing RLS for that one, narrow read),
and only ever answer a yes/no or role question scoped to `auth.uid()`:

- `is_org_member(org_id)` — active membership check. **Use this for any new
  tenant table's SELECT policy.**
- `is_org_admin(org_id)` — active owner or admin.
- `get_org_role(org_id)` — the caller's role, or null.
- `is_org_member_any_status(org_id)` — membership regardless of status (used
  so a disabled/invited user can still see which org they belong to).
- `shares_org_with(user_id)` — whether the caller and another user share an
  active organization (used so teammates can see each other's `profiles`
  row without exposing every profile on the platform).

None of these accept a caller-supplied *acting* user id — they're always
scoped to `auth.uid()` — so they can't be used to probe someone else's
membership. **When you add a new table, build its policies on these
functions rather than writing a fresh `exists (select ...)` against
`organization_members`.**

## Why some operations are RPCs instead of policies

Two things don't fit a simple per-table policy:

1. **Atomic multi-table writes.** Creating an organization must also create
   its owner membership row, in the same transaction, or you can end up
   with an organization that has no owner. `create_organization()` and
   `accept_invitation()` are `security definer` functions that do both
   writes together. Because of this, `organizations` and
   `organization_members` have **no INSERT grant** for the `authenticated`
   role at all — the only way a row can be created is through one of these
   functions. If you're tempted to add a client-facing insert policy to
   either table, stop and ask whether it should go through an RPC instead.

2. **Cross-schema reads.** `auth.users` (email, etc.) isn't exposed via the
   REST API and has no RLS policies of its own to write. Reading a
   teammate's email is done through `list_organization_members()`, a
   `security definer` function that internally re-checks `is_org_member`
   before returning anything. Never add a policy or view that exposes
   `auth.users` more broadly than this.

## The last-owner invariant

"An organization must always have at least one active owner" isn't
expressible as a clean row-level `USING`/`WITH CHECK` clause (it requires
counting sibling rows). It's enforced instead by a `before update or delete`
trigger (`protect_last_owner`) directly on `organization_members`. This
means the rule holds no matter which code path performs the write — the
app's UI, a direct Supabase client call, a future admin script — because
it's enforced by Postgres itself, not by the Next.js server actions calling
it.

## Role hierarchy in `organization_members` UPDATE

The policy that lets an owner/admin edit a member row also stops an admin
from touching an owner's row or granting the owner role to anyone:

```sql
using (
  is_org_admin(organization_id)
  and (role <> 'owner' or get_org_role(organization_id) = 'owner')
)
with check (
  is_org_admin(organization_id)
  and (role <> 'owner' or get_org_role(organization_id) = 'owner')
)
```

`USING` gates which existing rows are even visible to the UPDATE (an admin
can't target a row that's currently `owner` unless they themselves are
owner). `WITH CHECK` gates what the row is allowed to become (nobody but an
owner can write `role = 'owner'`). Combined with the trigger above, this is
enough to fully enforce the team-management rules from the product spec at
the database level — the app-layer checks in
[`src/lib/permissions.ts`](../src/lib/permissions.ts) and the Server Actions
in `src/lib/organizations/members-actions.ts` exist for fast UI feedback,
not as the actual security boundary.

## Testing tenant isolation

An automated pgTAP suite lives at `supabase/tests/*_test.sql` and runs on
every push/PR that touches this directory, via
`../.github/workflows/database-tests.yml` — that workflow file has to live
at the repo root (this directory's parent), not here, because GitHub
Actions only discovers workflows at the true repo root; the repo root
itself is the separate slatesweb.com static site, with this Next.js/Supabase
project as a subdirectory. No secrets needed — it runs entirely against an
ephemeral container Postgres GitHub's runner provides, never either of the
live hosted Supabase projects. Run it yourself with:

```bash
supabase db start   # or `supabase start` if that turns out not to be enough
supabase test db
```

Each file targets one specific security property rather than testing every
table's policy exhaustively:

| File | Covers |
|---|---|
| `010_helper_functions_recursion_safety` | The security-definer helper functions (`is_org_member`, `is_org_admin`, `is_org_member_any_status`, `is_org_scheduler_or_above`, `get_org_role`, `shares_org_with`) return correct answers per role/status, and querying `organization_members` under RLS doesn't recurse. |
| `020_organization_members_role_hierarchy` | The `organization_members_update` owner-protection logic: admin can edit non-owner rows, cannot touch an owner row, cannot grant the owner role; owner can do both. |
| `030_protect_last_owner_trigger` | Demoting/disabling/deleting the sole active owner raises `P0001`; the same op succeeds with a second active owner. |
| `040_cross_tenant_isolation_core` | The core boundary, swept across `organizations`/`organization_members`/`customers`/`jobs`/`invoices`: a member of org A gets zero rows reaching for org B's data by id — never an error that leaks whether the row exists. |
| `050_jobs_update_technician_boundary` | The one place app-layer (`canEditJob()` in `src/lib/permissions.ts`) and DB-layer logic must agree: a technician can update only their assigned job; staff can update any job in-org. |

**Deliberately not covered yet**, same policy shape as what's already tested above so a dedicated file would prove the pattern again against a different table name rather than a new mechanism — extend `040_cross_tenant_isolation_core` if one of these needs a regression test, don't add a near-duplicate file: `payment_connections`/`invoice_items` detail policies, `business_hours`/`schedule_blocks`/`services` as standalone files, the booking RPCs, customer CSV import, and the `organization_invitations` `auth.jwt() ->> 'email'` clause specifically.

**As a sanity check against a real hosted project post-deploy** (pgTAP never exercises PostgREST/GoTrue/the anon-key path a browser actually uses, so this is still worth doing once, manually, after a schema change that touches RLS): sign up two accounts, each creating their own organization; from the app (not the SQL editor) sign in as user A and confirm `/team`/`/settings` only ever show organization A's data; then, in the browser console while signed in as user A, call `supabase.from('organizations').select('*').eq('id', '<org B id>')` or `.update({...}).eq('id', '<org B id>')` — both should return zero rows / no-op, never organization B's data or an error that leaks whether the row exists.
