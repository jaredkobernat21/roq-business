import { redirect } from "next/navigation";
import { getCurrentOrgContext, getCurrentProfile } from "@/lib/session";
import { Sidebar } from "@/components/app-shell/sidebar";
import { MobileHeader } from "@/components/app-shell/mobile-header";
import { BottomNav } from "@/components/app-shell/bottom-nav";
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
    <div className="flex min-h-screen bg-background">
      <Sidebar organizationName={context.organization.name} profile={profile} role={context.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader organizationName={context.organization.name} profile={profile} />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
