import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database, MemberStatus, OrganizationRole } from "@/lib/database.types";

type Organization = Database["public"]["Tables"]["organizations"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface OrgContext {
  organization: Organization;
  membershipId: string;
  role: OrganizationRole;
  status: MemberStatus;
}

export interface PendingInvitation {
  id: string;
  organizationName: string;
  role: OrganizationRole;
  token: string;
}

/** The signed-in Supabase auth user, or null. Memoized per request. */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The signed-in user's profile row, or null if signed out. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/**
 * The signed-in user's organization context: which organization they
 * belong to, their membership row id, role, and status. Phase 1 assumes one
 * organization per user (the earliest-created active membership), which
 * covers the target owner-operator businesses; the schema itself already
 * supports a user belonging to multiple organizations for a future org
 * switcher.
 */
export const getCurrentOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (!organization) return null;

  return {
    organization,
    membershipId: membership.id,
    role: membership.role,
    status: membership.status,
  };
});

/** Pending invitations addressed to the signed-in user's email. */
export const getPendingInvitations = cache(async (): Promise<PendingInvitation[]> => {
  const user = await getCurrentUser();
  if (!user?.email) return [];

  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("organization_invitations")
    .select("id, role, token, organization_id")
    .eq("status", "pending")
    .eq("email", user.email);

  if (!invites || invites.length === 0) return [];

  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .in(
      "id",
      invites.map((invite) => invite.organization_id)
    );

  const namesById = new Map((organizations ?? []).map((org) => [org.id, org.name]));

  return invites
    .map((invite) => {
      const organizationName = namesById.get(invite.organization_id);
      if (!organizationName) return null;
      return {
        id: invite.id,
        organizationName,
        role: invite.role,
        token: invite.token,
      };
    })
    .filter((invite): invite is PendingInvitation => invite !== null);
});
