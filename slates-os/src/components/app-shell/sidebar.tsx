import { PRIMARY_NAV, SECONDARY_NAV } from "@/lib/nav";
import { SidebarNavLink } from "@/components/app-shell/nav-link";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { Avatar } from "@/components/ui/avatar";
import { ROLE_LABELS } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import type { OrganizationRole } from "@/lib/database.types";

export function Sidebar({
  organizationName,
  profile,
  role,
}: {
  organizationName: string;
  profile: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  role: OrganizationRole;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-xs font-semibold text-accent-foreground">
          S
        </div>
        <span className="truncate text-sm font-semibold text-foreground">{organizationName}</span>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarNavLink key={item.href} item={item} />
          ))}
        </div>
        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-foreground-faint">
            Organization
          </p>
          {SECONDARY_NAV.map((item) => (
            <SidebarNavLink key={item.href} item={item} />
          ))}
        </div>
      </nav>

      <div className="flex items-center gap-3 border-t border-border px-4 py-4">
        <Avatar firstName={profile?.first_name} lastName={profile?.last_name} src={profile?.avatar_url} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {fullName(profile?.first_name, profile?.last_name) || "Your account"}
          </p>
          <p className="truncate text-xs text-foreground-muted">{ROLE_LABELS[role]}</p>
        </div>
      </div>
      <div className="border-t border-border px-4 py-3">
        <SignOutButton />
      </div>
    </aside>
  );
}
