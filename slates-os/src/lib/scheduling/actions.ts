"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageBusinessHours, canManageScheduleBlocks } from "@/lib/permissions";

export interface FormActionState {
  error?: string;
  success?: boolean;
}

export async function updateBusinessHoursAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageBusinessHours(context.role)) {
    return { error: "You don't have permission to manage business hours." };
  }

  const supabase = await createClient();
  const rows = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const isOpen = formData.get(`is_open_${dayOfWeek}`) === "on";
    const openTime = String(formData.get(`open_time_${dayOfWeek}`) ?? "").trim();
    const closeTime = String(formData.get(`close_time_${dayOfWeek}`) ?? "").trim();

    return {
      organization_id: context.organization.id,
      day_of_week: dayOfWeek,
      is_open: isOpen,
      open_time: isOpen && openTime ? openTime : null,
      close_time: isOpen && closeTime ? closeTime : null,
    };
  });

  for (const row of rows) {
    if (row.is_open && (!row.open_time || !row.close_time || row.open_time >= row.close_time)) {
      return { error: "Each open day needs a start time before its end time." };
    }
  }

  const { error } = await supabase
    .from("business_hours")
    .upsert(rows, { onConflict: "organization_id,day_of_week" });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings/hours");
  revalidatePath("/schedule");
  return { success: true };
}

export async function createScheduleBlockAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageScheduleBlocks(context.role)) {
    return { error: "You don't have permission to block time." };
  }

  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!date || !startTime || !endTime) {
    return { error: "Date, start time, and end time are required." };
  }

  const startsAt = new Date(`${date}T${startTime}`);
  const endsAt = new Date(`${date}T${endTime}`);
  if (endsAt <= startsAt) {
    return { error: "End time must be after the start time." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("schedule_blocks").insert({
    organization_id: context.organization.id,
    member_id: memberId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: reason || null,
    created_by: user?.id ?? null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/schedule");
  return { success: true };
}

export async function deleteScheduleBlockAction(blockId: string): Promise<void> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageScheduleBlocks(context.role)) return;

  const supabase = await createClient();
  await supabase
    .from("schedule_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", context.organization.id);

  revalidatePath("/schedule");
}
