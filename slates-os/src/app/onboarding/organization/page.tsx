import { redirect } from "next/navigation";
import { getCurrentOrgContext, getCurrentProfile, getPendingInvitations } from "@/lib/session";
import { acceptInvitationAction } from "@/lib/organizations/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ROLE_LABELS } from "@/lib/permissions";
import { CreateOrganizationForm } from "./create-organization-form";

export default async function OnboardingOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [context, profile, invitations] = await Promise.all([
    getCurrentOrgContext(),
    getCurrentProfile(),
    getPendingInvitations(),
  ]);

  if (context) {
    redirect("/home");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {profile?.first_name ? `Welcome, ${profile.first_name}` : "Welcome"}
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Let&apos;s get your business set up in SLATES OS.
        </p>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {invitations.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground">You&apos;ve been invited</h2>
          <ul className="mt-3 space-y-3">
            {invitations.map((invite) => (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {invite.organizationName}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    as {ROLE_LABELS[invite.role]}
                  </p>
                </div>
                <form action={acceptInvitationAction.bind(null, invite.token)}>
                  <Button type="submit" size="sm">
                    Accept
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          {invitations.length > 0 ? "Or create your own business" : "Create your business"}
        </h2>
        <CreateOrganizationForm />
      </Card>
    </div>
  );
}
