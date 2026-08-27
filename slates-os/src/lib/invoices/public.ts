import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type PublicInvoice = NonNullable<
  Database["public"]["Functions"]["get_invoice_for_viewing"]["Returns"]
>;

/** Public read path for the customer-facing invoice page — no auth required. */
export async function getPublicInvoice(invoiceId: string): Promise<PublicInvoice | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invoice_for_viewing", { target_invoice_id: invoiceId });
  return data ?? null;
}
