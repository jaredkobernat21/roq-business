"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageOrganizationSettings } from "@/lib/permissions";
import { TIMEZONE_VALUES } from "@/lib/timezones";

export interface FormActionState {
  error?: string;
  success?: boolean;
}

export async function createOrganizationAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/New_York");

  if (!name) {
    return { error: "Business name is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("create_organization", {
    org_name: name,
    org_timezone: (TIMEZONE_VALUES as readonly string[]).includes(timezone) ? timezone : "America/New_York",
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/home");
}

export async function acceptInvitationAction(token: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { invite_token: token });

  if (error) {
    redirect(`/onboarding/organization?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/home");
}

export async function updateOrganizationAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageOrganizationSettings(context.role)) {
    return { error: "You don't have permission to update business settings." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const logoUrl = String(formData.get("logo_url") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/New_York");

  if (!name) {
    return { error: "Business name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      phone: phone || null,
      email: email || null,
      website: website || null,
      logo_url: logoUrl || null,
      timezone: (TIMEZONE_VALUES as readonly string[]).includes(timezone) ? timezone : "America/New_York",
    })
    .eq("id", context.organization.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/home");
  return { success: true };
}
