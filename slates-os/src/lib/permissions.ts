import type { OrganizationRole } from "@/lib/database.types";

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
