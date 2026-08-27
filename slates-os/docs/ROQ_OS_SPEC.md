# ROQ OS: product vocabulary & long-term plan

This is the vocabulary layer: what ROQ OS is, the handful of core concepts
everything else is built from, and the phase plan for which Modes exist
when. `docs/ARCHITECTURE.md` is the *technical* pattern for how a generic
core adapts per Mode (shared tables, `getLabel()`, etc.) — read that for
implementation rules. Read this one first for what the words mean and
where the product is headed.

## Core vocabulary

- **ROQ** — the brand. Everything ROQ ships lives under this name.
- **ROQ OS** — the system itself: the operating system for whatever Space
  someone runs. This codebase.
- **Account** — the person signed in. Maps to `auth.users` + `profiles`.
- **Space** — what an Account owns or runs: a business, a household, a
  portfolio, a nonprofit, a piece of software. Maps to `organizations` in
  the schema today. (The table is intentionally still called
  `organizations`, not `spaces` — see the naming rule in
  `docs/ARCHITECTURE.md`: code identifiers stay stable and generic, and
  renaming one every time the product vocabulary evolves would mean
  rebuilding the core each time. If "Space" should ever become a literal
  code identifier, that's a deliberate decision to make on its own, not a
  side effect of writing this document.)
- **Mode** — how ROQ OS adapts its behavior, labels, and tools to a given
  Space. Maps to `organizations.business_mode`.
- **Universal navigation** — the three top-level tabs present in every
  Mode: **Now**, **Profile**, **Work**.

## The three universal tabs, conceptually

Every Mode gets the same three tabs; what fills them is what actually
changes per Mode.

- **Now** (internal key: `home`) — situational awareness. What needs this
  Account's attention in this Space, today.
- **Profile** (internal key: `presence`) — the Space's own identity: how it
  presents itself, to itself and to the outside world.
- **Work** (internal key: `work`) — the operational hub. Everything needed
  to actually run the Space day to day.

A homeowner's Work tab and a plumbing business's Work tab will look
nothing alike, but both are "the tools for running this Space" — same
concept, Mode-specific content. This is the same generic-core /
mode-specific-label pattern documented in `docs/ARCHITECTURE.md`, applied
one level up (to navigation itself, not just to entities like
customers/jobs).

## Phase plan

- **Phase 1a (current work)** — Service Business Mode. Space = a service
  business (plumbing, HVAC, landscaping, detailing, ...). Everything being
  built right now targets this Mode.
- **Phase 1b (after 1a ships)** — Home Mode. Space = a household/home an
  Account owns. Sequenced *after* Service Business is production-ready,
  not in parallel with it.
- **Phase 2+** — additional Modes, added as needed once 1a and 1b are
  solid: nonprofit (Space = the organization), investor (Space = a
  portfolio), restaurant/hospitality, software/SaaS, professional
  services, and eventually custom configurations.

None of the Phase 1b or Phase 2 Modes are being built yet. Per
`docs/ARCHITECTURE.md`'s explicit scope rule: don't pre-build a Mode
switcher, Home-Mode-specific schema, or other-Mode dashboards speculatively
— the job right now is to keep the door open, not to walk through it early.

## Where this shows up in code today

- `organizations.business_mode` is the live Mode switch (see
  `docs/SCHEMA.md`).
- `getLabel(mode, key)` in `src/lib/labels.ts` turns a generic key into
  Mode-appropriate display text — e.g. the `home` key currently resolves
  to "Now" for Service Business Mode. See the doc comment on `LABELS`
  there for why the tab isn't literally labeled "Home" (it would collide
  with Home Mode itself once that exists).
- `src/components/app-shell/pill-tabs.tsx` renders the three universal
  tabs; `src/lib/nav.ts`'s `TOP_NAV` is the source of which three they are.

## Deferred work

Standing list of things that are known, decided, and *not* done. Each was
deferred on purpose — none of these is an oversight, and none should be
started speculatively. Last reviewed 2026-08-27.

### Waiting on a real customer

Feature work paused until a first customer is signed. The reasoning: an
integration designed against a hypothetical customer is usually designed
wrong, and the schema seam already exists to add one later cheaply.

- **Stripe production setup.** The integration is built and works in test
  mode. Going live needs live API keys, a `STRIPE_CONNECT_CLIENT_ID`, and an
  approved Connect application — all account-level decisions. The Connect
  handshake and webhook were hardened separately and are not blocking.
- **A second payment processor** (Square, PayPal, whatever customers ask
  for). `payment_connections` is keyed on `(organization_id, provider)` and
  `payment_provider` is an enum, so a second processor is an enum value plus
  a provider module — not a schema rewrite. What is currently Stripe-shaped:
  `get_invoice_stripe_account`, `checkout.ts`'s direct SDK calls, the
  `/api/stripe/*` routes, and the single hardcoded card in the integrations
  UI. Generalize when there is a second real example to generalize *against*.
- **QuickBooks.** Currently a "Coming soon" badge with nothing behind it.
  Note this is a different axis from payments — accounting sync via Intuit
  OAuth — and wants its own table rather than a `payment_connections` row.

### Invoice email

**Sending an invoice does not email anyone.** `markInvoiceSentAction` flips
`status` to `sent` and stamps `sent_at`; the business is expected to copy the
public `/invoice/[id]` link and send it themselves. This is the largest gap
for anyone testing the app as a real workflow.

Building it is well-supported: Resend is already the provider, and
`supabase/functions/send-invite-email` is a working pattern to copy —
including that it is invoked directly from a Server Action rather than via a
DB webhook, because this project has neither `pg_net` nor the
`supabase_functions` schema enabled. See `docs/EMAIL.md`.

Related and smaller: six of the nine Auth email templates are still plain
unstyled HTML living only in the dashboard, unversioned and visually
inconsistent with the two that were brought into `supabase/templates/`.

### Naming and infrastructure renames

The app's user-facing branding is fully ROQ OS. What remains are *container*
names, deferred because they are account/filesystem changes rather than code:

- **The organization named "SLATES" in the live database.** This is data, not
  code, and it is the most visible remaining one — it appears in team invite
  emails ("You've been invited to join SLATES on ROQ OS"). Renameable in
  Settings, no deploy required. Do this one first.
- **GitHub repo `roq-business`** → `roq-os`. Low risk; GitHub redirects the
  old URL, and the local remote needs updating afterward.
- **Supabase project display name**, still literally "slates-os". Dashboard
  label only — the project ref and every connection string are unaffected.
- **Local folder `slates-os/`** → `roq-os/`. Carries a trap: Vercel's project
  Root Directory setting points at this path, so the rename and that setting
  have to move together or deploys break.

**`/Users/jaredkobernat/Desktop/SLATES/` itself should keep its name.** That
folder is the git repo root *and* the source of the separate, still-deployed
slatesweb.com static site. The name is accurate, and renaming it would imply
that site is a ROQ property when it isn't.

Likewise not stale branding, despite the name: the `slates_leads` table and
the `submit-lead` Edge Function are live infrastructure for that same
marketing site, and `config.toml`'s `app.slatesweb.com` redirect URLs are
kept intentionally so already-sent auth email links keep resolving during the
domain transition. Comments inside already-applied migrations are left alone
because editing them risks a checksum mismatch against the live project for
no functional gain.
