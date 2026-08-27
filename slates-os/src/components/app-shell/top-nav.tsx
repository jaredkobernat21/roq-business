import Link from "next/link";
import { PillTabs } from "@/components/app-shell/pill-tabs";
import { AccountMenu } from "@/components/app-shell/account-menu";
import type { BusinessMode, OrganizationRole } from "@/lib/database.types";

export function TopNav({
  organizationName,
  profile,
  role,
  businessMode,
}: {
  organizationName: string;
  profile: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  role: OrganizationRole;
  businessMode: BusinessMode;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <Link href="/home" className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-xs font-semibold text-accent-foreground">
          {organizationName.trim().charAt(0).toUpperCase() || "R"}
        </div>
        <span className="hidden truncate text-sm font-semibold text-foreground sm:inline">{organizationName}</span>
      </Link>

      <PillTabs businessMode={businessMode} />

      <AccountMenu profile={profile} role={role} />
    </header>
  );
}
