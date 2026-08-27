"use client";

import { useActionState, useEffect, useState } from "react";
import { addCustomerAddressAction, type FormActionState } from "@/lib/customers/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/database.types";

type Address = Database["public"]["Tables"]["customer_addresses"]["Row"];

function formatAddress(address: Address): string {
  const cityStateZip = [address.city, [address.state, address.postal_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [address.line1, address.line2, cityStateZip].filter(Boolean).join(", ");
}

const initialState: FormActionState = {};

function AddAddressForm({ customerId, onDone }: { customerId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(addCustomerAddressAction, initialState);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={formAction} className="space-y-3 rounded-[var(--radius-sm)] border border-border p-4">
      <input type="hidden" name="customer_id" value={customerId} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <div>
        <Label htmlFor="new_label">Label</Label>
        <Input id="new_label" name="label" placeholder="Service address" />
      </div>
      <div>
        <Label htmlFor="new_line1">Street address</Label>
        <Input id="new_line1" name="line1" required autoFocus />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input name="city" placeholder="City" />
        <Input name="state" placeholder="State" />
        <Input name="postal_code" placeholder="ZIP" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add address"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AddressList({
  customerId,
  addresses,
  canManage,
}: {
  customerId: string;
  addresses: Address[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !adding && (
        <p className="text-sm text-foreground-muted">No addresses on file yet.</p>
      )}

      {addresses.length > 0 && (
        <ul className="space-y-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-border px-3.5 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{address.label}</p>
                <p className="text-sm text-foreground-muted">{formatAddress(address)}</p>
              </div>
              {address.is_primary && (
                <Badge tone="neutral" className="shrink-0">
                  Primary
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (adding ? (
          <AddAddressForm customerId={customerId} onDone={() => setAdding(false)} />
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            + Add address
          </Button>
        ))}
    </div>
  );
}
