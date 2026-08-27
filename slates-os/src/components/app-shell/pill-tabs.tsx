"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BusinessMode } from "@/lib/database.types";

type TabKey = "home" | "presence" | "work";

const TABS: { key: TabKey; href: string }[] = [
  { key: "home", href: "/home" },
  { key: "presence", href: "/presence" },
  { key: "work", href: "/work" },
];

// The Work tab also covers the full pages reached from its dashboard cards
// (Customers/Jobs/Schedule/Invoices/Team) — those pages don't get their own
// pill, but the Work pill should still read as active while inside them.
const TAB_PREFIXES: Record<TabKey, string[]> = {
  home: ["/home"],
  presence: ["/presence"],
  work: ["/work", "/customers", "/jobs", "/schedule", "/invoices", "/team"],
};

function isActive(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function PillTabs({ businessMode }: { businessMode: BusinessMode }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full bg-surface-muted p-1">
      {TABS.map((tab) => {
        const active = isActive(pathname, TAB_PREFIXES[tab.key]);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors sm:px-4",
              active ? "bg-accent text-accent-foreground" : "text-foreground-muted hover:text-foreground"
            )}
          >
            {getLabel(businessMode, tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
