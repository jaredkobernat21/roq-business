"use client";

import { useActionState } from "react";
import { inviteMemberAction } from "@/lib/organizations/members-actions";
import type { FormActionState } from "@/lib/organizations/actions";
import { assignableRoles, ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { OrganizationRole } from "@/lib/database.types";

const initialState: FormActionState = {};

export function InviteMemberForm({ actingRole }: { actingRole: OrganizationRole }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" type="email" placeholder="name@example.com" required />
      </div>
      <div className="sm:w-40">
        <Label htmlFor="invite-role">Role</Label>
        <Select id="invite-role" name="role" defaultValue="technician">
          {assignableRoles(actingRole).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={pending} className="sm:w-auto">
        {pending ? "Sending…" : "Invite"}
      </Button>

      {state.error && (
        <div className="w-full">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}
      {state.success && (
        <div className="w-full">
          <Alert tone="success">Invitation created.</Alert>
        </div>
      )}
    </form>
  );
}
