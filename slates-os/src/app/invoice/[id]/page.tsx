import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { getPublicInvoice } from "@/lib/invoices/public";
import { getInvoiceStripeAccount } from "@/lib/payments/checkout";
import { getContrastForeground } from "@/lib/branding/color";
import { INVOICE_STATUS_LABELS } from "@/lib/permissions";
import { fullName, formatCents } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { PayInvoiceButton } from "./pay-invoice-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getPublicInvoice(id);
  if (!invoice) return { title: "Invoice" };
  return { title: `Invoice #${invoice.invoice_number} — ${invoice.organization.name}` };
}

export default async function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, stripeAccountId] = await Promise.all([getPublicInvoice(id), getInvoiceStripeAccount(id)]);

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-foreground-muted">This invoice isn&apos;t available.</p>
      </div>
    );
  }

  const primaryColor = invoice.organization.primary_color ?? "#232120";
  const accentForeground = getContrastForeground(primaryColor);
  const amountDueCents = invoice.total_cents - invoice.amount_paid_cents;
  const customerName =
    [fullName(invoice.customer.first_name, invoice.customer.last_name), invoice.customer.company_name]
      .filter(Boolean)
      .join(" — ") || "Customer";

  return (
    <div
      className="min-h-screen bg-background"
      style={{ "--accent": primaryColor, "--accent-foreground": accentForeground } as CSSProperties}
    >
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          {invoice.organization.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={invoice.organization.logo_url}
              alt={invoice.organization.name}
              className="mb-4 h-14 w-14 rounded-[var(--radius-md)] object-cover"
            />
          ) : (
            <div
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] text-lg font-semibold"
              style={{ backgroundColor: primaryColor, color: accentForeground }}
            >
              {invoice.organization.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{invoice.organization.name}</h1>
          <p className="mt-1 text-sm text-foreground-muted">Invoice #{invoice.invoice_number}</p>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground-muted">Billed to {customerName}</p>
            <Badge tone="neutral">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
          </div>

          <ul className="mt-5 divide-y divide-border">
            {invoice.items.map((item, index) => (
              <li key={index} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-foreground">
                  {item.description}
                  {item.quantity !== 1 && ` × ${item.quantity}`}
                </span>
                <span className="text-foreground-muted">
                  {formatCents(Math.round(item.quantity * item.rate_cents))}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between text-foreground-muted">
              <span>Subtotal</span>
              <span>{formatCents(invoice.subtotal_cents)}</span>
            </div>
            {invoice.tax_cents > 0 && (
              <div className="flex justify-between text-foreground-muted">
                <span>Tax</span>
                <span>{formatCents(invoice.tax_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-foreground">
              <span>Total</span>
              <span>{formatCents(invoice.total_cents)}</span>
            </div>
            {invoice.amount_paid_cents > 0 && (
              <div className="flex justify-between text-foreground-muted">
                <span>Paid</span>
                <span>{formatCents(invoice.amount_paid_cents)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground">
              <span>Amount due</span>
              <span>{formatCents(amountDueCents)}</span>
            </div>
          </div>

          {invoice.due_date && (
            <p className="mt-4 text-xs text-foreground-faint">Due {invoice.due_date}</p>
          )}

          {amountDueCents > 0 ? (
            <div className="mt-6">
              {stripeAccountId ? (
                <PayInvoiceButton invoiceId={invoice.id} />
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-[var(--radius-md)] bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground opacity-50"
                  >
                    Pay invoice
                  </button>
                  <p className="mt-2 text-center text-xs text-foreground-faint">
                    Online payment coming soon
                    {invoice.organization.phone ? ` — call ${invoice.organization.phone} to pay by phone` : ""}.
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="mt-6 text-center text-sm font-medium text-success">Paid in full</p>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-foreground-faint">
          Questions? Contact {invoice.organization.name}
          {invoice.organization.email ? ` at ${invoice.organization.email}` : ""}
          {invoice.organization.phone ? ` or ${invoice.organization.phone}` : ""}.
        </div>
      </div>
    </div>
  );
}
