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
