import Link from "next/link";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageCustomers, CUSTOMER_STATUS_LABELS } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { fullName, initials } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomersIcon } from "@/components/icons";

export default async function CustomersPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id, first_name, last_name, company_name, phone, email, status")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false });

  const mode = context.organization.business_mode;
  const canManage = canManageCustomers(context.role);
  const rows = customers ?? [];
  const customerLabel = getLabel(mode, "customer");
  const customersLabel = getLabel(mode, "customers");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{customersLabel}</h1>
        {canManage && (
          <div className="flex gap-2">
            <Link href="/customers/import">
              <Button size="sm" variant="secondary">
                Import
              </Button>
            </Link>
            <Link href="/customers/new">
              <Button size="sm">+ Add {customerLabel}</Button>
            </Link>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
            <CustomersIcon className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            No {customersLabel.toLowerCase()} yet
          </h2>
          <p className="mt-1.5 max-w-xs text-sm text-foreground-muted">
            {canManage
              ? `Add your first ${customerLabel.toLowerCase()} to get started.`
              : `${customersLabel} will show up here once they're added.`}
          </p>
          {canManage && (
            <Link href="/customers/new" className="mt-4">
              <Button size="sm">+ Add {customerLabel}</Button>
            </Link>
          )}
        </div>
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((customer) => (
            <Link
              key={customer.id}
              href={`/customers/${customer.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground-muted">
                {initials(customer.first_name, customer.last_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {fullName(customer.first_name, customer.last_name)}
                </p>
                <p className="truncate text-xs text-foreground-muted">
                  {[customer.company_name, customer.phone || customer.email].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
              <Badge tone={customer.status === "customer" ? "success" : "neutral"}>
                {CUSTOMER_STATUS_LABELS[customer.status]}
              </Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
