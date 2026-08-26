import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

export function MobileHeader({
  organizationName,
  profile,
}: {
  organizationName: string;
  profile: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-[11px] font-semibold text-accent-foreground">
          S
        </div>
        <span className="truncate text-sm font-semibold text-foreground">{organizationName}</span>
      </div>
      <Link href="/settings" aria-label="Account">
        <Avatar
          firstName={profile?.first_name}
          lastName={profile?.last_name}
          src={profile?.avatar_url}
          size={30}
        />
      </Link>
    </header>
  );
}
