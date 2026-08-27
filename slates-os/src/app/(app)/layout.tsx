import { redirect } from "next/navigation";
import { getCurrentOrgContext, getCurrentProfile } from "@/lib/session";
import { TopNav } from "@/components/app-shell/top-nav";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { Card } from "@/components/ui/card";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [context, profile] = await Promise.all([getCurrentOrgContext(), getCurrentProfile()]);

  if (!context) {
    redirect("/onboarding/organization");
  }

  if (context.status === "disabled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-sm text-center">
          <h1 className="text-base font-semibold text-foreground">Access disabled</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            Your access to {context.organization.name} has been disabled. Contact your
            organization owner if you think this is a mistake.
          </p>
          <div className="mt-5 flex justify-center">
            <SignOutButton />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        organizationName={context.organization.name}
        profile={profile}
        role={context.role}
        businessMode={context.organization.business_mode}
      />
      <main>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
