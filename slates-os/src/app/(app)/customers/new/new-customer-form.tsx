"use client";

import { useActionState } from "react";
import { createCustomerAction, type FormActionState } from "@/lib/customers/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";

const initialState: FormActionState = {};

export function NewCustomerForm() {
  const [state, formAction, pending] = useActionState(createCustomerAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Card className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" name="first_name" required autoFocus />
          </div>
          <div>
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" name="last_name" />
          </div>
        </div>

        <div>
          <Label htmlFor="company_name">Company (optional)</Label>
          <Input id="company_name" name="company_name" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue="customer">
            <option value="customer">Customer</option>
            <option value="lead">Lead</option>
          </Select>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Address (optional)</CardTitle>
        <div>
          <Label htmlFor="line1">Street address</Label>
          <Input id="line1" name="line1" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" />
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input id="state" name="state" />
          </div>
          <div>
            <Label htmlFor="postal_code">ZIP</Label>
            <Input id="postal_code" name="postal_code" />
          </div>
        </div>
      </Card>

      <Card>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} />
      </Card>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add customer"}
      </Button>
    </form>
  );
}
