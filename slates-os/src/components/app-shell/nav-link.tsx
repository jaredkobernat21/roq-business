"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav";
import {
  HomeIcon,
  CustomersIcon,
  JobsIcon,
  ScheduleIcon,
  TeamIcon,
  SettingsIcon,
} from "@/components/icons";
import type { ComponentType, SVGProps } from "react";

// Icon components live here (not in the shared nav data) because a Server
// Component can't pass a function/component value as a prop into a Client
// Component — see lib/nav.ts for why.
export const NAV_ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "/home": HomeIcon,
  "/customers": CustomersIcon,
  "/jobs": JobsIcon,
  "/schedule": ScheduleIcon,
  "/team": TeamIcon,
  "/settings": SettingsIcon,
};

export function SidebarNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = NAV_ICONS[item.href];

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-surface-muted text-foreground"
          : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
      )}
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
      <span className="flex-1">{item.label}</span>
      {item.comingSoon && (
        <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-medium text-foreground-faint">
          Soon
        </span>
      )}
    </Link>
  );
}

export function BottomNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = NAV_ICONS[item.href];

  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium",
        isActive ? "text-foreground" : "text-foreground-faint"
      )}
    >
      {Icon && <Icon className="h-[22px] w-[22px]" />}
      {item.label}
    </Link>
  );
}
