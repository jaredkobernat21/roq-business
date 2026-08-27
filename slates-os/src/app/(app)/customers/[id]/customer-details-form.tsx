"use client";

import { useActionState } from "react";
import { updateCustomerAction, type FormActionState } from "@/lib/customers/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import type { Database } from "@/lib/database.types";

const initialState: FormActionState = {};

export function CustomerDetailsForm({
  customer,
  readOnly,
}: {
  customer: Database["public"]["Tables"]["customers"]["Row"];
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCustomerAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="customer_id" value={customer.id} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">Saved.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="first_name">First name</Label>
          <Input
            id="first_name"
            name="first_name"
            defaultValue={customer.first_name}
            disabled={readOnly}
            required
          />
        </div>
        <div>
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" defaultValue={customer.last_name ?? ""} disabled={readOnly} />
        </div>
      </div>

      <div>
        <Label htmlFor="company_name">Company</Label>
        <Input
          id="company_name"
          name="company_name"
          defaultValue={customer.company_name ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={customer.phone ?? ""} disabled={readOnly} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer.email ?? ""}
            disabled={readOnly}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select id="status" name="status" defaultValue={customer.status} disabled={readOnly}>
          <option value="customer">Customer</option>
          <option value="lead">Lead</option>
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={customer.notes ?? ""} disabled={readOnly} />
      </div>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      )}
    </form>
  );
}
