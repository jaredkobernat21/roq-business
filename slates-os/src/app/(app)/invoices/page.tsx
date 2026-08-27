import Link from "next/link";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageInvoices, INVOICE_STATUS_LABELS } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { fullName, formatCents } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoicesIcon } from "@/components/icons";
import type { InvoiceStatus } from "@/lib/database.types";

const STATUS_TONE: Record<InvoiceStatus, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  sent: "warning",
  viewed: "warning",
  partially_paid: "warning",
  paid: "success",
  overdue: "danger",
  void: "neutral",
};

export default async function InvoicesPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total_cents, amount_paid_cents, due_date, customer_id")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false });

  const rows = invoices ?? [];
  const customerIds = [...new Set(rows.map((invoice) => invoice.customer_id))];
  const { data: customers } =
    customerIds.length > 0
      ? await supabase.from("customers").select("id, first_name, last_name").in("id", customerIds)
      : { data: [] };
  const customerNamesById = new Map(
    (customers ?? []).map((customer) => [customer.id, fullName(customer.first_name, customer.last_name)])
  );

  const mode = context.organization.business_mode;
  const canManage = canManageInvoices(context.role);
  const invoiceLabel = getLabel(mode, "invoice");
  const invoicesLabel = getLabel(mode, "invoices");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{invoicesLabel}</h1>
        {canManage && (
          <Link href="/invoices/new">
            <Button size="sm">+ New {invoiceLabel}</Button>
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
            <InvoicesIcon className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">No {invoicesLabel.toLowerCase()} yet</h2>
          <p className="mt-1.5 max-w-xs text-sm text-foreground-muted">
            {canManage
              ? `Create your first ${invoiceLabel.toLowerCase()} to bill a customer.`
              : `${invoicesLabel} will show up here once they're created.`}
          </p>
          {canManage && (
            <Link href="/invoices/new" className="mt-4">
              <Button size="sm">+ New {invoiceLabel}</Button>
            </Link>
          )}
        </div>
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/invoices/${invoice.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  Invoice #{invoice.invoice_number} — {customerNamesById.get(invoice.customer_id) ?? "—"}
                </p>
                <p className="truncate text-xs text-foreground-muted">
                  {formatCents(invoice.total_cents)}
                  {invoice.due_date ? ` · due ${invoice.due_date}` : ""}
                </p>
              </div>
              <Badge tone={STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
