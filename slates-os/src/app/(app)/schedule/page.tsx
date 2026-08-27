import Link from "next/link";
import {
  addDays,
  addWeeks,
  endOfDay,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from "date-fns";
import { getCurrentOrgContext } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { canCreateJobs, canManageScheduleBlocks, JOB_STATUS_LABELS } from "@/lib/permissions";
import { deleteScheduleBlockAction } from "@/lib/scheduling/actions";
import { getFreeIntervals, getOpenInterval } from "@/lib/scheduling/availability";
import { getLabel } from "@/lib/labels";
import { fullName, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/database.types";
import { ScheduleMemberFilter } from "./schedule-member-filter";
import { BlockTimeControl } from "./block-time-control";

type AgendaItem =
  | {
      kind: "job";
      id: string;
      start: Date;
      title: string;
      status: JobStatus;
      customerId: string;
      assignedTo: string | null;
    }
  | { kind: "block"; id: string; start: Date; reason: string | null; memberId: string | null };

function dateParam(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function AgendaRow({
  item,
  customerName,
  assigneeName,
  canRemoveBlocks,
}: {
  item: AgendaItem;
  customerName: string;
  assigneeName: string | null;
  canRemoveBlocks: boolean;
}) {
  if (item.kind === "block") {
    return (
      <div className="flex items-center gap-3 bg-surface-muted/40 px-3 py-2.5">
        <div className="w-16 shrink-0 text-xs font-medium text-foreground-faint">
          {format(item.start, "h:mm a")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground-muted">
            Blocked{item.memberId && assigneeName ? ` — ${assigneeName}` : item.memberId ? "" : " — whole team"}
          </p>
          {item.reason && <p className="truncate text-xs text-foreground-faint">{item.reason}</p>}
        </div>
        {canRemoveBlocks && (
          <form action={deleteScheduleBlockAction.bind(null, item.id)}>
            <button type="submit" className="shrink-0 text-xs text-foreground-faint hover:text-danger">
              Remove
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <Link
      href={`/jobs/${item.id}`}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-hover"
    >
      <div className="w-16 shrink-0 text-xs font-medium text-foreground-muted">
        {format(item.start, "h:mm a")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
        <p className="truncate text-xs text-foreground-muted">
          {[customerName, assigneeName].filter(Boolean).join(" · ")}
        </p>
      </div>
      <Badge tone="neutral" className="shrink-0">
        {JOB_STATUS_LABELS[item.status]}
      </Badge>
    </Link>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; member?: string }>;
}) {
  const { view: viewParam, date: dateParamValue, member: memberParam } = await searchParams;
  const view: "day" | "week" = viewParam === "week" ? "week" : "day";
  const context = await getCurrentOrgContext();
  if (!context) return null;

  const anchorDate = dateParamValue ? parseISO(dateParamValue) : new Date();
  const rangeStart = view === "day" ? startOfDay(anchorDate) : startOfWeek(anchorDate, { weekStartsOn: 1 });
  const rangeEnd = view === "day" ? endOfDay(anchorDate) : endOfWeek(anchorDate, { weekStartsOn: 1 });

  const supabase = await createClient();
  let jobsQuery = supabase
    .from("jobs")
    .select("id, title, status, scheduled_at, duration_minutes, customer_id, assigned_to")
    .eq("organization_id", context.organization.id)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", rangeStart.toISOString())
    .lte("scheduled_at", rangeEnd.toISOString())
    .order("scheduled_at", { ascending: true });

  let blocksQuery = supabase
    .from("schedule_blocks")
    .select("id, member_id, starts_at, ends_at, reason")
    .eq("organization_id", context.organization.id)
    .lte("starts_at", rangeEnd.toISOString())
    .gte("ends_at", rangeStart.toISOString());

  if (memberParam) {
    jobsQuery = jobsQuery.eq("assigned_to", memberParam);
    blocksQuery = blocksQuery.or(`member_id.is.null,member_id.eq.${memberParam}`);
  }

  const [{ data: jobs }, { data: blocks }, { data: members }, { data: businessHours }] = await Promise.all([
    jobsQuery,
    blocksQuery,
    supabase.rpc("list_organization_members", { target_org_id: context.organization.id }),
    supabase.from("business_hours").select("*").eq("organization_id", context.organization.id),
  ]);

  const jobRows = jobs ?? [];
  const blockRows = blocks ?? [];
  const customerIds = [...new Set(jobRows.map((job) => job.customer_id))];
  const { data: customers } =
    customerIds.length > 0
      ? await supabase.from("customers").select("id, first_name, last_name").in("id", customerIds)
      : { data: [] };
  const customerNamesById = new Map(
    (customers ?? []).map((customer) => [customer.id, fullName(customer.first_name, customer.last_name)])
  );

  const memberOptions = (members ?? [])
    .filter((member) => member.status === "active")
    .map((member) => ({
      id: member.user_id,
      label: fullName(member.first_name, member.last_name) || member.email || "Unnamed",
    }));
  const memberNamesById = new Map(memberOptions.map((member) => [member.id, member.label]));

  const items: AgendaItem[] = [
    ...jobRows.map(
      (job): AgendaItem => ({
        kind: "job",
        id: job.id,
        start: parseISO(job.scheduled_at as string),
        title: job.title,
        status: job.status,
        customerId: job.customer_id,
        assignedTo: job.assigned_to,
      })
    ),
    ...blockRows.map(
      (block): AgendaItem => ({
        kind: "block",
        id: block.id,
        start: parseISO(block.starts_at),
        reason: block.reason,
        memberId: block.member_id,
      })
    ),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const mode = context.organization.business_mode;
  const canCreate = canCreateJobs(context.role);
  const canManageBlocks = canManageScheduleBlocks(context.role);
  const dateStr = dateParamValue ?? dateParam(new Date());
  const memberQuery = memberParam ? `&member=${memberParam}` : "";

  const prevDate = view === "day" ? subDays(anchorDate, 1) : subWeeks(anchorDate, 1);
  const nextDate = view === "day" ? addDays(anchorDate, 1) : addWeeks(anchorDate, 1);
  const prevHref = `/schedule?view=${view}&date=${dateParam(prevDate)}${memberQuery}`;
  const nextHref = `/schedule?view=${view}&date=${dateParam(nextDate)}${memberQuery}`;
  const todayHref = `/schedule?view=${view}&date=${dateParam(new Date())}${memberQuery}`;
  const dayViewHref = `/schedule?view=day&date=${dateStr}${memberQuery}`;
  const weekViewHref = `/schedule?view=week&date=${dateStr}${memberQuery}`;

  const rangeLabel =
    view === "day"
      ? format(anchorDate, "EEEE, MMMM d, yyyy")
      : `${format(rangeStart, "MMM d")} – ${format(rangeEnd, "MMM d, yyyy")}`;

  let freeTimeLabel: string | null = null;
  if (view === "day") {
    const busy = items.map((item) => {
      if (item.kind === "job") {
        const job = jobRows.find((j) => j.id === item.id);
        const durationMinutes = job?.duration_minutes ?? 60;
        return { start: item.start, end: new Date(item.start.getTime() + durationMinutes * 60_000) };
      }
      const block = blockRows.find((b) => b.id === item.id);
      return { start: item.start, end: block ? parseISO(block.ends_at) : item.start };
    });
    const open = getOpenInterval(businessHours ?? [], anchorDate);
    if (!open) {
      freeTimeLabel = "Closed today";
    } else {
      const free = getFreeIntervals(businessHours ?? [], anchorDate, busy);
      freeTimeLabel =
        free.length === 0
          ? "Fully booked"
          : `Open: ${free.map((f) => `${format(f.start, "h:mm a")}–${format(f.end, "h:mm a")}`).join(", ")}`;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">{getLabel(mode, "schedule")}</h1>
        {canCreate && (
          <Link href={`/jobs/new?scheduled_date=${dateStr}`}>
            <Button size="sm">+ Add {getLabel(mode, "job")}</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={prevHref}>
            <Button variant="secondary" size="sm">
              ‹
            </Button>
          </Link>
          <Link href={todayHref}>
            <Button variant="secondary" size="sm">
              Today
            </Button>
          </Link>
          <Link href={nextHref}>
            <Button variant="secondary" size="sm">
              ›
            </Button>
          </Link>
          <div className="ml-1 flex overflow-hidden rounded-[var(--radius-sm)] border border-border-strong text-sm">
            <Link
              href={dayViewHref}
              className={cn("px-3 py-1.5", view === "day" ? "bg-surface-muted text-foreground" : "text-foreground-muted")}
            >
              Day
            </Link>
            <Link
              href={weekViewHref}
              className={cn("px-3 py-1.5", view === "week" ? "bg-surface-muted text-foreground" : "text-foreground-muted")}
            >
              Week
            </Link>
          </div>
        </div>
        <ScheduleMemberFilter members={memberOptions} selected={memberParam} view={view} date={dateStr} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm text-foreground-muted">{rangeLabel}</p>
          {freeTimeLabel && <p className="text-xs text-foreground-faint">{freeTimeLabel}</p>}
        </div>
        {canManageBlocks && view === "day" && (
          <BlockTimeControl date={dateStr} members={memberOptions} />
        )}
      </div>

      {view === "day" ? (
        <Card className="p-0">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-foreground-muted">
              No {getLabel(mode, "jobs").toLowerCase()} scheduled for this day.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <AgendaRow
                  key={`${item.kind}-${item.id}`}
                  item={item}
                  customerName={item.kind === "job" ? (customerNamesById.get(item.customerId) ?? "—") : ""}
                  assigneeName={
                    item.kind === "job"
                      ? item.assignedTo
                        ? (memberNamesById.get(item.assignedTo) ?? null)
                        : null
                      : item.memberId
                        ? (memberNamesById.get(item.memberId) ?? null)
                        : null
                  }
                  canRemoveBlocks={canManageBlocks}
                />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }, (_, i) => addDays(rangeStart, i)).map((day) => {
            const dayItems = items.filter((item) => isSameDay(item.start, day));
            return (
              <Card key={day.toISOString()} className="p-0">
                <div
                  className={cn(
                    "border-b border-border px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide",
                    isToday(day) ? "text-foreground" : "text-foreground-muted"
                  )}
                >
                  {format(day, "EEE d")}
                </div>
                {dayItems.length === 0 ? (
                  <p className="px-3.5 py-4 text-xs text-foreground-faint">No jobs</p>
                ) : (
                  <div className="divide-y divide-border">
                    {dayItems.map((item) => (
                      <AgendaRow
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        customerName={
                          item.kind === "job" ? (customerNamesById.get(item.customerId) ?? "—") : ""
                        }
                        assigneeName={
                          item.kind === "job"
                            ? item.assignedTo
                              ? (memberNamesById.get(item.assignedTo) ?? null)
                              : null
                            : item.memberId
                              ? (memberNamesById.get(item.memberId) ?? null)
                              : null
                        }
                        canRemoveBlocks={canManageBlocks}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
