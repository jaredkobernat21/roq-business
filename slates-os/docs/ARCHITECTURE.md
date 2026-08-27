# Architecture: building for one business mode, designing for several

ROQ OS is the core product across every mode it will eventually serve, not
just the current one. **Phase 1** ships two modes: **Service Business**
(duct cleaning, detailing, landscaping, HVAC, plumbing, ...) — what's
actually being built right now — and **Home** (homeowners), sequenced
*after* Service Business is production-ready rather than in parallel.
**Phase 2** adds further modes: nonprofit, investor, restaurant/hospitality,
software/SaaS, professional services, and eventually custom configurations.
**None of the Phase 2 modes, and no Home-mode-specific code, is being built
yet.** This document exists so that when they are, it doesn't require
tearing up the core system — it records the decisions made *now*, while
building the Service Business version, that keep that door open.

If you're implementing a later phase (or Home mode) and it's not obvious
whether something belongs in the shared core or in service-business-specific
code, read this first.

One naming consequence of this worth calling out: the three universal
top-nav tabs (`src/components/app-shell/pill-tabs.tsx`, `src/lib/nav.ts`)
are labeled **Now / Profile / Work**, not **Home / Presence / Work** —
because "Home" is reserved for the Home *mode* itself, and a tab called
"Home" sitting inside Home mode would be confusing. The internal label keys
(`src/lib/labels.ts`) stay `home`/`presence`/`work`; only the Service
Business-mode display strings changed. See the doc comment on `LABELS` in
`labels.ts`.

## The shared core

These stay generic across every business mode and never get mode-specific
columns, tables, or logic bolted onto them:

- **Customers/contacts** — whoever the business serves. A service business
  calls them customers; hospitality might call them guests; a nonprofit
  might call them donors. One underlying concept, many display labels.
- **Workflows** — the stages something moves through (a job, a
  reservation, a subscription, a campaign).
- **Scheduling** — anything with a time component: appointments,
  reservations, shifts.
- **Payments** — collecting money, regardless of what it's for.
- **Accounting integrations** — QuickBooks etc., a later phase.
- **Users, roles, and organizations** — already built (Phase 1). This part
  is mode-agnostic today: `organizations` has no notion of "business
  type," and `organization_members`/roles aren't service-business-specific
  in their *shape* (they will need service-business-specific *permission
  logic* per role, which is fine — see below).
- **Tasks** — to-dos, whatever they're attached to.
- **Communication** — messaging/notifications to customers and team.
- **Reporting** — dashboards and analytics over the above.
- **Automation** — triggered workflows over the above.

## The pattern: generic underlying concept, mode-specific label

When a later phase adds one of these shared entities (customers, jobs,
etc.), the rule is:

1. **The database table, column names, and code identifiers stay generic
   and stable.** A table is `customers`, a status enum value is
   `in_progress`, an API is `getCustomer()` — never `getGuest()` or
   `getDonor()`, even once hospitality mode exists. Renaming the underlying
   name every time a new mode ships would mean rebuilding the core for
   every mode, which is exactly what this document exists to avoid.
2. **What the user sees is a label, resolved through the organization's
   business mode**, not hardcoded English strings scattered through
   components. Concretely, this means a lookup like
   `getLabel(organization.business_mode, 'customer')` → `"Customer"` (service
   business) or `"Guest"` (hospitality) or `"Donor"` (nonprofit), used
   everywhere the UI would otherwise write "Customer" literally — nav
   items, page titles, form labels, empty states.
3. **Mode determines defaults, not capabilities.** Which nav items show,
   which workflow stages are pre-populated, which dashboard cards
   appear — all of that can read from the organization's mode. The
   underlying tables/APIs that make those things *possible* don't change
   per mode; only the configuration of what's shown and what it's called
   does.

This isn't built yet because there's only one mode (service business) and
one set of labels, so there's nothing to switch between. But *phase 2+
work should introduce the mode-and-label layer at the same time it
introduces the entity*, rather than hardcoding "Customer" as a literal
string in twenty places and coming back to fix it later. A `business_mode`
column on `organizations` (nullable/defaulted to `'service_business'` for
now) plus a small label-lookup table or config object is enough — this does
not require a generic EAV schema, a plugin system, or anything elaborate.
Avoid overbuilding this too: one enum column and one lookup table/object is
the right amount of abstraction for "not yet, but soon," not a
configuration engine.

## What's already fine, and why

- `organizations`, `profiles`, `organization_members`,
  `organization_invitations` (Phase 1): no changes needed. None of these
  are service-business-specific — a restaurant or nonprofit organization
  looks exactly the same at this layer.
- `organization_role` enum (`owner`, `admin`, `scheduler`, `technician`):
  the two operational roles (`scheduler`, `technician`) are named for the
  service-business mode, since that's the only mode being built. When a
  second mode ships, decide then whether that mode needs new enum values
  (Postgres enums support `ALTER TYPE ... ADD VALUE`) or whether roles
  should become organization-mode-aware labels over a smaller set of
  generic permission tiers — don't pre-build that decision now, there's
  only one mode's worth of information to make it well.
- `src/lib/nav.ts` now holds just the three universal top-nav tabs
  (`TOP_NAV`: Now/Profile/Work) — Customers/Jobs/Schedule/Invoices/Team are
  real features, reached as "View all" links from the Work dashboard
  (`src/app/(app)/work/page.tsx`) rather than as their own nav items.
  Settings is reached from the account menu. All of `home`/`presence`/
  `work`/`customer`/`job`/etc. already resolve through `getLabel()` — the
  label-lookup layer described above is in place, not deferred.

## Explicitly out of scope right now

Do not build, in this phase or speculatively "for later": a business-mode
switcher UI, a label/terminology configuration system, additional
`organization_role` values for other modes, mode-specific dashboards, or
any other-mode data model. The instruction driving this document is to
*avoid closing off* that future work, not to start it.
