import type { LabelKey } from "@/lib/labels";

export interface NavItem {
  href: string;
  labelKey: LabelKey;
}

/**
 * The three top-level tabs rendered in the app shell's pill nav
 * (see components/app-shell/pill-tabs.tsx). Everything else
 * (customers/jobs/schedule/invoices/team) lives under the Work tab as
 * "View all" links from its dashboard cards rather than as its own nav
 * item — see src/app/(app)/work/page.tsx. Settings is reached from the
 * account menu, outside this tab hierarchy.
 */
export const TOP_NAV: NavItem[] = [
  { href: "/home", labelKey: "home" },
  { href: "/presence", labelKey: "presence" },
  { href: "/work", labelKey: "work" },
];
