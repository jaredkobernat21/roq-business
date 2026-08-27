"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManagePaymentConnections } from "@/lib/permissions";

export async function disconnectStripeAction(): Promise<void> {
  const context = await getCurrentOrgContext();
  if (!context || !canManagePaymentConnections(context.role)) return;

  const supabase = await createClient();
  await supabase
    .from("payment_connections")
    .update({ status: "disconnected" })
    .eq("organization_id", context.organization.id)
    .eq("provider", "stripe");

  revalidatePath("/settings/integrations");
}
