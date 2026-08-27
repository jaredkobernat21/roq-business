import type { BusinessMode } from "@/lib/database.types";

/**
 * Resolves what the user sees for a shared-core concept (customer, job, ...)
 * based on the organization's business mode, instead of hardcoding English
 * strings through nav items, page titles, and form labels. See
 * docs/ARCHITECTURE.md — only one mode exists today, so every key currently
 * resolves the same way, but new shared-core UI copy should go through this
 * rather than writing the literal string.
 *
 * The `home`/`presence`/`work` keys back the three universal top-nav tabs
 * (see components/app-shell/pill-tabs.tsx) — they resolve to "Now"/
 * "Profile"/"Work" rather than "Home"/"Presence"/"Work" because ROQ OS's
 * planned Home mode (Phase 1, for homeowners, after Service Business mode
 * ships) is itself called "Home" — the tab label had to stop overloading
 * that word. The internal key names stay "home"/"presence" since they're
 * just identifiers, not display text; see docs/ARCHITECTURE.md.
 */

type LabelKey =
  | "home"
  | "presence"
  | "work"
  | "customer"
  | "customers"
  | "job"
  | "jobs"
  | "schedule"
  | "invoice"
  | "invoices"
  | "team"
  | "settings";

const LABELS: Record<BusinessMode, Record<LabelKey, string>> = {
  service_business: {
    home: "Now",
    presence: "Profile",
    work: "Work",
    customer: "Customer",
    customers: "Customers",
    job: "Job",
    jobs: "Jobs",
    schedule: "Schedule",
    invoice: "Invoice",
    invoices: "Invoices",
    team: "Team",
    settings: "Settings",
  },
};

export function getLabel(mode: BusinessMode, key: LabelKey): string {
  return LABELS[mode]?.[key] ?? LABELS.service_business[key];
}

export type { LabelKey };
