"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageTeam, canModifyMemberRole } from "@/lib/permissions";
import type { OrganizationRole, MemberStatus } from "@/lib/database.types";
import type { FormActionState } from "@/lib/organizations/actions";

export interface MemberActionResult {
  error?: string;
}

export async function updateMemberRoleAction(
  memberId: string,
  currentRole: OrganizationRole,
  newRole: OrganizationRole
): Promise<MemberActionResult> {
  const context = await getCurrentOrgContext();
  if (!context || !canModifyMemberRole(context.role, currentRole) || !canModifyMemberRole(context.role, newRole)) {
    return { error: "You don't have permission to change this member's role." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "That role change isn't allowed." };
  }

  revalidatePath("/team");
  return {};
}

export async function updateMemberStatusAction(
  memberId: string,
  currentRole: OrganizationRole,
  newStatus: MemberStatus
): Promise<MemberActionResult> {
  const context = await getCurrentOrgContext();
  if (!context || !canModifyMemberRole(context.role, currentRole)) {
    return { error: "You don't have permission to update this member." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .update({ status: newStatus })
    .eq("id", memberId)
    .select("id");

  if (error) {
    return { error: error.message };
  }
  if (!data || data.length === 0) {
    return { error: "That change isn't allowed." };
  }

  revalidatePath("/team");
  return {};
}

export async function inviteMemberAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageTeam(context.role)) {
    return { error: "You don't have permission to invite team members." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "technician") as OrganizationRole;

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  if (role === "owner" && context.role !== "owner") {
    return { error: "Only an owner can invite another owner." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Your session expired. Please sign in again." };
  }

  const { error } = await supabase.from("organization_invitations").insert({
    organization_id: context.organization.id,
    email,
    role,
    invited_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "There's already a pending invitation for that email." };
    }
    return { error: error.message };
  }

  // Best-effort: the invitation row is already saved above regardless of
  // whether this send succeeds, so a failure here shouldn't block the
  // owner/admin from seeing "Invitation created" — it just means they'd
  // need to share the invite manually. See send-invite-email's own comment
  // for why this isn't a database webhook.
  const { error: emailError } = await supabase.functions.invoke("send-invite-email", {
    body: { organizationId: context.organization.id, email, role, invitedBy: user.id },
  });
  if (emailError) {
    console.error("send-invite-email failed:", emailError);
  }

  revalidatePath("/team");
  return { success: true };
}

export async function revokeInvitationAction(invitationId: string): Promise<MemberActionResult> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageTeam(context.role)) {
    return { error: "You don't have permission to revoke invitations." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/team");
  return {};
}
