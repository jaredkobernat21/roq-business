import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canManageInvoices, INVOICE_STATUS_LABELS } from "@/lib/permissions";
import { markInvoiceSentAction, voidInvoiceAction } from "@/lib/invoices/actions";
import { siteUrl } from "@/lib/site-url";
import { fullName } from "@/lib/utils";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyLinkButton } from "@/app/(app)/settings/copy-link-button";
import { InvoiceEditForm } from "./invoice-edit-form";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  const [{ data: customer }, { data: items }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name").eq("id", invoice.customer_id).maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("sort_order", { ascending: true }),
  ]);

  const canManage = canManageInvoices(context.role);
  const taxPercent =
    invoice.subtotal_cents > 0 ? Math.round((invoice.tax_cents / invoice.subtotal_cents) * 10000) / 100 : 0;
  const publicUrl = `${siteUrl()}/invoice/${invoice.id}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoice #{invoice.invoice_number}</h1>
          {customer && (
            <Link href={`/customers/${customer.id}`} className="text-sm text-foreground-muted underline">
              {fullName(customer.first_name, customer.last_name)}
            </Link>
          )}
        </div>
        <Badge tone="neutral">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
      </div>

      {canManage && invoice.status !== "void" && (
        <div className="flex flex-wrap gap-2">
          {invoice.status === "draft" && (
            <form action={markInvoiceSentAction.bind(null, invoice.id)}>
              <Button type="submit" size="sm">
                Mark as sent
              </Button>
            </form>
          )}
          <form action={voidInvoiceAction.bind(null, invoice.id)}>
            <Button type="submit" size="sm" variant="secondary">
              Void invoice
            </Button>
          </form>
        </div>
      )}

      {invoice.status !== "draft" && (
        <Card>
          <CardTitle>Customer link</CardTitle>
          <CardDescription>What your customer sees — branded, not ROQ OS.</CardDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-surface-muted px-3 py-2 text-sm text-foreground">
              {publicUrl}
            </code>
            <CopyLinkButton text={publicUrl} />
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          {canManage
            ? invoice.status === "draft"
              ? "Editable while this invoice is still a draft."
              : "Only draft invoices can be edited — void and recreate if something needs to change."
            : "Only owners, admins, and schedulers can edit invoices."}
        </CardDescription>
        <div className="mt-5">
          <InvoiceEditForm
            invoice={invoice}
            items={items ?? []}
            taxPercent={taxPercent}
            readOnly={!canManage || invoice.status !== "draft"}
          />
        </div>
      </Card>
    </div>
  );
}
