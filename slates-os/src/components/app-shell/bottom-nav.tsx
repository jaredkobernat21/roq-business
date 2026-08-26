import { PRIMARY_NAV } from "@/lib/nav";
import { BottomNavLink } from "@/components/app-shell/nav-link";
import { MoreIcon } from "@/components/icons";
import Link from "next/link";

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      {PRIMARY_NAV.map((item) => (
        <BottomNavLink key={item.href} item={item} />
      ))}
      <Link
        href="/more"
        className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-foreground-faint"
      >
        <MoreIcon className="h-[22px] w-[22px]" />
        More
      </Link>
    </nav>
  );
}
