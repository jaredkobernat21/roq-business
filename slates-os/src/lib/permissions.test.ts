import { describe, it, expect } from "vitest";
import {
  canManageOrganizationSettings,
  canManageTeam,
  canInviteMembers,
  canManageOwnerRole,
  canModifyMemberRole,
  assignableRoles,
  canManageCustomers,
  canManageServices,
  canCreateJobs,
  canEditJob,
  canManageInvoices,
  canManagePaymentConnections,
  canManageScheduleBlocks,
} from "./permissions";
import type { OrganizationRole } from "./database.types";

const ALL_ROLES: OrganizationRole[] = ["owner", "admin", "scheduler", "technician"];

describe("admin-tier checks (owner/admin only)", () => {
  const checks = [
    canManageOrganizationSettings,
    canManageTeam,
    canInviteMembers,
    canManageServices,
    canManagePaymentConnections,
  ];

  it.each(checks)("%# is true for owner and admin, false for scheduler and technician", (check) => {
    expect(check("owner")).toBe(true);
    expect(check("admin")).toBe(true);
    expect(check("scheduler")).toBe(false);
    expect(check("technician")).toBe(false);
  });
});

describe("customer-staff-tier checks (owner/admin/scheduler)", () => {
  const checks = [canManageCustomers, canCreateJobs, canManageInvoices, canManageScheduleBlocks];

  it.each(checks)("%# is true through scheduler, false for technician", (check) => {
    expect(check("owner")).toBe(true);
    expect(check("admin")).toBe(true);
    expect(check("scheduler")).toBe(true);
    expect(check("technician")).toBe(false);
  });
});

describe("canManageOwnerRole", () => {
  it("is true only for owner", () => {
    expect(canManageOwnerRole("owner")).toBe(true);
    expect(canManageOwnerRole("admin")).toBe(false);
    expect(canManageOwnerRole("scheduler")).toBe(false);
    expect(canManageOwnerRole("technician")).toBe(false);
  });
});

describe("canModifyMemberRole", () => {
  it("a non-manager (scheduler/technician) can never modify anyone's role", () => {
    expect(canModifyMemberRole("scheduler", "technician")).toBe(false);
    expect(canModifyMemberRole("technician", "technician")).toBe(false);
  });

  it("an admin cannot touch another owner's role", () => {
    expect(canModifyMemberRole("admin", "owner")).toBe(false);
  });

  it("an admin cannot promote someone else to admin (their own tier)", () => {
    expect(canModifyMemberRole("admin", "admin")).toBe(false);
  });

  it("an owner can modify another owner's role", () => {
    expect(canModifyMemberRole("owner", "owner")).toBe(true);
  });

  it("an owner can modify an admin's role", () => {
    expect(canModifyMemberRole("owner", "admin")).toBe(true);
  });

  it("an admin can modify a scheduler or technician's role", () => {
    expect(canModifyMemberRole("admin", "scheduler")).toBe(true);
    expect(canModifyMemberRole("admin", "technician")).toBe(true);
  });
});

describe("assignableRoles", () => {
  it("an owner can assign every role", () => {
    expect(assignableRoles("owner")).toEqual(ALL_ROLES);
  });

  it("an admin can assign every role except owner", () => {
    expect(assignableRoles("admin")).toEqual(["admin", "scheduler", "technician"]);
  });

  it("a scheduler or technician can assign no roles", () => {
    expect(assignableRoles("scheduler")).toEqual([]);
    expect(assignableRoles("technician")).toEqual([]);
  });
});

describe("canEditJob", () => {
  it("staff (owner/admin/scheduler) can edit any job regardless of assignment", () => {
    expect(canEditJob("owner", { assigned_to: "someone-else" }, "me")).toBe(true);
    expect(canEditJob("admin", { assigned_to: null }, "me")).toBe(true);
    expect(canEditJob("scheduler", { assigned_to: "someone-else" }, "me")).toBe(true);
  });

  it("a technician can edit only the job assigned to them", () => {
    expect(canEditJob("technician", { assigned_to: "me" }, "me")).toBe(true);
    expect(canEditJob("technician", { assigned_to: "someone-else" }, "me")).toBe(false);
  });

  it("a technician cannot edit an unassigned job", () => {
    expect(canEditJob("technician", { assigned_to: null }, "me")).toBe(false);
  });

  it("a technician with no known user id cannot edit even a matching-looking job", () => {
    expect(canEditJob("technician", { assigned_to: null }, undefined)).toBe(false);
  });
});
