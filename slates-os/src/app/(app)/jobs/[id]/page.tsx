import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgContext, getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canEditJob, canManageInvoices, INVOICE_STATUS_LABELS } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { fullName, formatCents } from "@/lib/utils";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobEditForm } from "./job-edit-form";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCurrentOrgContext();
  const user = await getCurrentUser();
  if (!context) return null;

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!job) {
    notFound();
  }

  const [{ data: customer }, { data: members }, { data: invoices }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("id", job.customer_id)
      .maybeSingle(),
    supabase.rpc("list_organization_members", { target_org_id: context.organization.id }),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_cents")
      .eq("job_id", job.id)
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false }),
  ]);

  const memberOptions = (members ?? [])
    .filter((member) => member.status === "active")
    .map((member) => ({
      id: member.user_id,
      label: fullName(member.first_name, member.last_name) || member.email || "Unnamed",
    }));

  const canEdit = canEditJob(context.role, job, user?.id);
  const canAddInvoice = canManageInvoices(context.role);
  const mode = context.organization.business_mode;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{job.title}</h1>
          {customer && (
            <Link href={`/customers/${customer.id}`} className="mt-1 inline-block text-sm text-foreground-muted underline">
              {fullName(customer.first_name, customer.last_name)}
            </Link>
          )}
        </div>
        {canAddInvoice && (
          <Link href={`/invoices/new?customer_id=${job.customer_id}&job_id=${job.id}`} className="shrink-0">
            <Button size="sm" variant="secondary">
              + {getLabel(mode, "invoice")}
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardTitle>Job details</CardTitle>
        <CardDescription>
          {canEdit ? "Editable by staff and the assigned team member." : "You don't have access to edit this job."}
        </CardDescription>
        <div className="mt-5">
          <JobEditForm job={job} members={memberOptions} readOnly={!canEdit} />
        </div>
      </Card>

      {(invoices ?? []).length > 0 && (
        <Card>
          <CardTitle>{getLabel(mode, "invoices")}</CardTitle>
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
        </Card>
      )}
    </div>
  );
}
