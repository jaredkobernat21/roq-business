import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[var(--radius-lg)] border border-border bg-surface p-4", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-faint">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-foreground-muted">{sub}</p>}
    </div>
  );
}
