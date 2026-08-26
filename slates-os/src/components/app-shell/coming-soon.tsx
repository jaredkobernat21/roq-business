import type { ComponentType, SVGProps } from "react";

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
        <Icon className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-base font-semibold text-foreground">{title}</h1>
      <p className="mt-1.5 max-w-xs text-sm text-foreground-muted">{description}</p>
      <span className="mt-4 rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-foreground-faint">
        Coming soon
      </span>
    </div>
  );
}
