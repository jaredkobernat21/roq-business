"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageCustomers } from "@/lib/permissions";
import type { CustomerStatus } from "@/lib/database.types";

export interface FormActionState {
  error?: string;
  success?: boolean;
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createCustomerAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageCustomers(context.role)) {
    return { error: "You don't have permission to add customers." };
  }

  const firstName = field(formData, "first_name");
  if (!firstName) {
    return { error: "First name is required." };
  }

  const status: CustomerStatus = field(formData, "status") === "lead" ? "lead" : "customer";
  const line1 = field(formData, "line1");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      organization_id: context.organization.id,
      first_name: firstName,
      last_name: field(formData, "last_name") || null,
      company_name: field(formData, "company_name") || null,
      phone: field(formData, "phone") || null,
      email: field(formData, "email") || null,
      status,
      notes: field(formData, "notes") || null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !customer) {
    return { error: error?.message ?? "Could not create customer." };
  }

  if (line1) {
    // Best-effort: the customer record above is the source of truth for this
    // submission. If this insert fails, the customer still exists and an
    // address can be added from the profile page.
    await supabase.from("customer_addresses").insert({
      organization_id: context.organization.id,
      customer_id: customer.id,
      line1,
      line2: field(formData, "line2") || null,
      city: field(formData, "city") || null,
      state: field(formData, "state") || null,
      postal_code: field(formData, "postal_code") || null,
      is_primary: true,
    });
  }

  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageCustomers(context.role)) {
    return { error: "You don't have permission to edit customers." };
  }

  const customerId = field(formData, "customer_id");
  const firstName = field(formData, "first_name");
  if (!customerId || !firstName) {
    return { error: "First name is required." };
  }

  const status: CustomerStatus = field(formData, "status") === "lead" ? "lead" : "customer";

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      first_name: firstName,
      last_name: field(formData, "last_name") || null,
      company_name: field(formData, "company_name") || null,
      phone: field(formData, "phone") || null,
      email: field(formData, "email") || null,
      status,
      notes: field(formData, "notes") || null,
    })
    .eq("id", customerId)
    .eq("organization_id", context.organization.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { success: true };
}

export async function addCustomerAddressAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageCustomers(context.role)) {
    return { error: "You don't have permission to add addresses." };
  }

  const customerId = field(formData, "customer_id");
  const line1 = field(formData, "line1");
  if (!customerId || !line1) {
    return { error: "Street address is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("customer_addresses").insert({
    organization_id: context.organization.id,
    customer_id: customerId,
    label: field(formData, "label") || "Service address",
    line1,
    line2: field(formData, "line2") || null,
    city: field(formData, "city") || null,
    state: field(formData, "state") || null,
    postal_code: field(formData, "postal_code") || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}
