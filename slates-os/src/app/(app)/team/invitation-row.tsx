"use client";

import { useState, useTransition } from "react";
import { revokeInvitationAction } from "@/lib/organizations/members-actions";
import { ROLE_LABELS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import type { OrganizationRole } from "@/lib/database.types";

export function InvitationRow({
  invitation,
}: {
  invitation: { id: string; email: string; role: OrganizationRole; created_at: string };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(false);

  if (revoked) return null;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{invitation.email}</p>
        <p className="text-xs text-foreground-muted">Invited as {ROLE_LABELS[invitation.role]}</p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await revokeInvitationAction(invitation.id);
            if (result.error) setError(result.error);
            else setRevoked(true);
          })
        }
      >
        Revoke
      </Button>
    </div>
  );
}
