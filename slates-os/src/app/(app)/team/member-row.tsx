"use client";

import { useState, useTransition } from "react";
import { updateMemberRoleAction, updateMemberStatusAction } from "@/lib/organizations/members-actions";
import { canModifyMemberRole, assignableRoles, ROLE_LABELS } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fullName } from "@/lib/utils";
import type { OrganizationRole, MemberStatus } from "@/lib/database.types";

interface Member {
  member_id: string;
  role: OrganizationRole;
  status: MemberStatus;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export function MemberRow({
  member,
  actingRole,
  currentUserId,
  isLastActiveOwner,
  isManager,
}: {
  member: Member;
  actingRole: OrganizationRole;
  currentUserId: string;
  isLastActiveOwner: boolean;
  isManager: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSelf = member.member_id === currentUserId;
  const canModify = isManager && !isSelf && canModifyMemberRole(actingRole, member.role);

  function handleRoleChange(role: OrganizationRole) {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRoleAction(member.member_id, member.role, role);
      if (result.error) setError(result.error);
    });
  }

  function handleStatusToggle() {
    setError(null);
    const nextStatus: MemberStatus = member.status === "disabled" ? "active" : "disabled";
    startTransition(async () => {
      const result = await updateMemberStatusAction(member.member_id, member.role, nextStatus);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Avatar firstName={member.first_name} lastName={member.last_name} src={member.avatar_url} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {fullName(member.first_name, member.last_name) || member.email || "Unnamed"}
            {isSelf && <span className="ml-1.5 text-xs font-normal text-foreground-faint">(you)</span>}
          </p>
          <p className="truncate text-xs text-foreground-muted">{member.email}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {member.status === "disabled" && <Badge tone="warning">Disabled</Badge>}
        {member.status === "invited" && <Badge tone="neutral">Invited</Badge>}
        {error && <span className="text-xs text-danger">{error}</span>}

        {canModify ? (
          <Select
            value={member.role}
            disabled={pending}
            onChange={(e) => handleRoleChange(e.target.value as OrganizationRole)}
            className="h-8 w-auto text-xs"
          >
            {assignableRoles(actingRole).includes(member.role) ? null : (
              <option value={member.role}>{ROLE_LABELS[member.role]}</option>
            )}
            {assignableRoles(actingRole).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        ) : (
          <Badge>{ROLE_LABELS[member.role]}</Badge>
        )}

        {canModify && !isLastActiveOwner && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={handleStatusToggle}
          >
            {member.status === "disabled" ? "Enable" : "Disable"}
          </Button>
        )}
      </div>
    </div>
  );
}
