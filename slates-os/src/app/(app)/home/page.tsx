import Link from "next/link";
import { getCurrentOrgContext, getCurrentProfile, getCurrentUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { getTodayAgenda } from "@/lib/scheduling/today-agenda";
import { formatActivityEvent } from "@/lib/activity";
import { ROLE_LABELS, JOB_STATUS_LABELS } from "@/lib/permissions";
import { fullName } from "@/lib/utils";
import { Card, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ActivityEventType } from "@/lib/database.types";

async function getActiveMemberCount(organizationId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");
  return count ?? 0;
}

async function getAssignedToYou(organizationId: string, userId: string) {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, scheduled_at, customer_id")
    .eq("organization_id", organizationId)
    .eq("assigned_to", userId)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(20);

  const rows = (jobs ?? [])
    .filter((job) => job.status !== "completed" && job.status !== "cancelled")
    .slice(0, 5);
  const customerIds = [...new Set(rows.map((job) => job.customer_id))];
  const { data: customers } =
    customerIds.length > 0
      ? await supabase.from("customers").select("id, first_name, last_name").in("id", customerIds)
      : { data: [] };
  const customerNamesById = new Map(
    (customers ?? []).map((customer) => [customer.id, fullName(customer.first_name, customer.last_name)])
  );

  return rows.map((job) => ({ ...job, customerName: customerNamesById.get(job.customer_id) ?? "—" }));
}

async function getRecentActivity(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_events")
    .select("id, event_type, data, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}

export default async function HomePage() {
  const context = await getCurrentOrgContext();
  const profile = await getCurrentProfile();
  const user = await getCurrentUser();
  if (!context || !user) return null;

  const orgId = context.organization.id;

  const [memberCount, todaysJobs, assignedToYou, activity] = await Promise.all([
    getActiveMemberCount(orgId),
    getTodayAgenda(orgId),
    getAssignedToYou(orgId, user.id),
    getRecentActivity(orgId),
  ]);

  const name = fullName(profile?.first_name, profile?.last_name) || "there";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-foreground-muted">{context.organization.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {name}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardDescription className="mt-0 text-xs uppercase tracking-wide text-foreground-faint">
            Signed in as
          </CardDescription>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {fullName(profile?.first_name, profile?.last_name) || "—"}
          </p>
        </Card>
        <Card>
          <CardDescription className="mt-0 text-xs uppercase tracking-wide text-foreground-faint">
            Your role
          </CardDescription>
          <p className="mt-1.5 text-sm font-medium text-foreground">{ROLE_LABELS[context.role]}</p>
        </Card>
        <Card>
          <CardDescription className="mt-0 text-xs uppercase tracking-wide text-foreground-faint">
            Team members
          </CardDescription>
          <p className="mt-1.5 text-sm font-medium text-foreground">{memberCount}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Today&apos;s schedule</h2>
            <Link href="/schedule" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {todaysJobs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No jobs scheduled today.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {todaysJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    <p className="truncate text-xs text-foreground-muted">{job.customerName}</p>
                  </div>
                  <Badge tone="neutral">{JOB_STATUS_LABELS[job.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Assigned to you</h2>
            <Link href="/jobs?assigned=me" className="text-xs font-medium text-foreground-muted hover:text-foreground">
              View all →
            </Link>
          </div>
          {assignedToYou.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">Nothing assigned to you right now.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {assignedToYou.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-surface-hover sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
                    <p className="truncate text-xs text-foreground-muted">{job.customerName}</p>
                  </div>
                  <Badge tone="neutral">{JOB_STATUS_LABELS[job.status]}</Badge>
                </Link>
              ))}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>

        <Card className="p-0">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-foreground-muted sm:px-6">No activity yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border">
              {activity.map((event) => (
                <div key={event.id} className="px-5 py-3 sm:px-6">
                  <p className="text-sm text-foreground">
                    {formatActivityEvent(event.event_type as ActivityEventType, event.data)}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground-faint">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="h-5 sm:h-6" />
        </Card>
      </div>
    </div>
  );
}
