import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getTodayAgenda } from "@/lib/scheduling/today-agenda";
import { getLabel } from "@/lib/labels";
import {
  canCreateJobs,
  canManageCustomers,
  canManageInvoices,
  JOB_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/permissions";
import { fullName, initials, formatCents } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import type { JobStatus, InvoiceStatus } from "@/lib/database.types";

const JOB_STATUS_TONE: Record<JobStatus, "neutral" | "success" | "warning" | "danger"> = {
  lead: "neutral",
  estimate: "neutral",
  approved: "warning",
  scheduled: "warning",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

const INVOICE_STATUS_TONE: Record<InvoiceStatus, "neutral" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  sent: "warning",
  viewed: "warning",
  partially_paid: "warning",
  paid: "success",
  overdue: "danger",
  void: "neutral",
};

const OPEN_JOB_STATUSES: JobStatus[] = ["lead", "estimate", "approved", "scheduled", "in_progress"];
const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "viewed", "partially_paid", "overdue"];

export default async function WorkPage() {
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const orgId = context.organization.id;
  const supabase = await createClient();
  const now = new Date();

  const [
    { data: allJobs },
    { data: allCustomers },
    { data: allInvoices },
    { data: todaysPayments },
    { data: members },
    todaysSchedule,
  ] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, title, status, scheduled_at, customer_id, assigned_to, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, first_name, last_name, company_name, status, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_cents, amount_paid_cents, customer_id, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("amount_cents")
      .eq("organization_id", orgId)
      .eq("status", "succeeded")
      .gte("created_at", startOfDay(now).toISOString())
      .lte("created_at", endOfDay(now).toISOString()),
    supabase.rpc("list_organization_members", { target_org_id: orgId }),
    getTodayAgenda(orgId, { limit: 5 }),
  ]);

  const jobs = allJobs ?? [];
  const customers = allCustomers ?? [];
  const invoices = allInvoices ?? [];
  const activeMembers = (members ?? []).filter((member) => member.status === "active");

  const customerNamesById = new Map(customers.map((customer) => [customer.id, fullName(customer.first_name, customer.last_name)]));

  const activeJobs = jobs.filter((job) => OPEN_JOB_STATUSES.includes(job.status));
  const jobsToday = jobs.filter(
    (job) =>
      job.scheduled_at &&
      new Date(job.scheduled_at) >= startOfDay(now) &&
      new Date(job.scheduled_at) <= endOfDay(now)
  );
  const scheduledJobs = jobs.filter((job) => job.status === "scheduled");
  const leads = customers.filter((customer) => customer.status === "lead");
  const openInvoices = invoices.filter((invoice) => OPEN_INVOICE_STATUSES.includes(invoice.status));
  const openInvoicesTotalCents = openInvoices.reduce(
    (sum, invoice) => sum + (invoice.total_cents - invoice.amount_paid_cents),
    0
  );
  const paymentsCollectedTodayCents = (todaysPayments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);

  const canAddJob = canCreateJobs(context.role);
  const canAddCustomer = canManageCustomers(context.role);
  const canAddInvoice = canManageInvoices(context.role);

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-foreground">
        {getLabel(context.organization.business_mode, "work")}
      </h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active jobs" value={String(activeJobs.length)} />
        <StatCard label="Jobs today" value={String(jobsToday.length)} />
        <StatCard label="New leads" value={String(leads.length)} />
        <StatCard label="Scheduled appts" value={String(scheduledJobs.length)} />
        <StatCard label="Open invoices" value={formatCents(openInvoicesTotalCents)} sub={`${openInvoices.length} open`} />
        <StatCard label="Payments today" value={formatCents(paymentsCollectedTodayCents)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Today&apos;s schedule</h2>
            <Link href="/schedule" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {todaysSchedule.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No jobs scheduled today.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {todaysSchedule.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    <p className="truncate text-xs text-foreground-muted">{job.customerName}</p>
                  </div>
                  <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Pipeline / leads</h2>
            <Link href="/customers" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {leads.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No leads yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {leads.slice(0, 5).map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fullName(customer.first_name, customer.last_name)}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">{customer.company_name || "—"}</p>
                  </div>
                  <Badge tone="neutral">{CUSTOMER_STATUS_LABELS[customer.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Active jobs</h2>
            <Link href="/jobs" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {activeJobs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No active jobs.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {activeJobs.slice(0, 5).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    <p className="truncate text-xs text-foreground-muted">
                      {customerNamesById.get(job.customer_id) ?? "—"}
                    </p>
                  </div>
                  <Badge tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
          {canAddJob && (
            <div className="border-t border-border px-5 py-3 sm:px-6">
              <Link href="/jobs/new">
                <Button size="sm" variant="secondary">
                  + Add job
                </Button>
              </Link>
            </div>
          )}
          <div className="h-2" />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Customers</h2>
            <Link href="/customers" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {customers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No customers yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {customers.slice(0, 5).map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground-muted">
                    {initials(customer.first_name, customer.last_name)}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {fullName(customer.first_name, customer.last_name)}
                  </p>
                  <Badge tone={customer.status === "customer" ? "success" : "neutral"}>
                    {CUSTOMER_STATUS_LABELS[customer.status]}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
          {canAddCustomer && (
            <div className="border-t border-border px-5 py-3 sm:px-6">
              <Link href="/customers/new">
                <Button size="sm" variant="secondary">
                  + Add customer
                </Button>
              </Link>
            </div>
          )}
          <div className="h-2" />
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Invoices / payments</h2>
            <Link href="/invoices" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {invoices.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No invoices yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {invoices.slice(0, 5).map((invoice) => (
                <Link
                  key={invoice.id}
                  href={`/invoices/${invoice.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      #{invoice.invoice_number} — {customerNamesById.get(invoice.customer_id) ?? "—"}
                    </p>
                    <p className="truncate text-xs text-foreground-muted">{formatCents(invoice.total_cents)}</p>
                  </div>
                  <Badge tone={INVOICE_STATUS_TONE[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
          {canAddInvoice && (
            <div className="border-t border-border px-5 py-3 sm:px-6">
              <Link href="/invoices/new">
                <Button size="sm" variant="secondary">
                  + New invoice
                </Button>
              </Link>
            </div>
          )}
          <div className="h-2" />
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Team / workload</h2>
            <Link href="/team" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {activeMembers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No team members yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {activeMembers.slice(0, 5).map((member) => {
                const assignedCount = activeJobs.filter((job) => job.assigned_to === member.user_id).length;
                return (
                  <div key={member.member_id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground-muted">
                      {initials(member.first_name, member.last_name)}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {fullName(member.first_name, member.last_name) || member.email || "Unnamed"}
                    </p>
                    <span className="shrink-0 text-xs text-foreground-muted">{assignedCount} active</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>
      </div>
    </div>
  );
}
