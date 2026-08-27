import { endOfDay, startOfDay } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/utils";
import type { JobStatus } from "@/lib/database.types";

export interface AgendaJob {
  id: string;
  title: string;
  status: JobStatus;
  scheduledAt: string;
  customerName: string;
  assigneeName: string | null;
}

/** Jobs scheduled for today, joined with customer and assignee names. */
export async function getTodayAgenda(
  organizationId: string,
  opts?: { limit?: number }
): Promise<AgendaJob[]> {
  const supabase = await createClient();
  const now = new Date();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, scheduled_at, customer_id, assigned_to")
    .eq("organization_id", organizationId)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", startOfDay(now).toISOString())
    .lte("scheduled_at", endOfDay(now).toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(opts?.limit ?? 5);

  const rows = jobs ?? [];
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((job) => job.customer_id))];
  const hasAssignees = rows.some((job) => job.assigned_to !== null);

  const [{ data: customers }, { data: members }] = await Promise.all([
    supabase.from("customers").select("id, first_name, last_name").in("id", customerIds),
    hasAssignees
      ? supabase.rpc("list_organization_members", { target_org_id: organizationId })
      : Promise.resolve({ data: [] }),
  ]);

  const customerNamesById = new Map(
    (customers ?? []).map((customer) => [customer.id, fullName(customer.first_name, customer.last_name)])
  );
  const memberNamesById = new Map(
    (members ?? []).map((member) => [member.user_id, fullName(member.first_name, member.last_name)])
  );

  return rows.map((job) => ({
    id: job.id,
    title: job.title,
    status: job.status,
    scheduledAt: job.scheduled_at as string,
    customerName: customerNamesById.get(job.customer_id) ?? "—",
    assigneeName: job.assigned_to ? (memberNamesById.get(job.assigned_to) ?? null) : null,
  }));
}
