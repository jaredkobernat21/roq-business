import Link from "next/link";
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/lib/nav";
import {
  ChevronRightIcon,
  CustomersIcon,
  JobsIcon,
  ScheduleIcon,
  TeamIcon,
  SettingsIcon,
} from "@/components/icons";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { Card } from "@/components/ui/card";
import type { ComponentType, SVGProps } from "react";

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "/customers": CustomersIcon,
  "/jobs": JobsIcon,
  "/schedule": ScheduleIcon,
  "/team": TeamIcon,
  "/settings": SettingsIcon,
};

function NavRow({ href, label, comingSoon }: NavItem) {
  const Icon = ICONS[href];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)] hover:bg-surface-hover"
    >
      {Icon && <Icon className="h-[18px] w-[18px] text-foreground-muted" />}
      <span className="flex-1">{label}</span>
      {comingSoon && (
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-foreground-faint">
          Soon
        </span>
      )}
      <ChevronRightIcon className="h-4 w-4 text-foreground-faint" />
    </Link>
  );
}

export default function MorePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">More</h1>

      <Card className="divide-y divide-border p-0">
        {SECONDARY_NAV.map((item) => (
          <NavRow key={item.href} {...item} />
        ))}
      </Card>

      <Card className="divide-y divide-border p-0">
        {PRIMARY_NAV.filter((item) => item.comingSoon).map((item) => (
          <NavRow key={item.href} {...item} />
        ))}
      </Card>

      <div className="px-1">
        <SignOutButton />
      </div>
    </div>
  );
}
