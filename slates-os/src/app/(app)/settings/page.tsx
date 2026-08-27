import Link from "next/link";
import { getCurrentOrgContext, getCurrentProfile, getCurrentUser } from "@/lib/session";
import { canManageOrganizationSettings, ROLE_LABELS } from "@/lib/permissions";
import { siteUrl } from "@/lib/site-url";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/icons";
import { BusinessInfoForm } from "./business-info-form";
import { AccountForm } from "./account-form";
import { CopyLinkButton } from "./copy-link-button";

export default async function SettingsPage() {
  const [context, profile, user] = await Promise.all([
    getCurrentOrgContext(),
    getCurrentProfile(),
    getCurrentUser(),
  ]);

  if (!context || !user) return null;

  const canEditBusiness = canManageOrganizationSettings(context.role);
  const bookingUrl = `${siteUrl()}/book/${context.organization.slug}`;

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

      <Link href="/settings/services" className="block">
        <Card className="flex items-center justify-between transition-colors hover:bg-surface-hover">
          <div>
            <CardTitle>Services</CardTitle>
            <CardDescription>Manage the services your business offers.</CardDescription>
          </div>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-faint" />
        </Card>
      </Link>

      <Link href="/settings/hours" className="block">
        <Card className="flex items-center justify-between transition-colors hover:bg-surface-hover">
          <div>
            <CardTitle>Business hours</CardTitle>
            <CardDescription>Set your weekly open hours for scheduling.</CardDescription>
          </div>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-faint" />
        </Card>
      </Link>

      <Link href="/settings/integrations" className="block">
        <Card className="flex items-center justify-between transition-colors hover:bg-surface-hover">
          <div>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Connect Stripe for payments, and more.</CardDescription>
          </div>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground-faint" />
        </Card>
      </Link>

      <Card>
        <CardTitle>Your booking page</CardTitle>
        <CardDescription>
          Share this link with customers — it&apos;s branded as {context.organization.name}, not ROQ OS.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-surface-muted px-3 py-2 text-sm text-foreground">
            {bookingUrl}
          </code>
          <CopyLinkButton text={bookingUrl} />
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
            <button type="button" className="text-sm font-medium text-foreground underline">
              Open
            </button>
          </a>
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
