import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam } from "@/lib/permissions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { MemberRow } from "./member-row";
import { InviteMemberForm } from "./invite-member-form";
import { InvitationRow } from "./invitation-row";

export default async function TeamPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const isManager = canManageTeam(context.role);

  const [{ data: members }, invitationsResult] = await Promise.all([
    supabase.rpc("list_organization_members", { target_org_id: context.organization.id }),
    isManager
      ? supabase
          .from("organization_invitations")
          .select("id, email, role, created_at")
          .eq("organization_id", context.organization.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  const activeOwnerCount =
    members?.filter((m) => m.role === "owner" && m.status === "active").length ?? 0;
  const pendingInvitations = invitationsResult.data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Team</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {members?.length ?? 0} {members?.length === 1 ? "member" : "members"} at{" "}
          {context.organization.name}
        </p>
      </div>

      {isManager && (
        <Card>
          <CardTitle>Invite a team member</CardTitle>
          <CardDescription>
            Sends an invitation record they can accept once they sign in with a matching email.
            Actually emailing the link isn&apos;t wired up yet — see the note below.
          </CardDescription>
          <div className="mt-4">
            <InviteMemberForm actingRole={context.role} />
          </div>
        </Card>
      )}

      {isManager && pendingInvitations.length > 0 && (
        <Card>
          <CardTitle>Pending invitations</CardTitle>
          <div className="mt-4 divide-y divide-border">
            {pendingInvitations.map((invite) => (
              <InvitationRow key={invite.id} invitation={invite} />
            ))}
          </div>
        </Card>
      )}

      <Card className="p-0">
        <div className="divide-y divide-border">
          {members?.map((member) => (
            <MemberRow
              key={member.member_id}
              member={member}
              actingRole={context.role}
              currentUserId={context.membershipId}
              isLastActiveOwner={
                member.role === "owner" && member.status === "active" && activeOwnerCount <= 1
              }
              isManager={isManager}
            />
          ))}
        </div>
      </Card>

      {isManager && (
        <p className="text-xs text-foreground-faint">
          Invitation emails aren&apos;t sent automatically yet. Copy the pending invitation and
          share it manually, or see docs/README.md for what&apos;s needed to connect an email
          provider.
        </p>
      )}
    </div>
  );
}
