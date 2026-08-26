import { cn } from "@/lib/utils";

export function Avatar({
  firstName,
  lastName,
  src,
  size = 36,
  className,
}: {
  firstName?: string | null;
  lastName?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = `${firstName?.trim()?.[0] ?? ""}${lastName?.trim()?.[0] ?? ""}`.toUpperCase();

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={{ width: size, height: size }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cn(
        "flex items-center justify-center rounded-full bg-surface-muted font-medium text-foreground-muted",
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
