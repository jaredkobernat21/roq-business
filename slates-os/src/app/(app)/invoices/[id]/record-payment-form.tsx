"use client";

import { useActionState } from "react";
import { recordManualPaymentAction, type RecordPaymentState } from "@/lib/payments/actions";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, HelpText } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const initialState: RecordPaymentState = {};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentForm({
  invoiceId,
  balanceDueCents,
}: {
  invoiceId: string;
  balanceDueCents: number;
}) {
  const [state, formAction, pending] = useActionState(
    recordManualPaymentAction.bind(null, invoiceId),
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            // Prefilled with what's outstanding, which is the common case —
            // still editable for a partial payment.
            defaultValue={(balanceDueCents / 100).toFixed(2)}
            required
          />
        </div>

        <div>
          <Label htmlFor="method">How was it paid?</Label>
          <Select id="method" name="method" defaultValue="check" required>
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="received_on">Date received</Label>
          <Input id="received_on" name="received_on" type="date" defaultValue={today()} />
        </div>

        <div>
          <Label htmlFor="reference">Reference</Label>
          <Input id="reference" name="reference" placeholder="Check #1042" />
          <HelpText>Optional — how you&apos;d find this payment again.</HelpText>
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Recording…" : "Record payment"}
      </Button>
    </form>
  );
}
