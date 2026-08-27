"use client";

import { useActionState } from "react";
import { createInvoiceAction, type FormActionState } from "@/lib/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { LineItemsEditor } from "../line-items-editor";

const initialState: FormActionState = {};

export function NewInvoiceForm({
  customers,
  preselectedCustomerId,
  preselectedJobId,
}: {
  customers: { id: string; label: string }[];
  preselectedCustomerId?: string;
  preselectedJobId?: string;
}) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {preselectedJobId && <input type="hidden" name="job_id" value={preselectedJobId} />}

      <Card className="space-y-4">
        <div>
          <Label htmlFor="customer_id">Customer</Label>
          <Select id="customer_id" name="customer_id" defaultValue={preselectedCustomerId ?? ""} required>
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="due_date">Due date (optional)</Label>
          <Input id="due_date" name="due_date" type="date" />
        </div>
      </Card>

      <Card>
        <LineItemsEditor initialItems={[]} />
      </Card>

      <Card>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </Card>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create invoice"}
      </Button>
    </form>
  );
}
