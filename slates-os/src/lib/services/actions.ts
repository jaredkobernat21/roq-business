"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageServices } from "@/lib/permissions";

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

function parseDollarsToCents(value: string): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

export async function createServiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageServices(context.role)) {
    return { error: "You don't have permission to manage services." };
  }

  const name = field(formData, "name");
  if (!name) {
    return { error: "Service name is required." };
  }

  const supabase = await createClient();
  const { data: service, error } = await supabase
    .from("services")
    .insert({
      organization_id: context.organization.id,
      name,
      description: field(formData, "description") || null,
      duration_minutes: parsePositiveInt(field(formData, "duration_minutes")),
      starting_price_cents: parseDollarsToCents(field(formData, "starting_price")),
      is_active: formData.get("is_active") === "on",
      bookable_online: formData.get("bookable_online") === "on",
    })
    .select("id")
    .single();

  if (error || !service) {
    return { error: error?.message ?? "Could not create service." };
  }

  revalidatePath("/settings/services");
  revalidatePath("/jobs/new");
  redirect(`/settings/services/${service.id}`);
}

export async function updateServiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageServices(context.role)) {
    return { error: "You don't have permission to manage services." };
  }

  const serviceId = field(formData, "service_id");
  const name = field(formData, "name");
  if (!serviceId || !name) {
    return { error: "Service name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name,
      description: field(formData, "description") || null,
      duration_minutes: parsePositiveInt(field(formData, "duration_minutes")),
      starting_price_cents: parseDollarsToCents(field(formData, "starting_price")),
      is_active: formData.get("is_active") === "on",
      bookable_online: formData.get("bookable_online") === "on",
    })
    .eq("id", serviceId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/settings/services/${serviceId}`);
  revalidatePath("/settings/services");
  revalidatePath("/jobs/new");
  return { success: true };
}
