"use client";

import { useTransition } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { LogOutIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
      className={cn(
        "flex items-center gap-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground disabled:opacity-50",
        className
      )}
    >
      <LogOutIcon className="h-4 w-4" />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
