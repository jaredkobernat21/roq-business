"use client";

import { useActionState } from "react";
import { updateInvoiceAction, type FormActionState } from "@/lib/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { LineItemsEditor, type LineItemDraft } from "../line-items-editor";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

export function InvoiceEditForm({
  invoice,
  items,
  taxPercent,
  readOnly,
}: {
  invoice: Database["public"]["Tables"]["invoices"]["Row"];
  items: Database["public"]["Tables"]["invoice_items"]["Row"][];
  taxPercent: number;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateInvoiceAction, initialState);

  if (readOnly) {
    return (
      <div className="space-y-3">
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">
                {item.description} {item.quantity !== 1 && `× ${item.quantity}`}
              </span>
              <span className="text-foreground-muted">
                {((item.quantity * item.rate_cents) / 100).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </span>
            </li>
          ))}
        </ul>
        {invoice.due_date && <p className="text-sm text-foreground-muted">Due {invoice.due_date}</p>}
        {invoice.notes && <p className="text-sm text-foreground-muted">{invoice.notes}</p>}
        <p className="text-right text-sm font-semibold text-foreground">
          Total: {(invoice.total_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </p>
      </div>
    );
  }

  const draftItems: LineItemDraft[] = items.map((item) => ({
    description: item.description,
    quantity: String(item.quantity),
    rate: (item.rate_cents / 100).toFixed(2),
  }));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="invoice_id" value={invoice.id} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">Saved.</Alert>}

      <div>
        <Label htmlFor="due_date">Due date</Label>
        <Input id="due_date" name="due_date" type="date" defaultValue={invoice.due_date ?? ""} />
      </div>

      <LineItemsEditor initialItems={draftItems} initialTaxPercent={taxPercent} />

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={invoice.notes ?? ""} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
