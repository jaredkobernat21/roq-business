"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrgContext } from "@/lib/session";
import { canManageInvoices } from "@/lib/permissions";

export interface FormActionState {
  error?: string;
  success?: boolean;
}

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

interface ParsedLineItem {
  description: string;
  quantity: number;
  rate_cents: number;
}

function parseLineItems(formData: FormData): ParsedLineItem[] {
  const descriptions = formData.getAll("item_description");
  const quantities = formData.getAll("item_quantity");
  const rates = formData.getAll("item_rate");

  const items: ParsedLineItem[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    const description = String(descriptions[i] ?? "").trim();
    if (!description) continue;
    const quantity = Number.parseFloat(String(quantities[i] ?? "1"));
    const rateDollars = Number.parseFloat(String(rates[i] ?? "0"));
    items.push({
      description,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      rate_cents: Number.isFinite(rateDollars) && rateDollars >= 0 ? Math.round(rateDollars * 100) : 0,
    });
  }
  return items;
}

function computeTotals(items: ParsedLineItem[], taxPercent: number) {
  const subtotal_cents = items.reduce((sum, item) => sum + Math.round(item.quantity * item.rate_cents), 0);
  const tax_cents = Math.round(subtotal_cents * (taxPercent / 100));
  return { subtotal_cents, tax_cents, total_cents: subtotal_cents + tax_cents };
}

export async function createInvoiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageInvoices(context.role)) {
    return { error: "You don't have permission to create invoices." };
  }

  const customerId = field(formData, "customer_id");
  if (!customerId) {
    return { error: "A customer is required." };
  }

  const items = parseLineItems(formData);
  if (items.length === 0) {
    return { error: "Add at least one line item." };
  }

  const taxPercent = Number.parseFloat(field(formData, "tax_percent")) || 0;
  const totals = computeTotals(items, taxPercent);
  const dueDate = field(formData, "due_date");
  const jobId = field(formData, "job_id") || null;
  const notes = field(formData, "notes");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      organization_id: context.organization.id,
      customer_id: customerId,
      job_id: jobId,
      due_date: dueDate || null,
      notes: notes || null,
      created_by: user?.id ?? null,
      ...totals,
    })
    .select("id")
    .single();

  if (error || !invoice) {
    return { error: error?.message ?? "Could not create invoice." };
  }

  const { error: itemsError } = await supabase.from("invoice_items").insert(
    items.map((item, index) => ({
      invoice_id: invoice.id,
      organization_id: context.organization.id,
      description: item.description,
      quantity: item.quantity,
      rate_cents: item.rate_cents,
      sort_order: index,
    }))
  );

  if (itemsError) {
    return { error: itemsError.message };
  }

  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoiceAction(
  _prevState: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageInvoices(context.role)) {
    return { error: "You don't have permission to edit invoices." };
  }

  const invoiceId = field(formData, "invoice_id");
  if (!invoiceId) {
    return { error: "Missing invoice." };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .eq("organization_id", context.organization.id)
    .maybeSingle();

  if (!existing) {
    return { error: "Invoice not found." };
  }
  if (existing.status !== "draft") {
    return { error: "Only draft invoices can be edited — void and recreate instead." };
  }

  const items = parseLineItems(formData);
  if (items.length === 0) {
    return { error: "Add at least one line item." };
  }

  const taxPercent = Number.parseFloat(field(formData, "tax_percent")) || 0;
  const totals = computeTotals(items, taxPercent);
  const dueDate = field(formData, "due_date");
  const notes = field(formData, "notes");

  // Simplest correct way to handle an edited line-item set: replace them
  // wholesale rather than diffing which rows changed.
  const { error: deleteError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", invoiceId)
    .eq("organization_id", context.organization.id);
  if (deleteError) {
    return { error: deleteError.message };
  }

  const { error: insertError } = await supabase.from("invoice_items").insert(
    items.map((item, index) => ({
      invoice_id: invoiceId,
      organization_id: context.organization.id,
      description: item.description,
      quantity: item.quantity,
      rate_cents: item.rate_cents,
      sort_order: index,
    }))
  );
  if (insertError) {
    return { error: insertError.message };
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ due_date: dueDate || null, notes: notes || null, ...totals })
    .eq("id", invoiceId)
    .eq("organization_id", context.organization.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { success: true };
}

export async function markInvoiceSentAction(invoiceId: string): Promise<void> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageInvoices(context.role)) return;

  const supabase = await createClient();
  await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("organization_id", context.organization.id)
    .eq("status", "draft");

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}

export async function voidInvoiceAction(invoiceId: string): Promise<void> {
  const context = await getCurrentOrgContext();
  if (!context || !canManageInvoices(context.role)) return;

  const supabase = await createClient();
  await supabase
    .from("invoices")
    .update({ status: "void" })
    .eq("id", invoiceId)
    .eq("organization_id", context.organization.id);

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
}
