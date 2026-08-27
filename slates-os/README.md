# ROQ OS

The reusable multi-tenant operating system for local service businesses
(duct cleaning, detailing, landscaping, HVAC, plumbing, and similar
owner-operated businesses). This is **Phase 1**: authentication,
organizations, membership, roles, multi-tenant data isolation, and a basic
authenticated app shell. Customers, jobs, scheduling, invoicing, payments,
and QuickBooks are later phases — see the bottom of this file for what's
intentionally *not* here yet.

Duct Wrangler is the first real customer and the seed/demo organization
(see `supabase/seed.sql`), but nothing in the reusable code is specific to
it — any business can sign up and use the same codebase.

Stack: Next.js (App Router) · TypeScript · Supabase (Postgres, Auth, RLS) ·
Tailwind CSS. No state-management library, ORM, or UI kit — deliberately
kept minimal.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Connect Supabase

You need either a **local** Supabase instance (requires Docker Desktop) or
a **hosted** project at [supabase.com](https://supabase.com).

**Local:**

```bash
supabase start        # prints your local URL + anon key
supabase db reset     # applies supabase/migrations/*.sql and supabase/seed.sql
```

**Hosted:** create a project, then in the Supabase Dashboard's SQL Editor
run the contents of
[`supabase/migrations/20260824235945_init_core_schema.sql`](supabase/migrations/20260824235945_init_core_schema.sql)
(skip `supabase/seed.sql` in production — it creates a password-based demo
user, which is a local-dev convenience only). Or, with the CLI linked to
your project: `supabase db push`.

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
`supabase start`'s output (local) or Project Settings → API (hosted). See
[`.env.local.example`](.env.local.example) for the full list and what each
value is for.

### 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`. If you ran `supabase db reset` with the seed
file, you can sign in immediately with the demo account:
**`owner@ductwrangler.test` / `password123`** (owner of the seeded "Duct
Wrangler" organization). Otherwise, sign up to create a new account and
business from scratch.

### Checks

```bash
npx tsc --noEmit   # type check
npm run lint       # eslint
npm run build      # full production build (also type-checks)
npm test           # Vitest unit tests (pure logic — no database needed)
```

All four currently pass clean. There's also an automated RLS/tenant-isolation
suite (`supabase test db`, needs Docker) that runs in CI on every push — see
[`docs/RLS.md`](docs/RLS.md#testing-tenant-isolation).

## How auth + onboarding fits together

1. `/signup` creates the Supabase auth user (first/last name go into
   `auth.users.raw_user_meta_data`); a database trigger
   (`handle_new_user`) creates the matching `profiles` row automatically.
2. If your Supabase project requires email confirmation (the default), the
   user is told to check their email; the confirmation link lands on
   `/auth/callback`, which exchanges the code for a session and redirects
   in. If confirmation is disabled, `signUp` returns a session immediately
   and the user goes straight to `/onboarding/organization`.
3. `/onboarding/organization` is shown to any signed-in user who doesn't
   yet belong to an organization. They either create one (becoming its
   `owner` via the `create_organization` RPC) or accept a pending
   invitation addressed to their email.
4. Once a user has an active membership, `(app)/layout.tsx` renders the
   real app shell (sidebar on desktop, bottom nav on mobile) for
   `/home`, `/team`, `/settings`, and the "coming soon" module
   placeholders (`/customers`, `/jobs`, `/schedule`).
5. Forgot/reset password: `/forgot-password` triggers
   `resetPasswordForEmail`, which emails a link to `/auth/callback` →
   `/reset-password`.

Route protection is enforced in [`src/proxy.ts`](src/proxy.ts) (Next.js
16 renamed `middleware.ts` to `proxy.ts`) — it redirects signed-out users
away from the app and signed-in users away from the auth pages. This is a
UX convenience, **not** the security boundary; see
[`docs/RLS.md`](docs/RLS.md) for the actual one.

## One organization per user (Phase 1)

The schema supports a user belonging to multiple organizations
(`organization_members` is a proper many-to-many join table with no
uniqueness constraint beyond one row per `(org, user)` pair). The Phase 1
UI, however, only ever shows one — `getCurrentOrgContext()` in
[`src/lib/session.ts`](src/lib/session.ts) picks the earliest-created active
membership. This matches the target users (owner-operators who run one
business), and an organization switcher can be added later without any
schema change.

## What's implemented vs. what remains for invitations

The **database and UI for team invitations are fully implemented**: an
owner/admin can create an invitation (`organization_invitations` row with a
unique `token`), see it listed as pending, revoke it, and — once the
invitee signs in with a matching email — accept it via the
`accept_invitation` RPC, which turns it into a real membership.

**What's not implemented: actually emailing the invitation link.** Nothing
sends `https://your-app/onboarding/organization?token=...`-style email to
the invitee. To finish this, pick one of:

- **Supabase's built-in email** (simplest): call
  `supabase.auth.admin.inviteUserByEmail()` from a server-side context
  using the **service role key** (never expose it to the client) after
  creating the invitation row, or configure a Postgres webhook/Edge
  Function that fires on `organization_invitations` insert.
- **A transactional email provider** (Resend, Postmark, SendGrid): in
  `inviteMemberAction`
  ([`src/lib/organizations/members-actions.ts`](src/lib/organizations/members-actions.ts)),
  after the insert succeeds, send an email containing a link to
  `/onboarding/organization` (the accept flow already reads pending
  invitations for the signed-in user's email and offers an "Accept"
  button — see `getPendingInvitations` in `src/lib/session.ts`).

Until then, share the invite by copying the invitee's email + telling them
to sign up with that exact address — their pending invitation will show up
automatically on `/onboarding/organization` once they do.

## Environment variables

See [`.env.local.example`](.env.local.example) for the authoritative list
with inline comments. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/public key (RLS-restricted; safe to expose) |
| `NEXT_PUBLIC_SITE_URL` | yes | Used to build email redirect links (password reset, signup confirmation) |

No service role key is used anywhere in this app — see
[`docs/RLS.md`](docs/RLS.md) for why that matters.

## Deploying

This app is Vercel-ready as-is (`npm run build` / `npm start`, standard
Next.js output — no custom server). Point Vercel at the `slates-os`
subdirectory as the project root (this repo also contains the separate
`slatesweb.com` marketing site at the repository root, which deploys
independently). Set the three environment variables above in the Vercel
project settings, pointing at your hosted Supabase project, and add your
Vercel deployment URL to Supabase Auth → URL Configuration (Site URL +
Redirect URLs) so email links resolve correctly.

## Vision, architecture, schema & RLS

- [`docs/ROQ_OS_SPEC.md`](docs/ROQ_OS_SPEC.md) — **read this first.** The
  product vocabulary (ROQ, ROQ OS, Account, Space, Mode, the Now/Profile/
  Work universal navigation) and the Phase 1/Phase 2 Mode plan.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — **read this before
  building Phase 2+.** The technical pattern behind the vocabulary above:
  what stays generic in code (customers, workflows, scheduling, payments,
  ...) and the generic-concept/mode-specific-label pattern to use when a
  shared entity gets built.
- [`docs/SCHEMA.md`](docs/SCHEMA.md) — tables, columns, functions, and the
  pattern to follow when adding a new tenant-scoped table in a later phase.
- [`docs/RLS.md`](docs/RLS.md) — the security model: how tenant isolation
  is enforced, the recursion problem and how it's avoided, why some
  operations are RPCs instead of table policies, and how to test isolation
  once you have a database to test against.
- [`docs/EMAIL.md`](docs/EMAIL.md) — how mail is sent: the two independent
  paths (Supabase Auth over Resend SMTP vs. the app calling Resend's API
  directly), where the API key lives for each, and how to push an SMTP
  config change without committing a secret.

## Explicitly not in Phase 1

Customers, leads, jobs, scheduling/booking, photos/files, invoices,
payments, QuickBooks, payment processors, automated reminders, review
requests, reporting. The placeholder nav items and "Coming soon" screens
for Customers/Jobs/Schedule exist so the shell doesn't need restructuring
when these land.
