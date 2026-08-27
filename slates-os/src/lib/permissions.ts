import type { CustomerStatus, InvoiceStatus, JobStatus, OrganizationRole } from "@/lib/database.types";

/**
 * Central place for "can this role do X" checks. Components and Server
 * Actions should call these helpers instead of comparing role strings
 * directly, so permission rules stay in one place as new roles/actions are
 * added in later phases.
 *
 * This is a UI/UX convenience layer only — it decides what to render and
 * gives fast feedback. It is never the actual security boundary; every
 * mutation is independently enforced by RLS policies and, where relevant,
 * database triggers (see supabase/migrations and docs/RLS.md). Never add a
 * capability here without a matching database-level check.
 */

const ADMIN_ROLES: OrganizationRole[] = ["owner", "admin"];

export function canManageOrganizationSettings(role: OrganizationRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageTeam(role: OrganizationRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canInviteMembers(role: OrganizationRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Only an owner may grant the owner role or modify another owner's row. */
export function canManageOwnerRole(role: OrganizationRole): boolean {
  return role === "owner";
}

export function canModifyMemberRole(
  actingRole: OrganizationRole,
  targetRole: OrganizationRole
): boolean {
  if (!canManageTeam(actingRole)) return false;
  if (targetRole === "owner" || targetRole === actingRole) {
    return actingRole === "owner";
  }
  return true;
}

export function assignableRoles(actingRole: OrganizationRole): OrganizationRole[] {
  const all: OrganizationRole[] = ["owner", "admin", "scheduler", "technician"];
  if (actingRole === "owner") return all;
  if (actingRole === "admin") return all.filter((role) => role !== "owner");
  return [];
}

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner: "Owner",
  admin: "Admin",
  scheduler: "Scheduler",
  technician: "Technician",
};

export const ROLE_DESCRIPTIONS: Record<OrganizationRole, string> = {
  owner: "Full access to the organization, billing, and team.",
  admin: "Can manage the team and business settings.",
  scheduler: "Will manage customers, jobs, and scheduling.",
  technician: "Will see and update their assigned jobs.",
};

const CUSTOMER_STAFF_ROLES: OrganizationRole[] = ["owner", "admin", "scheduler"];

/** Owner/admin/scheduler manage the customer book; technicians only view it. */
export function canManageCustomers(role: OrganizationRole): boolean {
  return CUSTOMER_STAFF_ROLES.includes(role);
}

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  lead: "Lead",
  customer: "Customer",
};

/** Owner/admin configure the service catalog — settings-shaped data. */
export function canManageServices(role: OrganizationRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Owner/admin/scheduler create jobs; technicians only work the ones assigned to them. */
export function canCreateJobs(role: OrganizationRole): boolean {
  return CUSTOMER_STAFF_ROLES.includes(role);
}

/** Mirrors the jobs_update RLS policy: staff, or the technician assigned to this job. */
export function canEditJob(
  role: OrganizationRole,
  job: { assigned_to: string | null },
  userId: string | undefined
): boolean {
  if (CUSTOMER_STAFF_ROLES.includes(role)) return true;
  return job.assigned_to !== null && job.assigned_to === userId;
}

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  lead: "Lead",
  estimate: "Estimate",
  approved: "Approved",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const JOB_STATUSES: JobStatus[] = [
  "lead",
  "estimate",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

/** Owner/admin configure business hours — same tier as services and business info. */
export function canManageBusinessHours(role: OrganizationRole): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Owner/admin/scheduler create and manage invoices. */
export function canManageInvoices(role: OrganizationRole): boolean {
  return CUSTOMER_STAFF_ROLES.includes(role);
}

/** Owner/admin only — connecting a payment processor is financial-account-tier. */
export function canManagePaymentConnections(role: OrganizationRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

/** Owner/admin/scheduler can block time on the schedule. */
export function canManageScheduleBlocks(role: OrganizationRole): boolean {
  return CUSTOMER_STAFF_ROLES.includes(role);
}
