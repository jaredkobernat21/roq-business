import Link from "next/link";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageServices } from "@/lib/permissions";
import { formatCents } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ServicesPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, starting_price_cents, is_active, bookable_online")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: true });

  const canManage = canManageServices(context.role);
  const rows = services ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Services</h1>
          <p className="mt-1 text-sm text-foreground-muted">Your organization&apos;s service catalog.</p>
        </div>
        {canManage && (
          <Link href="/settings/services/new">
            <Button size="sm">+ Add service</Button>
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="text-center text-sm text-foreground-muted">
          No services yet.{" "}
          {canManage && (
            <Link href="/settings/services/new" className="font-medium text-foreground underline">
              Add your first one
            </Link>
          )}
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((service) => (
            <Link
              key={service.id}
              href={`/settings/services/${service.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
                <p className="truncate text-xs text-foreground-muted">
                  {[
                    service.duration_minutes ? `${service.duration_minutes} min` : null,
                    formatCents(service.starting_price_cents),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {!service.is_active && <Badge tone="neutral">Inactive</Badge>}
              {service.bookable_online && <Badge tone="success">Online</Badge>}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
