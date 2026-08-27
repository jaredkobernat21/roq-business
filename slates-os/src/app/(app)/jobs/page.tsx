import Link from "next/link";
import { getCurrentOrgContext, getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canCreateJobs, JOB_STATUS_LABELS } from "@/lib/permissions";
import { getLabel } from "@/lib/labels";
import { fullName } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JobsIcon } from "@/components/icons";
import type { JobStatus } from "@/lib/database.types";

const STATUS_TONE: Record<JobStatus, "neutral" | "success" | "warning" | "danger"> = {
  lead: "neutral",
  estimate: "neutral",
  approved: "warning",
  scheduled: "warning",
  in_progress: "warning",
  completed: "success",
  cancelled: "danger",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ assigned?: string }>;
}) {
  const { assigned } = await searchParams;
  const assignedToMe = assigned === "me";

  const context = await getCurrentOrgContext();
  if (!context) return null;

  const user = assignedToMe ? await getCurrentUser() : null;

  const supabase = await createClient();
  let jobsQuery = supabase
    .from("jobs")
    .select("id, title, status, scheduled_at, customer_id, assigned_to")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false });

  if (assignedToMe && user) {
    jobsQuery = jobsQuery.eq("assigned_to", user.id);
  }

  const { data: jobs } = await jobsQuery;

  const rows = jobs ?? [];
  const customerIds = [...new Set(rows.map((job) => job.customer_id))];
  const { data: customers } =
    customerIds.length > 0
      ? await supabase.from("customers").select("id, first_name, last_name").in("id", customerIds)
      : { data: [] };
  const customerNamesById = new Map(
    (customers ?? []).map((customer) => [customer.id, fullName(customer.first_name, customer.last_name)])
  );

  const mode = context.organization.business_mode;
  const canCreate = canCreateJobs(context.role);
  const jobLabel = getLabel(mode, "job");
  const jobsLabel = getLabel(mode, "jobs");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{jobsLabel}</h1>
          {assignedToMe && (
            <p className="mt-1 text-xs text-foreground-muted">
              Showing {jobLabel.toLowerCase()}s assigned to you ·{" "}
              <Link href="/jobs" className="font-medium underline underline-offset-2">
                Show all
              </Link>
            </p>
          )}
        </div>
        {canCreate && (
          <Link href="/jobs/new">
            <Button size="sm">+ Add {jobLabel}</Button>
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-foreground-muted">
            <JobsIcon className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-foreground">
            {assignedToMe ? `No ${jobsLabel.toLowerCase()} assigned to you` : `No ${jobsLabel.toLowerCase()} yet`}
          </h2>
          <p className="mt-1.5 max-w-xs text-sm text-foreground-muted">
            {assignedToMe
              ? `${jobsLabel} assigned to you will show up here.`
              : canCreate
                ? `Create your first ${jobLabel.toLowerCase()} to start tracking work.`
                : `${jobsLabel} will show up here once they're created.`}
          </p>
          {canCreate && !assignedToMe && (
            <Link href="/jobs/new" className="mt-4">
              <Button size="sm">+ Add {jobLabel}</Button>
            </Link>
          )}
        </div>
      ) : (
        <Card className="divide-y divide-border p-0">
          {rows.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover first:rounded-t-[var(--radius-lg)] last:rounded-b-[var(--radius-lg)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                <p className="truncate text-xs text-foreground-muted">
                  {[
                    customerNamesById.get(job.customer_id),
                    job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <Badge tone={STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
