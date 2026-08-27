import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import {
  canManageCustomers,
  canCreateJobs,
  canManageInvoices,
  JOB_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { formatActivityEvent } from "@/lib/activity";
import { fullName, initials, formatCents } from "@/lib/utils";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerDetailsForm } from "./customer-details-form";
import { AddressList } from "./address-list";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const supabase = await createClient();
  const [{ data: customer }, { data: addresses }, { data: jobs }, { data: invoices }, { data: events }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("organization_id", context.organization.id)
        .maybeSingle(),
      supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_id", id)
        .eq("organization_id", context.organization.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("jobs")
        .select("id, title, status, scheduled_at")
        .eq("customer_id", id)
        .eq("organization_id", context.organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("id, invoice_number, status, total_cents")
        .eq("customer_id", id)
        .eq("organization_id", context.organization.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_events")
        .select("id, event_type, data, created_at")
        .eq("customer_id", id)
        .eq("organization_id", context.organization.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (!customer) {
    notFound();
  }

  const canManage = canManageCustomers(context.role);
  const canAddJob = canCreateJobs(context.role);
  const canAddInvoice = canManageInvoices(context.role);
  const mode = context.organization.business_mode;
  const jobLabel = getLabel(mode, "job");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-semibold text-foreground-muted">
            {initials(customer.first_name, customer.last_name)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              {fullName(customer.first_name, customer.last_name)}
            </h1>
            {customer.company_name && (
              <p className="truncate text-sm text-foreground-muted">{customer.company_name}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {canAddInvoice && (
            <Link href={`/invoices/new?customer_id=${customer.id}`}>
              <Button size="sm" variant="secondary">
                + {getLabel(mode, "invoice")}
              </Button>
            </Link>
          )}
          {canAddJob && (
            <Link href={`/jobs/new?customer_id=${customer.id}`}>
              <Button size="sm">+ Add {jobLabel}</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <CardTitle>{getLabel(mode, "customer")} details</CardTitle>
        <CardDescription>
          {canManage ? "Editable by staff." : "Only owners, admins, and schedulers can edit this."}
        </CardDescription>
        <div className="mt-5">
          <CustomerDetailsForm customer={customer} readOnly={!canManage} />
        </div>
      </Card>

      <Card>
        <CardTitle>Addresses</CardTitle>
        <CardDescription>Service and billing addresses for this {getLabel(mode, "customer").toLowerCase()}.</CardDescription>
        <div className="mt-5">
          <AddressList customerId={customer.id} addresses={addresses ?? []} canManage={canManage} />
        </div>
      </Card>

      <Card>
        <CardTitle>{getLabel(mode, "jobs")}</CardTitle>
        {(jobs ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">No {jobLabel.toLowerCase()}s yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {(jobs ?? []).map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    {job.scheduled_at && (
                      <p className="text-xs text-foreground-muted">
                        {new Date(job.scheduled_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Badge tone="neutral">{JOB_STATUS_LABELS[job.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>{getLabel(mode, "invoices")}</CardTitle>
        {(invoices ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">No {getLabel(mode, "invoices").toLowerCase()} yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {(invoices ?? []).map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center justify-between gap-3 py-3 hover:opacity-80"
                >
                  <p className="text-sm font-medium text-foreground">
                    Invoice #{invoice.invoice_number} — {formatCents(invoice.total_cents)}
                  </p>
                  <Badge tone="neutral">{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Activity</CardTitle>
        {(events ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-foreground-muted">No activity yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {(events ?? []).map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-foreground">
                  {formatActivityEvent(event.event_type, event.data)}
                </span>
                <span className="shrink-0 text-xs text-foreground-faint">
                  {new Date(event.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
