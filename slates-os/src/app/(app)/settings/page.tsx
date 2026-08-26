import { getCurrentOrgContext, getCurrentProfile, getCurrentUser } from "@/lib/session";
import { canManageOrganizationSettings, ROLE_LABELS } from "@/lib/permissions";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { BusinessInfoForm } from "./business-info-form";
import { AccountForm } from "./account-form";

export default async function SettingsPage() {
  const [context, profile, user] = await Promise.all([
    getCurrentOrgContext(),
    getCurrentProfile(),
    getCurrentUser(),
  ]);

  if (!context || !user) return null;

  const canEditBusiness = canManageOrganizationSettings(context.role);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>

      <Card>
        <CardTitle>Business information</CardTitle>
        <CardDescription>
          {canEditBusiness
            ? "Visible to your team and, in future phases, to customers."
            : "Only owners and admins can edit business information."}
        </CardDescription>
        <div className="mt-5">
          <BusinessInfoForm organization={context.organization} readOnly={!canEditBusiness} />
        </div>
      </Card>

      <Card>
        <CardTitle>Your account</CardTitle>
        <CardDescription>
          Signed in as {user.email} — {ROLE_LABELS[context.role]} at {context.organization.name}
        </CardDescription>
        <div className="mt-5">
          <AccountForm profile={profile} email={user.email ?? ""} />
        </div>
      </Card>
    </div>
  );
}
