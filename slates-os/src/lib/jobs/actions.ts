"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canCreateJobs, canEditJob } from "@/lib/permissions";
import type { JobStatus } from "@/lib/database.types";
import { JOB_STATUSES } from "@/lib/permissions";

export interface FormActionState {
  error?: string;
  success?: boolean;
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function parsePositiveInt(value: string): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseStatus(value: string): JobStatus {
  return (JOB_STATUSES as string[]).includes(value) ? (value as JobStatus) : "lead";
}

/** Combines the separate date + time inputs into a timestamp, or null if no date was given. */
function combineScheduledAt(formData: FormData): string | null {
  const date = field(formData, "scheduled_date");
  if (!date) return null;
  const time = field(formData, "scheduled_time") || "09:00";
  return new Date(`${date}T${time}`).toISOString();
}

export async function createJobAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canCreateJobs(context.role)) {
    return { error: "You don't have permission to create jobs." };
  }

  const customerId = field(formData, "customer_id");
  if (!customerId) {
    return { error: "A customer is required." };
  }

  const supabase = await createClient();
  let title = field(formData, "title");
  const serviceId = field(formData, "service_id") || null;

  if (!title && serviceId) {
    const { data: service } = await supabase.from("services").select("name").eq("id", serviceId).maybeSingle();
    title = service?.name ?? "";
  }
  if (!title) {
    return { error: "A title or service is required." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: context.organization.id,
      customer_id: customerId,
      service_id: serviceId,
      address_id: field(formData, "address_id") || null,
      title,
      description: field(formData, "description") || null,
      status: parseStatus(field(formData, "status")),
      scheduled_at: combineScheduledAt(formData),
      duration_minutes: parsePositiveInt(field(formData, "duration_minutes")),
      assigned_to: field(formData, "assigned_to") || null,
      notes: field(formData, "notes") || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !job) {
    return { error: error?.message ?? "Could not create job." };
  }

  revalidatePath("/jobs");
  revalidatePath(`/customers/${customerId}`);
  redirect(`/jobs/${job.id}`);
}

export async function updateJobAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context) {
    return { error: "You don't have permission to edit this job." };
  }

  const jobId = field(formData, "job_id");
  const title = field(formData, "title");
  if (!jobId || !title) {
    return { error: "Title is required." };
  }

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("assigned_to, customer_id")
    .eq("id", jobId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!job || !canEditJob(context.role, job, user?.id)) {
    return { error: "You don't have permission to edit this job." };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      title,
      description: field(formData, "description") || null,
      status: parseStatus(field(formData, "status")),
      scheduled_at: combineScheduledAt(formData),
      duration_minutes: parsePositiveInt(field(formData, "duration_minutes")),
      assigned_to: field(formData, "assigned_to") || null,
      notes: field(formData, "notes") || null,
    })
    .eq("id", jobId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath(`/customers/${job.customer_id}`);
  return { success: true };
}
