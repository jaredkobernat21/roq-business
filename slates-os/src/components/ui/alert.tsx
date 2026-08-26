import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "danger" | "success" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
  neutral: "bg-surface-muted text-foreground-muted",
};

export function Alert({
  tone = "danger",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-sm)] px-3.5 py-2.5 text-sm",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  );
}
