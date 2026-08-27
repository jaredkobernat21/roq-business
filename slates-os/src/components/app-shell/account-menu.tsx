"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/app-shell/sign-out-button";
import { ROLE_LABELS } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import type { OrganizationRole } from "@/lib/database.types";

export function AccountMenu({
  profile,
  role,
}: {
  profile: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  role: OrganizationRole;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        className="block rounded-full"
      >
        <Avatar firstName={profile?.first_name} lastName={profile?.last_name} src={profile?.avatar_url} size={34} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-56 rounded-[var(--radius-md)] border border-border bg-surface p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">
              {fullName(profile?.first_name, profile?.last_name) || "Your account"}
            </p>
            <p className="truncate text-xs text-foreground-muted">{ROLE_LABELS[role]}</p>
          </div>
          <div className="my-1 border-t border-border" />
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            Settings
          </Link>
          <div className="my-1 border-t border-border" />
          <div className="px-3 py-2">
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
