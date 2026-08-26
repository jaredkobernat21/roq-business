export interface NavItem {
  href: string;
  label: string;
  comingSoon?: boolean;
}

/**
 * Plain, serializable nav data — no icon components here. Server Components
 * (Sidebar, MorePage) pass these across to Client Components, and React
 * Server Components can't serialize function/component values across that
 * boundary. Each Client Component that renders these looks up its own icon
 * by href (see components/app-shell/nav-link.tsx and app/(app)/more/page.tsx).
 */

/** Primary module nav — shown in the sidebar and as the mobile bottom tabs. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/customers", label: "Customers", comingSoon: true },
  { href: "/jobs", label: "Jobs", comingSoon: true },
  { href: "/schedule", label: "Schedule", comingSoon: true },
];

/** Utility nav — always visible in the sidebar, tucked under "More" on mobile. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
];
