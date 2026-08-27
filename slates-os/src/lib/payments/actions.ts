"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageInvoices, canManagePaymentConnections } from "@/lib/permissions";
import type { PaymentMethod } from "@/lib/database.types";

export interface RecordPaymentState {
  error?: string;
  success?: boolean;
}

const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "check", "bank_transfer", "other"];

function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Records a payment taken outside a processor — cash, a check, a bank
 * transfer. Without this an invoice can only ever reach 'sent', since the
 * Stripe webhook is otherwise the only thing that can move amount_paid_cents.
 *
 * The role check here is for the message; record_manual_payment does its own
 * authorization, which is what actually enforces it (see docs/RLS.md).
 */
export async function recordManualPaymentAction(
  invoiceId: string,
  _prevState: RecordPaymentState,
  formData: FormData
): Promise<RecordPaymentState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageInvoices(context.role)) {
    return { error: "You don't have permission to record payments." };
  }

  const amountDollars = Number.parseFloat(String(formData.get("amount") ?? ""));
  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return { error: "Enter a payment amount greater than zero." };
  }

  const method = String(formData.get("method") ?? "");
  if (!isPaymentMethod(method)) {
    return { error: "Choose how the payment was received." };
  }

  const reference = String(formData.get("reference") ?? "").trim();
  const receivedOn = String(formData.get("received_on") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_payment", {
    target_invoice_id: invoiceId,
    amount_cents: Math.round(amountDollars * 100),
    payment_method: method,
    payment_reference: reference || null,
    // A date input gives a plain date; anchor it to midday so a timezone
    // offset can't slide it onto the previous day.
    ...(receivedOn ? { received_at: `${receivedOn}T12:00:00Z` } : {}),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: true };
}

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
